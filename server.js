require('dotenv').config();

const express     = require('express');
const path        = require('path');
const fetch       = require('node-fetch');
const Joi         = require('joi');
const cors        = require('cors');
const compression = require('compression');
const pino        = require('express-pino-logger')();
const timeout     = require('connect-timeout');        // ← import do timeout
const rateLimit   = require('express-rate-limit');     // ← import do rate limiter

const app  = express();
const port = process.env.PORT || 3001;

// Middlewares globais
app.use(cors({ origin: 'https://www.scoutei.com' }));
app.use(pino);
app.use(compression());
app.use(express.json());

// timeout global de 10s
app.use(timeout('10s'));

// limitador: max 100 req/min por IP
app.use(rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// SQLite setup
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function getDbConnection() {
  return open({
    filename: './scoutei.db',
    driver: sqlite3.Database
  });
}

// Validação Joi para preferência MP
const preferenceSchema = Joi.object({
  type: Joi.string().valid('palpites', 'vip', 'gps').required()
});

// Rota para criar preferência Mercado Pago
app.post('/api/mp/preference', async (req, res) => {
  const { type } = req.body;

  // 1) valida o body
  const { error } = preferenceSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  // 2) monta o item e a URL de sucesso
  let item, successBack;
  switch (type) {
    case 'palpites':
      item = { title: 'Palpites Secretos (1 dia)', quantity: 1, unit_price: 4.90 };
      successBack = 'https://www.scoutei.com/?liberado=1';
      break;
    case 'vip':
      item = { title: 'Acesso VIP (7 dias)', quantity: 1, unit_price: 18.90 };
      successBack = 'https://www.scoutei.com/?vip=1';
      break;
    case 'gps':
      item = { title: 'GPS do Dinheiro', quantity: 1, unit_price: 97.00 };
      successBack = 'https://www.scoutei.com/?gps=1';
      break;
    default:
      return res.status(400).json({ error: 'Tipo inválido.' });
  }

  // 3) monta o payload de preferência
  const preferencePayload = {
    site_id: 'MLB',
    items: [ item ],
    payment_methods: {
      excluded_payment_types: [
        { id: 'ticket' }
      ]
    },
    back_urls: {
      success: successBack,
      failure: 'https://www.scoutei.com/?payment=failed',
      pending: 'https://www.scoutei.com/?payment=pending'
    },
    auto_return: 'approved',
    binary_mode: true          // ← força o redirecionamento imediato
  };
  

  try {
    const baseUrl = process.env.MP_BASE_URL || 'https://api.mercadopago.com';
    const mpRes = await fetch(`${baseUrl}/checkout/preferences`, {
      method:  'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferencePayload)
    });

    if (!mpRes.ok) {
      const errText = await mpRes.text();
      console.error('MP HTTP Error:', mpRes.status, errText);
      return res.status(502).json({ error: 'Falha na API Mercado Pago.' });
    }

    const { id: preference_id, init_point } = await mpRes.json();
    console.log('MP preference created:', preference_id);

    // ─── grava o pedido localmente ──────────────────────
    const db = await getDbConnection();
    await db.run(
      `INSERT OR IGNORE INTO pedidos (preference_id, type) VALUES (?, ?)`,
      [preference_id, type]
    );
    db.close();
    // ────────────────────────────────────────────────────

    // 4) retorna ao front init_point + preference_id
    return res.json({ init_point, preference_id });
  } catch (err) {
    console.error('Erro ao criar preferência no MP:', err);
    return res.status(500).json({ error: 'Não foi possível criar preferência.' });
  }
});


// … aqui seguem suas outras rotas (/api/fixtures, /api/statistics, /api/odds, /api/chat, etc.)




async function getDbConnection() {
  return open({
    filename: './scoutei.db',
    driver: sqlite3.Database
  });
}

// em cima do arquivo, após carregar dotenv
const RESET_KEY = process.env.RESET_FIXTURES_KEY;

// middleware simples
function verifyResetKey(req, res, next) {
  const key = req.header('X-API-KEY');
  if (!key || key !== RESET_KEY) {
    return res.status(403).json({ error: 'Não autorizado.' });
  }
  next();
}



// então, ao invés de app.get('/api/reset-fixtures'...),
// faça:
app.get('/api/reset-fixtures', verifyResetKey, async (req, res) => {
  const db = await getDbConnection();
  await db.run(`DELETE FROM fixtures`);
  db.close();
  res.json({ ok: true });
});



const initTable = async () => {
  const db = await getDbConnection();

  // Cria tabela de predictions
  await db.run(
    `CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER UNIQUE,
      analise TEXT,
      palpite TEXT,
      tendencia_oculta TEXT,
      entrada_pro TEXT,
      comportamento_suspeito TEXT,
      statistics_home TEXT,
      statistics_away TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        return console.error('Erro ao criar tabela predictions:', err.message);
      }
      console.log('✅ Tabela predictions pronta.');
    }
  );

  // Cria tabela de fixtures
  await db.run(
    `CREATE TABLE IF NOT EXISTS fixtures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixtures TEXT,
      date DATE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date)
    )`,
    (err) => {
      if (err) {
        return console.error('Erro ao criar tabela fixtures:', err.message);
      }
      console.log('✅ Tabela fixtures pronta.');
    }
  );

  // Cria tabela de pedidos (para rastrear cada preference e liberar acesso)
  await db.run(
    `CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      preference_id TEXT UNIQUE,
      type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      acesso_liberado INTEGER DEFAULT 0
    )`,
    (err) => {
      if (err) {
        return console.error('Erro ao criar tabela pedidos:', err.message);
      }
      console.log('✅ Tabela pedidos pronta.');
    }
  );

  db.close();
}

initTable();





// Middleware
app.use(express.json());
app.use(express.static('public'));

// logo depois de `app.use(express.static('public'));`
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});




// 🔹 Fixtures (jogos do dia) com fallback seguro
app.get('/api/fixtures', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Parâmetro "date" é obrigatório.' });

  const db = await getDbConnection();

  const isValid = obj =>
    obj && Array.isArray(obj.response) && obj.response.every(j => j.fixture && j.teams);

  try {
    const dbResponse = await db.get(`SELECT fixtures FROM fixtures WHERE date = ?`, [date]);

    if (dbResponse?.fixtures) {
      const cached = JSON.parse(dbResponse.fixtures);
      if (isValid(cached)) {
        console.log('✅ Usando cache de fixtures (válido)');
        return res.json(cached);  // ✅ Aqui ele retorna sem fechar ainda, mas o finally abaixo fecha corretamente!
      }
      console.log('⚠️ Cache inválido ou incompleto, buscando na API…');
    } else {
      console.log('🚫 Fixtures não encontrados no banco. Buscando da API…');
    }

    const apiRes = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${date}&timezone=America/Sao_Paulo`,
      { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY } }
    );
    const json = await apiRes.json();

    if (isValid(json)) {
      await db.run(
        `INSERT INTO fixtures (fixtures, date)
         VALUES (?, ?)
         ON CONFLICT(date) DO UPDATE SET fixtures = ?`,
        [JSON.stringify(json), date, JSON.stringify(json)]
      );
      console.log('🔄 Fixtures atualizados no banco.');
      return res.json(json); // ✅ Aqui também retorna e o finally fecha o db!
    }

    console.warn('🚫 API devolveu formato inesperado:', json);
    return res.json({ response: [] }); // fallback

  } catch (err) {
    console.error('❌ Erro ao chamar API-FOOTBALL:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar fixtures.' });
  } finally {
    db.close(); // ✅ Fecha sempre uma vez só
  }
});





// 🔹 Estatísticas de um time
app.get('/api/statistics', async (req, res) => {
  const { team, season, league, id_fixture, teamName } = req.query;
  if (!team || !season || !league) {
    return res.status(400).json({ error: 'Parâmetros "team", "season" e "league" são obrigatórios.' });
  }

  const db = await getDbConnection();

  const dbResponse = await db.get(`SELECT statistics_${teamName} from predictions where match_id = ${id_fixture}`);

  if (dbResponse && dbResponse[`statistics_${teamName}`]) {
    console.log(`bank`)
    res.json(JSON.parse(dbResponse[`statistics_${teamName}`]));
    return;
  }

  console.log(`nao tem stat banco`);

  try {
    const url = `https://v3.football.api-sports.io/teams/statistics?team=${team}&season=${season}&league=${league}`;
    const response = await fetch(url, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    const data = await response.json();

    await db.run(`
      insert into predictions (match_id, statistics_${teamName}, created_at) 
      VALUES(${id_fixture}, ?, CURRENT_TIMESTAMP) ON CONFLICT(match_id) 
      DO UPDATE SET statistics_${teamName} = ?`, [JSON.stringify(data), JSON.stringify(data)]);
    db.close();

    res.json(data);
  } catch (err) {
    console.error('❌ Erro na rota /api/statistics:', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
});

// 🔹 Odds por fixture
app.get('/api/odds/:fixtureId', async (req, res) => {
  const { fixtureId } = req.params;
  if (!fixtureId) return res.status(400).json({ error: 'Parâmetro "fixtureId" é obrigatório.' });

  try {
    const url = `https://v3.football.api-sports.io/odds?fixture=${fixtureId}`;
    const response = await fetch(url, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    const data = await response.json();

    if (!data || !data.response || !Array.isArray(data.response)) {
      return res.status(404).json({ error: 'Odds não encontradas.' });
    }

    res.json(data);
  } catch (err) {
    console.error('❌ Erro na rota /api/odds:', err);
    res.status(500).json({ error: 'Erro ao buscar odds.' });
  }
});

// 🔹 Chat com OpenAI
app.post('/api/chat', async (req, res) => {
  const { prompt, id_fixture, type } = req.body;
  const db = await getDbConnection();

  const dbResponse = await db.get(`select ${type} from predictions where match_id = ${id_fixture} AND ${type} IS NOT NULL`);
  if (dbResponse) {
    res.json({ia_prediction: dbResponse[type]});
    return;
  }

  console.log(`nao tinha nada no bancao`);
  

  if (!prompt) return res.status(400).json({ error: 'O campo "prompt" é obrigatório.' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || !openaiKey.startsWith('sk-')) {
    return res.status(500).json({ error: 'API Key da OpenAI não definida corretamente.' });
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    const data = await openaiRes.json();

    const analisysResponse = data.choices[0].message?.content;
    
    if (analisysResponse) {

      console.log(type, analisysResponse);

      db.run(`
        insert into predictions (match_id, ${type}, created_at) 
        VALUES(${id_fixture}, ?, CURRENT_TIMESTAMP) ON CONFLICT(match_id) 
        DO UPDATE SET ${type} = ?`, [analisysResponse, analisysResponse]);
      db.close();
    }

    if (!data || !data.choices || !data.choices[0]) {
      console.warn('⚠️ Resposta incompleta da OpenAI:', data);
      return res.status(502).json({ error: 'Resposta incompleta da IA.' });
    }

    res.json({ia_prediction: analisysResponse});
  } catch (err) {
    console.error('❌ Erro na rota /api/chat:', err);
    res.status(500).json({ error: 'Erro ao gerar resposta da IA.' });
  }
});

// 🔹 Eventos recentes (últimos 5 jogos do time)
app.get('/api/events', async (req, res) => {
  const { team, season, league } = req.query;

  try {
    console.log(`🔎 Buscando events para Team ${team}, Season ${season}, League ${league}`);

    const response = await fetch(`https://v3.football.api-sports.io/fixtures?team=${team}&season=${season}&league=${league}&last=5`, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });

    const data = await response.json();
    const fixtures = data?.response || [];

    console.log(`📦 Fixtures encontrados: ${fixtures.length}`);

    if (fixtures.length === 0) {
      console.warn(`⚠️ Nenhuma partida recente encontrada para team=${team}`);
      return res.json({ response: [] }); // Evita erro no frontend
    }

    let eventos = [];

    for (let fixture of fixtures) {
      const fixtureId = fixture.fixture.id;
      console.log(`🔁 Buscando eventos para Fixture ID: ${fixtureId}`);

      const evRes = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, {
        headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
      });

      const evData = await evRes.json();
      eventos.push(...(evData.response || []));
    }

    console.log(`✅ Total de eventos obtidos: ${eventos.length}`);
    res.json({ response: eventos });
  } catch (error) {
    console.error('❌ ERRO EM /api/events:', error);
    res.status(500).json({ error: 'Erro ao buscar eventos.' });
  }
});

// 📡 Rota para buscar dados ao vivo de uma partida
app.get('/api/live/:fixtureId', async (req, res) => {
  const fixtureId = req.params.fixtureId;

  try {
    const response = await fetch(`https://api.sportmonks.com/v3/football/livescores/inplay?include=stats&filters=fixture_id:${fixtureId}&api_token=${process.env.SPORTMONKS_KEY}`);

    const data = await response.json();

    if (!data || !data.data || data.data.length === 0) {
      return res.status(404).json({ error: 'Dados ao vivo não encontrados para este jogo.' });
    }

    const liveMatch = data.data[0];
    const stats = liveMatch.stats || [];

    const estatisticas = {
      time: liveMatch.name,
      placar: `${liveMatch.scores?.home_score || 0} x ${liveMatch.scores?.away_score || 0}`,
      tempo: liveMatch.time?.minute || 0,
      ataquesPerigosos: stats.find(s => s.type === 'dangerous_attacks')?.value || '-',
      chutesTotais: stats.find(s => s.type === 'total_shots')?.value || '-',
      escanteios: stats.find(s => s.type === 'corners')?.value || '-',
      posseBola: stats.find(s => s.type === 'possession')?.value || '-'
    };

    res.json(estatisticas);
  } catch (error) {
    console.error('Erro ao buscar dados ao vivo:', error);
    res.status(500).json({ error: 'Erro ao buscar dados ao vivo.' });
  }
});

// Exporta app para uso principal
module.exports = app;



// ✅ SERVER.JS COMPLETO COM PADRÃO DE GOLS VIA API-FOOTBALL

app.get('/api/insider/:fixtureId', async (req, res) => {
  const fixtureId = req.params.fixtureId;
  console.log('🚨 Iniciando análise COMPORTAMENTO SUSPEITO para fixtureId:', fixtureId);

  const db = await getDbConnection();

  const dbResponse = await db.get(`select comportamento_suspeito from predictions where match_id = ${fixtureId}`);
  console.log(dbResponse);
  if (dbResponse?.comportamento_suspeito) {
    const jsonObject = JSON.parse(dbResponse.comportamento_suspeito);
    res.json(jsonObject);
    return;
  }

  console.log(`nada do bancaooo suspeito`);

  try {
    // 1. Odds da partida
    const oddsRes = await fetch(`https://v3.football.api-sports.io/odds?fixture=${fixtureId}`, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    const oddsData = await oddsRes.json();
    console.log('✅ Odds carregadas');

    const bookmakers = oddsData?.response?.[0]?.bookmakers || [];
    const mercado = bookmakers.find(b => b.bets?.some(m => m.name.toLowerCase().includes('over/under')));
    const odds = mercado?.bets?.find(m => m.name.toLowerCase().includes('over/under'))?.values || [];

    const oddOver25 = odds.find(o => o.value === 'Over 2.5')?.odd;
    const oddUnder25 = odds.find(o => o.value === 'Under 2.5')?.odd;
    console.log('🎯 Over 2.5:', oddOver25, '| Under 2.5:', oddUnder25);

    const movimentoAnormal = parseFloat(oddOver25) < 1.70 || parseFloat(oddUnder25) > 2.50;

    const alertaOdds = movimentoAnormal
      ? '⚠️ Movimento anormal detectado → As odds estão fora do comum.'
      : '✅ Sem indícios de anormalidade → As odds estão dentro dos padrões normais do mercado.';

    // 2. Buscar últimos jogos via API-FOOTBALL
    const fixtureInfo = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    const fixtureJson = await fixtureInfo.json();
    const fixture = fixtureJson?.response?.[0];
    const homeId = fixture?.teams?.home?.id;
    const awayId = fixture?.teams?.away?.id;
    const season = fixture?.league?.season;
    const leagueId = fixture?.league?.id;

    console.log('🏠 Home ID:', homeId, '| 🛫 Away ID:', awayId);

    if (!homeId || !awayId || !season || !leagueId) {
      throw new Error('Dados do jogo incompletos');
    }

    const [resHome, resAway] = await Promise.all([
      fetch(`https://v3.football.api-sports.io/fixtures?team=${homeId}&season=${season}&league=${leagueId}&last=5`, {
        headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
      }),
      fetch(`https://v3.football.api-sports.io/fixtures?team=${awayId}&season=${season}&league=${leagueId}&last=5`, {
        headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
      })
    ]);

    const jsonHome = await resHome.json();
    const jsonAway = await resAway.json();

    const resultados = [...(jsonHome?.response || []), ...(jsonAway?.response || [])].map(j => {
      const home = j.goals?.home ?? 0;
      const away = j.goals?.away ?? 0;
      return `${home}-${away}`;
    });

    let padraoGols = 'N/D';
    let placarInduzido = 'desconhecido';
    let repeticaoCritica = false;

    if (resultados.length > 0) {
      const freq = {};
      for (let r of resultados) freq[r] = (freq[r] || 0) + 1;
      const maisRepetido = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];

      if (maisRepetido) {
        placarInduzido = maisRepetido[0];
        if (maisRepetido[1] >= 2) {
          repeticaoCritica = true;
          padraoGols = `🔁 O resultado: ${maisRepetido[0]} apareceu ${maisRepetido[1]}x nas últimas 5 partidas.`;
        } else {
          padraoGols = `🔄 Resultado mais comum: ${maisRepetido[0]} (${maisRepetido[1]}x)`;
        }
      }
    }

    const liga = oddsData?.response?.[0]?.league?.name || '';
    const ligasDeRisco = ['India', 'Georgia', 'Indonésia', 'Tailândia', 'Malásia', 'Albânia'];
    const ligaSuspeita = ligasDeRisco.some(l => liga.toLowerCase().includes(l.toLowerCase()));

    const mensagemFinal =
      (movimentoAnormal || ligaSuspeita) && repeticaoCritica
        ? `🚨 Este jogo apresenta comportamento suspeito. Placar mais recorrente: ${placarInduzido}.`
        : '✅ Este jogo não apresenta comportamento suspeito.';

    console.log('✅ Modo Comportamento Suspeito finalizado com sucesso');

    const analiseComportamentoSuspeito = {
      alertaOdds,
      padraoGols,
      ligaSuspeita,
      mensagemFinal
    };

    db.run(`insert into predictions (match_id, comportamento_suspeito, created_at)
      VALUES (${fixtureId}, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (match_id) DO UPDATE SET comportamento_suspeito = ?`, [
        JSON.stringify(analiseComportamentoSuspeito), 
        JSON.stringify(analiseComportamentoSuspeito)
    ]);

    res.json(analiseComportamentoSuspeito);

  } catch (err) {
    console.error('❌ ERRO REAL NO MODO COMPORTAMENTO SUSPEITO:', err.message);
    res.status(500).json({ error: 'Erro interno ao processar comportamento suspeito.' });
  }
});


// Depois de todas as definições de app.use/rotas de API, mas ANTES de app.listen:
app.get('/gps', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});



// Correto: servir o robots.txt separado
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`
User-agent: *
Allow: /
Sitemap: https://www.scoutei.com/sitemap.xml
  `);
});



// 1) Webhook Mercado Pago — receberá o payment.updated
app.post('/api/webhooks/mercadopago', express.json(), async (req, res) => {
  const event = req.body;
  const pago   = event.data?.status === 'approved';
  const prefId = event.data?.preference_id;
  if (pago && prefId) {
    const db = await getDbConnection();
    await db.run(
      `UPDATE pedidos SET acesso_liberado = 1 WHERE preference_id = ?`,
      [ prefId ]
    );
    db.close();
  }
  // responde rápido ao MP
  res.sendStatus(200);
});

// 2) Endpoint de status para o front‑end confirmar liberação
app.get('/api/pedido-status', async (req, res) => {
  const { preference_id } = req.query;
  const db = await getDbConnection();
  const row = await db.get(
    `SELECT acesso_liberado FROM pedidos WHERE preference_id = ?`,
    [ preference_id ]
  );
  db.close();
  res.json({ acesso: !!row?.acesso_liberado });
});





// Aqui você NÃO cria o app de novo, só importa o que já existe:
const http = require('http');
const { Server } = require('socket.io');

// 👉 Supondo que o seu 'app' já foi criado acima!
const server = http.createServer(app);        // Usa o MESMO app já criado!
const io = new Server(server, { cors: { origin: "*" } });

// Configuração do Socket.io
io.on('connection', (socket) => {
  console.log('🟢 Socket conectado com ID:', socket.id);

  socket.on('sendMessage', (msg) => {
    console.log('📨 Mensagem recebida no servidor:', msg);
    // <<< aqui
    socket.broadcast.emit('receiveMessage', msg);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Usuário desconectado:', socket.id);
  });
});



// Graceful shutdown
const shutdown = () => {
  console.log('⚠️  Graceful shutdown iniciado...');
  server.close(() => {
    console.log('✔️  HTTP server fechado');
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);




// 🚀 Aqui você finaliza com o mesmo server, sem conflito:
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});