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




// 🔸 Inicia o servidor
app.listen(port, () => {
  console.log(`✅ Servidor rodando em http://localhost:${port}`);
});
