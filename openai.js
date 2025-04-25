  export async function gerarAnaliseChatGPT(promptUser) {
    const apiKey = process.env.OPENAI_API_KEY;
    const endpoint = "https://api.openai.com/v1/chat/completions";
    console.log('aqui')
  
    const body = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Você é um analista tático de futebol que escreve como um scout profissional." },
        { role: "user", content: promptUser }
      ],
      temperature: 0.7
    };
  
    const resposta = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  
    const data = await resposta.json();
    return data.choices?.[0]?.message?.content || "❌ Erro ao gerar análise com IA.";
  }
  