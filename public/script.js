// ✅ Arquivo script.js COMPLETO E CORRIGIDO

// Variáveis principais
const apiHost = 'https://v3.football.api-sports.io';
const sportMonksHost = 'https://api.sportmonks.com/v3/football';
const apiKey = 'SUA_CHAVE_API_FOOTBALL';
const cacheOdds = {};
let jogosTotais = [];
let paginaAtual = 1;
const jogosPorPagina = 10;

function getDataHojeBrasil() {
  const agora = new Date();
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo'
  }).format(agora.setHours(agora.getHours() - 2)).split('/').reverse().join('-');
}

const hoje = new Date();
const amanha = new Date(hoje);
amanha.setDate(hoje.getDate() + 1);
const datasBusca = [hoje, amanha].map(data => data.toISOString().split('T')[0]);

async function verEstatisticas(id, homeId, awayId, leagueId, season, matchName) {
  const estatContainer = document.getElementById(`estatisticas-${id}`);
  if (estatContainer.innerHTML.trim() !== '') {
    estatContainer.innerHTML = '';
    return;
  }
  estatContainer.innerHTML = '📊 Carregando estatísticas...';

  try {
    const [homeRes, awayRes, homeEventsRes, awayEventsRes] = await Promise.all([
      fetch(`/api/statistics?team=${homeId}&season=${season}&league=${leagueId}`),
      fetch(`/api/statistics?team=${awayId}&season=${season}&league=${leagueId}`),
      fetch(`/api/events?team=${homeId}&season=${season}&league=${leagueId}`),
      fetch(`/api/events?team=${awayId}&season=${season}&league=${leagueId}`)
    ]);

    const [homeStats, awayStats] = await Promise.all([homeRes.json(), awayRes.json()]);
    const [homeEventsData, awayEventsData] = await Promise.all([homeEventsRes.json(), awayEventsRes.json()]);

    const time1 = homeStats.response;
    const time2 = awayStats.response;

    const mediaGols1 = parseFloat(time1.goals.for.average.total || 0);
    const mediaGols2 = parseFloat(time2.goals.for.average.total || 0);
    const mediaSofridos1 = parseFloat(time1.goals.against.average.total || 0);
    const mediaSofridos2 = parseFloat(time2.goals.against.average.total || 0);
    const mediaTotal = (mediaGols1 + mediaGols2 + mediaSofridos1 + mediaSofridos2) / 2;

    // 🟨 Cartões por jogo (últimos 5 jogos)
    const calcularMediaCartoes = (eventos, tipo) => {
      let totalCartoes = 0;
      eventos.forEach(ev => {
        if (ev.type === 'Card' && ev.detail === tipo) {
          totalCartoes++;
        }
      });
      return (totalCartoes / 5).toFixed(2);
    };

    const amarelos1 = calcularMediaCartoes(homeEventsData.response, 'Yellow Card');
    const vermelhos1 = calcularMediaCartoes(homeEventsData.response, 'Red Card');
    const amarelos2 = calcularMediaCartoes(awayEventsData.response, 'Yellow Card');
    const vermelhos2 = calcularMediaCartoes(awayEventsData.response, 'Red Card');

    // ⏱️ Gols no 1º tempo com base em eventos (últimos 5 jogos)
    const calcularMediaGols1T = (eventos, teamName) => {
      const golsPorJogo = {};

      eventos.forEach(ev => {
        if (
          ev.time?.elapsed <= 45 &&
          ev.type === 'Goal' &&
          ev.team?.name === teamName
        ) {
          const id = ev.fixture?.id;
          if (!golsPorJogo[id]) golsPorJogo[id] = 0;
          golsPorJogo[id]++;
        }
      });

      const totalGols = Object.values(golsPorJogo).reduce((acc, val) => acc + val, 0);
      return (totalGols / 5).toFixed(2);
    };

    const golsHT1 = calcularMediaGols1T(homeEventsData.response, time1.team.name);
    const golsHT2 = calcularMediaGols1T(awayEventsData.response, time2.team.name);
    const mediaTotalHT = ((parseFloat(golsHT1) + parseFloat(golsHT2)) / 2).toFixed(2);

    const probOver1_5 = Math.min(95, Math.round((1 - Math.exp(-mediaTotal / 1.4)) * 100));
    const probOver2_5 = Math.min(95, Math.round((1 - Math.exp(-mediaTotal / 2.2)) * 100));
    const probUnder2_5 = 100 - probOver2_5;

    estatContainer.innerHTML = `
      <p><strong>📊 ${matchName}</strong></p>
      <ul style="padding-left: 16px; line-height: 1.6; list-style-type: none;">
        <li>⚽ Gols Médios (FT): <strong>${mediaTotal.toFixed(2)}</strong></li>
        <li>⏱️ Gols 1ºT: <strong>${mediaTotalHT}</strong> <span style="font-size: 12px; color: #888;">(Média para essa partida)</span></li>
        <li>📈 Over 1.5: <strong>${probOver1_5}%</strong></li>
        <li>📊 Over 2.5: <strong>${probOver2_5}%</strong></li>
        <li>🛡️ Under 2.5: <strong>${probUnder2_5}%</strong></li>
        <li>🟨 ${time1.team.name} Amarelos: <strong>${amarelos1}</strong> <span style="font-size: 12px; color: #888;">(Média por jogo)</span></li>
        <li>🔴 ${time1.team.name} Vermelhos: <strong>${vermelhos1}</strong> <span style="font-size: 12px; color: #888;">(Média por jogo)</span></li>
        <li>🟨 ${time2.team.name} Amarelos: <strong>${amarelos2}</strong> <span style="font-size: 12px; color: #888;">(Média por jogo)</span></li>
        <li>🔴 ${time2.team.name} Vermelhos: <strong>${vermelhos2}</strong> <span style="font-size: 12px; color: #888;">(Média por jogo)</span></li>
      </ul>
    `;
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    estatContainer.innerHTML = '❌ Erro ao carregar estatísticas.';
  }
}





async function analisarComIA(time1, time2, campeonato, dataFormatada, id, homeId, awayId, leagueId, season) {
  const container = document.getElementById(`analise-${id}`);
  if (!container) return;

  if (container.innerHTML.trim() !== '') {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '🧠 Gerando análise estratégica com IA...';

  try {
    const [homeRes, awayRes] = await Promise.all([
      fetch(`/api/statistics?team=${homeId}&season=${season}&league=${leagueId}`),
      fetch(`/api/statistics?team=${awayId}&season=${season}&league=${leagueId}`)
    ]);

    const [homeData, awayData] = await Promise.all([homeRes.json(), awayRes.json()]);
    const h = homeData.response;
    const a = awayData.response;

    if (!h || !a) {
      container.innerHTML = '❌ Não foi possível obter dados estatísticos.';
      return;
    }

    const prompt = `
Você é um analista profissional de uma casa de apostas internacional. Sua função é criar uma análise altamente estratégica, técnica e realista do jogo entre ${time1} x ${time2}, marcado para o dia ${dataFormatada}, pela competição ${campeonato}.

Use o seguinte modelo com formatação rica e emojis estratégicos:

---

1️⃣ Introdução 📌  
Apresente o confronto como uma casa de aposta apresentaria internamente: local, contexto da competição, momento emocional do duelo, e data/hora. Evite frases genéricas. Mostre domínio de mercado.

2️⃣ O Jogo e a Percepção Pública 🔍  
Mostre como o público enxerga o confronto. Use dados dos últimos 🔟 jogos (ex: ✅ 6, 🤝 3, ❌ 1). Dê destaque se o nome de um time engana, ou se há "modinha de aposta" envolvida. Mostre se o público está enviesado por resultados recentes.

3️⃣ Estratégias da Casa 🏦  
Explique como as casas estão posicionando suas odds para induzir o comportamento de massa. Use termos como: "odds atrativas no mercado BTTS", "linhas ajustadas para evitar liquidez no under", "handicap como armadilha emocional", etc.

4️⃣ Estatísticas Reais Consideradas pela Casa 📈  
Use dados como:
- Gols marcados/sofridos nos últimos 🔟 jogos;
- Tendência de gols (over 2.5 ou under 2.5);
- Histórico de confrontos (últimos 5-6 jogos entre eles);
- BTTS sim/não;
- Gols no 1º tempo.

5️⃣ Onde Está o Valor Real? 💰  
Aponte os mercados com valor técnico e emocional. Diga, por exemplo:
- “🎯 Under 2.5: baseado na média de gols combinada de 2.0 e na oscilação recente ofensiva.”
- “🤝 Empate: linha emocional favorece o time visitante, mas o jogo tende ao equilíbrio.”
Evite generalidades. Seja preciso, numérico, técnico.

6️⃣ Conclusão Estratégica 🧠  
Feche como um trader: diga onde há distorção, se o mercado está bem ajustado ou se o público está sendo levado para armadilhas. Evite palpites. Foque em leitura de mercado.

---

🧠 Linguagem técnica, firme, como se fosse uma ata interna da casa de apostas. Emojis devem reforçar leitura rápida. Nada genérico. Nada "óbvio".
`;


    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();
    const texto = data?.choices?.[0]?.message?.content || '❌ A IA não retornou resposta.';
    container.innerHTML = `<p style="margin-top: 10px;">${texto.replace(/\n/g, '<br>')}</p>`;
  } catch (error) {
    console.error('❌ Erro ao gerar análise com IA:', error);
    container.innerHTML = '<p style="color: red;">❌ Erro ao gerar análise com a IA.</p>';
  }
}





async function gerarPalpiteIA(time1, time2, id, homeId, awayId, leagueId, season) {
  const container = document.getElementById(`palpite-${id}`);
  if (container.innerHTML.trim() !== '') {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '🎯 Gerando palpite técnico com IA...';

  try {
    const [homeRes, awayRes] = await Promise.all([
      fetch(`/api/statistics?team=${homeId}&season=${season}&league=${leagueId}`),
      fetch(`/api/statistics?team=${awayId}&season=${season}&league=${leagueId}`)
    ]);

    const [homeStats, awayStats] = await Promise.all([homeRes.json(), awayRes.json()]);
    const h = homeStats.response;
    const a = awayStats.response;

    const prompt = `
Você é um analista de risco em apostas esportivas. Com base nas estatísticas abaixo, recomende o melhor mercado com valor estatístico:

📊 Estatísticas:
- ${time1}: Gols marcados: ${h.goals.for.average.total}, sofridos: ${h.goals.against.average.total}
- ${time2}: Gols marcados: ${a.goals.for.average.total}, sofridos: ${a.goals.against.average.total}

🎯 Escolha o melhor entre: Over 1.5, Over 2.5, BTTS, Under 2.5, Dupla Chance, HT Over 0.5, HT Under 0.5
✅ Responda com até 3 linhas. Seja técnico, direto e lógico.`;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    const texto = data?.choices?.[0]?.message?.content || '❌ A IA não retornou resposta.';
    container.innerHTML = `<p>${texto.replace(/\n/g, '<br>')}</p>`;
  } catch (err) {
    console.error('❌ Erro ao gerar palpite IA:', err);
    container.innerHTML = '❌ Erro ao gerar palpite IA.';
  }
}



async function verMapaProbabilidades(fixtureId, homeId, awayId, leagueId, season, matchName) {
  const container = document.getElementById(`probmap-${fixtureId}`);
  if (container.innerHTML.trim() !== '') {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '⏳ Calculando mapa de probabilidades...';

  try {
    const [homeRes, awayRes] = await Promise.all([
      fetch(`/api/statistics?team=${homeId}&season=${season}&league=${leagueId}`),
      fetch(`/api/statistics?team=${awayId}&season=${season}&league=${leagueId}`)
    ]);

    const [homeStats, awayStats] = await Promise.all([homeRes.json(), awayRes.json()]);
    const h = homeStats.response;
    const a = awayStats.response;

    const golsTotal =
      parseFloat(h.goals.for.average.total) +
      parseFloat(h.goals.against.average.total) +
      parseFloat(a.goals.for.average.total) +
      parseFloat(a.goals.against.average.total);

    const media = golsTotal / 2;

    const probOver15 = Math.min(95, Math.round((1 - Math.exp(-media / 1.4)) * 100));
    const probOver25 = Math.min(95, Math.round((1 - Math.exp(-media / 2.2)) * 100));
    const probBTTS = Math.min(95, Math.round((1 - Math.exp(-media / 2.5)) * 100));
    const probUnder25 = Math.max(5, 100 - probOver25);

    // 🔎 Gols por minuto para o time da casa e visitante
    const golsMinHome = h.goals.for.minute;
    const golsMinAway = a.goals.for.minute;

    const getMinutoMaisFatal = (dados) => {
      let max = 0;
      let intervalo = '-';
      for (let minuto in dados) {
        const total = dados[minuto]?.total || 0;
        if (total > max) {
          max = total;
          intervalo = minuto;
        }
      }
      return { intervalo, total: max };
    };

    const fatalHome = getMinutoMaisFatal(golsMinHome);
    const fatalAway = getMinutoMaisFatal(golsMinAway);

    container.innerHTML = `
      <p><strong>🔍 ${matchName}</strong></p>
      <ul>
        <li>📈 <strong>Prob. Over 1.5:</strong> ${probOver15}%</li>
        <li>📈 <strong>Prob. Over 2.5:</strong> ${probOver25}%</li>
        <li>🤝 <strong>Ambas Marcam:</strong> ${probBTTS}%</li>
        <li>🛡️ <strong>Prob. Under 2.5:</strong> ${probUnder25}%</li>
      </ul>

      <h4>⏱️ Padrão de Minutos de Gol (Últimos jogos da temporada atual)</h4>
      <ul>
        <li>🏠 <strong>${h.team.name}</strong>: faz mais gols entre <strong>${fatalHome.intervalo}</strong> (Total: ${fatalHome.total})</li>
        <li>🚪 <strong>${a.team.name}</strong>: faz mais gols entre <strong>${fatalAway.intervalo}</strong> (Total: ${fatalAway.total})</li>
      </ul>
      <p style="font-size: 13px; color: #666;">🔧 Fonte: Estatísticas por minuto. Dados referentes à média da temporada <strong>${season}</strong>.</p>

    `;
  } catch (error) {
    console.error('❌ Erro ao calcular ProbMap:', error);
    container.innerHTML = '❌ Erro ao gerar o mapa de probabilidades.';
  }
}






async function verTendenciaOculta(fixtureId, matchName, homeId, awayId, leagueId, season) {
  const container = document.getElementById(`tendencia-${fixtureId}`);
  if (container.innerHTML.trim() !== '') {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '🔍 Analisando tendência oculta...';

  try {
    // Buscar estatísticas reais dos times
    const [homeRes, awayRes] = await Promise.all([
      fetch(`/api/statistics?team=${homeId}&season=${season}&league=${leagueId}`),
      fetch(`/api/statistics?team=${awayId}&season=${season}&league=${leagueId}`)
    ]);
    const [homeStats, awayStats] = await Promise.all([homeRes.json(), awayRes.json()]);
    const h = homeStats.response;
    const a = awayStats.response;

    // Buscar odds via backend (API-FOOTBALL)
    const oddsRes = await fetch(`/api/odds/${fixtureId}`);
    const oddsJson = await oddsRes.json();

    const bookmakers = oddsJson?.response?.[0]?.bookmakers || [];
    const mercado = bookmakers.find(b =>
      b.bets?.some(m => m.name.toLowerCase().includes('over/under'))
    );
    const overUnderMarket = mercado?.bets?.find(m => m.name.toLowerCase().includes('over/under'));

    const over25 = overUnderMarket?.values?.find(v => v.value === 'Over 2.5');
    const under25 = overUnderMarket?.values?.find(v => v.value === 'Under 2.5');
    const over15 = overUnderMarket?.values?.find(v => v.value === 'Over 1.5');
    const under15 = overUnderMarket?.values?.find(v => v.value === 'Under 1.5');

    const oddOver25 = parseFloat(over25?.odd);
    const oddUnder25 = parseFloat(under25?.odd);
    const oddOver15 = parseFloat(over15?.odd);
    const oddUnder15 = parseFloat(under15?.odd);

    // 🔒 Validação: se nenhuma odd estiver disponível, não continua
    if (isNaN(oddOver25) && isNaN(oddUnder25) && isNaN(oddOver15) && isNaN(oddUnder15)) {
      container.innerHTML = '⚠️ Odds de Over/Under não disponíveis para esta partida.';
      return;
    }

    // 🔎 Prompt técnico com múltiplas odds
    const prompt = `
Você é um analista oculto das casas de apostas. Avalie o jogo "${matchName}" com os dados abaixo e diga se há alguma manipulação sutil ou tendência estratégica nos mercados Over/Under:

📊 Estatísticas:
- ${h.team.name}: Gols marcados: ${h.goals.for.average.total}, sofridos: ${h.goals.against.average.total}
- ${a.team.name}: Gols marcados: ${a.goals.for.average.total}, sofridos: ${a.goals.against.average.total}

🎯 Odds disponíveis:
- Over 1.5: ${isNaN(oddOver15) ? 'N/D' : oddOver15}
- Over 2.5: ${isNaN(oddOver25) ? 'N/D' : oddOver25}
- Under 2.5: ${isNaN(oddUnder25) ? 'N/D' : oddUnder25}
- Under 1.5: ${isNaN(oddUnder15) ? 'N/D' : oddUnder15}

Responda como um analista de precificação. Identifique possíveis distorções ou armadilhas que atraiam o apostador para mercados arriscados. Máximo de 4 linhas.
`;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    const texto = data?.choices?.[0]?.message?.content || '❌ A IA não retornou resposta.';
    container.innerHTML = `<p>${texto.replace(/\n/g, '<br>')}</p>`;

  } catch (error) {
    console.error('❌ Erro ao analisar tendência oculta:', error);
    container.innerHTML = '❌ Erro ao gerar tendência oculta.';
  }
}


// 🧠 Função IA de Cenário Ideal para Entrada (com análise condicional ao vivo)
async function analisarEntradaProfissional(fixtureId, nomeTimes, oddInicial, oddFinal) {
  const container = document.getElementById(`entrada-${fixtureId}`);
  
  if (container.innerHTML.trim() !== '') {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '🔍 Analisando cenário ideal de entrada ao vivo...';

  try {
    const res = await fetch(`/api/live/${fixtureId}`);
    const data = await res.json();

    const {
      time,
      elapsed,
      goals,
      dangerous_attacks,
      total_shots,
      corners,
      possession
    } = data;

    const prompt = `
Você é um especialista em trading esportivo ao vivo. Com base nos dados ao vivo da partida ${nomeTimes}, diga o cenário ideal para uma entrada de valor nas próximas jogadas.

⏱️ Tempo: ${elapsed}'  
⚽ Placar: ${goals}  
🔥 Ataques perigosos: ${dangerous_attacks}  
🥅 Finalizações: ${total_shots}  
🎯 Escanteios: ${corners}  
🔁 Posse de bola: ${possession}  

📌 Gere uma sugestão técnica como:
“⚠️ Se o jogo continuar 0x0 até os 30 minutos e houver 3+ finalizações do time mandante, considere entrada em Over 1.5.”

Escreva de forma profissional, direta, sem floreios. A sugestão deve parecer de um trader experiente.
`;

    const aiRes = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const aiData = await aiRes.json();
    const texto = aiData?.choices?.[0]?.message?.content || '❌ A IA não retornou resposta.';

    container.innerHTML = `<p>${texto.replace(/\n/g, '<br>')}</p>`;
  } catch (err) {
    console.error('❌ Erro na IA de Entrada Pro:', err);
    container.innerHTML = '❌ Erro ao gerar sugestão de entrada ao vivo.';
  }
}





async function detectarEdge(fixtureId, homeId, awayId, leagueId, season, matchName) {
  const container = document.getElementById(`edge-${fixtureId}`);
  if (!container) return;

  // 👉 Toggle: se já estiver visível, esconde
  if (container.innerHTML.trim() !== '') {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '🔍 Calculando valor esperado...';

  try {
    const [homeRes, awayRes, oddsRes] = await Promise.all([
      fetch(`/api/statistics?team=${homeId}&season=${season}&league=${leagueId}`),
      fetch(`/api/statistics?team=${awayId}&season=${season}&league=${leagueId}`),
      fetch(`/api/odds/${fixtureId}`)
    ]);

    const [homeStats, awayStats] = await Promise.all([homeRes.json(), awayRes.json()]);
    const stats1 = homeStats.response;
    const stats2 = awayStats.response;
    const oddsData = oddsRes?.ok ? await oddsRes.json() : null;

    const mediaGols =
      parseFloat(stats1.goals.for.average.total) +
      parseFloat(stats1.goals.against.average.total) +
      parseFloat(stats2.goals.for.average.total) +
      parseFloat(stats2.goals.against.average.total);

    const mediaTotal = mediaGols / 2;

    const probs = {
      "Over 0.5": Math.min(99, Math.round((1 - Math.exp(-mediaTotal / 0.6)) * 100)),
      "Over 1.5": Math.min(99, Math.round((1 - Math.exp(-mediaTotal / 1.4)) * 100)),
      "Over 2.5": Math.min(99, Math.round((1 - Math.exp(-mediaTotal / 2.2)) * 100)),
      "Under 0.5": Math.max(1, 100 - Math.round((1 - Math.exp(-mediaTotal / 0.6)) * 100)),
      "Under 1.5": Math.max(1, 100 - Math.round((1 - Math.exp(-mediaTotal / 1.4)) * 100)),
      "Under 2.5": Math.max(1, 100 - Math.round((1 - Math.exp(-mediaTotal / 2.2)) * 100))
    };

    const oddsMercado = oddsData?.response?.[0]?.bookmakers?.find(b =>
      b.bets?.some(m => m.name.toLowerCase().includes('over/under'))
    )?.bets?.find(m => m.name.toLowerCase().includes('over/under'))?.values || [];

    const analise = [];

    for (const mercado of ["Over 0.5", "Over 1.5", "Over 2.5", "Under 0.5", "Under 1.5", "Under 2.5"]) {
      const oddObj = oddsMercado.find(o => o.value === mercado);
      if (!oddObj) continue;

      const odd = parseFloat(oddObj.odd);
      const probImpl = Math.round((1 / odd) * 100);
      const edge = probs[mercado] - probImpl;

      analise.push({
        mercado,
        odd,
        probReal: probs[mercado],
        probImpl,
        edge
      });
    }

    if (analise.length === 0) {
      container.innerHTML = '⚠️ Odds de Over/Under não disponíveis.';
      return;
    }

    let html = `<strong>📊 Detecção de Valor — ${matchName}</strong><br><ul style="line-height:1.6; padding-left:18px">`;
    analise.forEach(({ mercado, odd, probReal, probImpl, edge }) => {
      const destaque =
        edge >= 8
          ? `🔥 <strong style="color:green">${mercado} com +${edge.toFixed(1)}% de valor esperado</strong>`
          : edge <= -8
          ? `⚠️ <strong style="color:red">${mercado} com ${edge.toFixed(1)}% de valor esperado</strong>`
          : `${mercado} com ${edge >= 0 ? '+' : ''}${edge.toFixed(1)}% de valor esperado`;

      html += `<li>${destaque} (Odd: ${odd}, Real: ${probReal}%, Implícita: ${probImpl}%)</li>`;
    });
    html += '</ul>';

    container.innerHTML = html;
  } catch (error) {
    console.error('❌ Erro ao detectar valor:', error);
    container.innerHTML = '❌ Erro ao detectar valor estatístico.';
  }
}















async function carregarJogos() {
  let todosJogos = [];

  for (let data of datasBusca) {
    const response = await fetch(`/api/fixtures?date=${data}`);
    const json = await response.json();
    todosJogos = todosJogos.concat(json.response);
  }

  const agora = new Date();
  const duasHorasAtras = new Date(agora.getTime() - 2 * 60 * 60 * 1000);

  const jogos = todosJogos.filter(jogo => {
    const status = jogo.fixture?.status?.short;
    const horarioJogo = new Date(jogo.fixture?.date);
    const statusPermitidos = ['NS', '1H', 'HT', '2H', 'ET', 'P'];
    return statusPermitidos.includes(status) && horarioJogo >= duasHorasAtras;
  });

  const container = document.getElementById('jogos-container');
  container.innerHTML = '';

  if (jogos.length === 0) {
    container.innerHTML = '<p>⚠️ Nenhum jogo relevante encontrado hoje.</p>';
    return;
  }

  jogosTotais = jogos.map(jogo => ({
    id: jogo.fixture.id,
    home: jogo.teams.home.name,
    away: jogo.teams.away.name,
    horario: new Date(jogo.fixture.date).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit'
    }),
    jogoOriginal: jogo
  }));

  renderizarPagina(paginaAtual);
  criarPaginacao();
}

function renderizarPagina(pagina) {
  const container = document.getElementById('jogos-container');
  container.innerHTML = '';

  const inicio = (pagina - 1) * jogosPorPagina;
  const fim = inicio + jogosPorPagina;
  const jogosPagina = jogosTotais.slice(inicio, fim);

  if (jogosPagina.length === 0) {
    container.innerHTML = '<p>Nenhum jogo nesta página.</p>';
    return;
  }

  jogosPagina.forEach(async item => {
    const jogo = item.jogoOriginal;

    // 🔎 Verificações seguras
    const id = jogo.fixture?.id;
    const nomeTimes = `${jogo.teams?.home?.name} x ${jogo.teams?.away?.name}`;
    const horario = new Date(jogo.fixture?.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dataFormatada = new Date(jogo.fixture?.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

    const homeId = parseInt(jogo.teams?.home?.id);
    const awayId = parseInt(jogo.teams?.away?.id);
    const leagueId = parseInt(jogo.league?.id);
    const season = parseInt(jogo.league?.season);

    // 🛡️ Debug: Confirmação dos valores
    console.log(`📊 ${nomeTimes} | homeId: ${homeId}, awayId: ${awayId}, leagueId: ${leagueId}, season: ${season}`);

    // Se algum parâmetro essencial for inválido, nem renderiza
    if (!homeId || !awayId || !leagueId || !season || !id) {
      console.warn(`⚠️ Dados incompletos para o jogo ID ${id}. Ignorado.`);
      return;
    }

    const partidaEl = document.createElement('div');
    partidaEl.classList.add('jogo');

    const dataDia = new Date(jogo.fixture?.date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
    
    partidaEl.innerHTML = `
      <h3>
  <img src="${jogo.teams.home.logo}" alt="Logo Home" style="height:20px; vertical-align:middle; margin-right:6px;">
  ${jogo.teams.home.name} x ${jogo.teams.away.name}
  <img src="${jogo.teams.away.logo}" alt="Logo Away" style="height:20px; vertical-align:middle; margin-left:6px;">
</h3>

      <p>${dataDia.charAt(0).toUpperCase() + dataDia.slice(1)}</p>
      <p>Horário: ${horario}</p>
    
  <div class="botoes" id="botoes-${id}">
    <button onclick="verEstatisticas(${id}, ${homeId}, ${awayId}, ${leagueId}, ${season}, '${nomeTimes}')">
      <i class="fas fa-chart-line"></i> Estatísticas
    </button>
    <button onclick="analisarComIA('${jogo.teams.home.name}', '${jogo.teams.away.name}', '${jogo.league.name}', '${dataFormatada}', ${id}, ${homeId}, ${awayId}, ${leagueId}, ${season})">
      <i class="fas fa-brain"></i> Análise IA
    </button>
    <button onclick="gerarPalpiteIA('${jogo.teams.home.name}', '${jogo.teams.away.name}', ${id}, ${homeId}, ${awayId}, ${leagueId}, ${season})">
      <i class="fas fa-lightbulb"></i> Palpite IA
    </button>
    <button onclick="verMapaProbabilidades(${id}, ${homeId}, ${awayId}, ${leagueId}, ${season}, '${nomeTimes}')">
      <i class="fas fa-chart-bar"></i> ProbMap
    </button>
    <button onclick="verTendenciaOculta(${id}, '${nomeTimes}', ${homeId}, ${awayId}, ${leagueId}, ${season})">
      <i class="fas fa-eye"></i> Tendência Oculta
    </button>
    <button onclick="analisarEntradaProfissional(${id}, '${nomeTimes}', 0, 0)">
      <i class="fas fa-user-secret"></i> Entrada Pro
    </button>
    <button onclick="detectarEdge(${id}, ${homeId}, ${awayId}, ${leagueId}, ${season}, '${nomeTimes}')">
      <i class="fas fa-percentage"></i> Detecção de Valor
    </button>
  </div>
  <div id="estatisticas-${id}" class="analise-ia"></div>
  <div id="analise-${id}" class="analise-ia"></div>
  <div id="palpite-${id}" class="analise-ia"></div>
  <div id="probmap-${id}" class="analise-ia"></div>
  <div id="tendencia-${id}" class="analise-ia"></div>
  <div id="entrada-${id}" class="analise-ia"></div>
  <div id="edge-${id}" class="analise-ia"></div>
`;



    container.appendChild(partidaEl);

    // 🔎 Carrega odds e detecta entrada profissional
    try {
      const oddsRes = await fetch(`/api/odds/${id}`);
      const oddsJson = await oddsRes.json();
      const oddsList = oddsJson?.data?.[0]?.odds || [];

      if (oddsList.length >= 2) {
        const oddInicial = parseFloat(oddsList[0].value);
        const oddFinal = parseFloat(oddsList[oddsList.length - 1].value);
        const variacao = oddInicial - oddFinal;
        const botoesContainer = document.querySelector(`#botoes-${id}`);

        if (variacao >= 0.10 && botoesContainer) {
          const btn = document.createElement('button');
          btn.textContent = '🎯 Detector de Entrada Profissional';
          btn.onclick = () => analisarEntradaProfissional(id, nomeTimes, oddInicial, oddFinal);
          botoesContainer.appendChild(btn);

          const entradaDiv = document.createElement('div');
          entradaDiv.id = `entrada-${id}`;
          entradaDiv.classList.add('analise-ia');
          partidaEl.appendChild(entradaDiv);
        }
      }
    } catch (error) {
      console.warn('Erro ao detectar entrada profissional:', error);
    }
  });
}


function criarPaginacao() {
  const paginacao = document.getElementById('paginacao');
  paginacao.innerHTML = '';

  const totalPaginas = Math.ceil(jogosTotais.length / jogosPorPagina);
  const blocosPorPagina = 10;

  const blocoAtual = Math.floor((paginaAtual - 1) / blocosPorPagina);
  const inicio = blocoAtual * blocosPorPagina + 1;
  const fim = Math.min(inicio + blocosPorPagina - 1, totalPaginas);

  if (blocoAtual > 0) {
    const btnAnterior = document.createElement('button');
    btnAnterior.textContent = '«';
    btnAnterior.onclick = () => {
      paginaAtual = inicio - 1;
      renderizarPagina(paginaAtual);
      criarPaginacao();
    };
    paginacao.appendChild(btnAnterior);
  }

  for (let i = inicio; i <= fim; i++) {
    const botao = document.createElement('button');
    botao.textContent = i;
    if (i === paginaAtual) botao.classList.add('ativo');
    botao.addEventListener('click', () => {
      paginaAtual = i;
      renderizarPagina(paginaAtual);
      criarPaginacao();
    });
    paginacao.appendChild(botao);
  }

  if (fim < totalPaginas) {
    const btnProximo = document.createElement('button');
    btnProximo.textContent = '»';
    btnProximo.onclick = () => {
      paginaAtual = fim + 1;
      renderizarPagina(paginaAtual);
      criarPaginacao();
    };
    paginacao.appendChild(btnProximo);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  carregarJogos();

  // 📌 Exportar funções para uso nos botões com onclick
  window.verEstatisticas = verEstatisticas;
  window.analisarComIA = analisarComIA;
  window.gerarPalpiteIA = gerarPalpiteIA;
  window.verMapaProbabilidades = verMapaProbabilidades;
  window.verTendenciaOculta = verTendenciaOculta;
  window.analisarEntradaProfissional = analisarEntradaProfissional;
  window.detectarArmadilha = detectarArmadilha;
  window.detectarEdge = detectarEdge;
});

