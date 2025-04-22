require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// 🔹 Fixtures (jogos do dia)
app.get('/api/fixtures', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Parâmetro "date" é obrigatório.' });

  try {
    const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('❌ Erro na rota /api/fixtures:', err);
    res.status(500).json({ error: 'Erro ao buscar jogos.' });
  }
});

// 🔹 Estatísticas de um time
app.get('/api/statistics', async (req, res) => {
  const { team, season, league } = req.query;
  if (!team || !season || !league) {
    return res.status(400).json({ error: 'Parâmetros "team", "season" e "league" são obrigatórios.' });
  }

  try {
    const url = `https://v3.football.api-sports.io/teams/statistics?team=${team}&season=${season}&league=${league}`;
    const response = await fetch(url, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    const data = await response.json();
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
  const { prompt } = req.body;
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

    if (!data || !data.choices || !data.choices[0]) {
      console.warn('⚠️ Resposta incompleta da OpenAI:', data);
      return res.status(502).json({ error: 'Resposta incompleta da IA.' });
    }

    res.json(data);
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
    res.json({
      alertaOdds,
      padraoGols,
      ligaSuspeita,
      mensagemFinal
    });

  } catch (err) {
    console.error('❌ ERRO REAL NO MODO COMPORTAMENTO SUSPEITO:', err.message);
    res.status(500).json({ error: 'Erro interno ao processar comportamento suspeito.' });
  }
});

























// 🔸 Inicia o servidor
app.listen(port, () => {
  console.log(`✅ Servidor rodando em http://localhost:${port}`);
});
