// public/chat.js

document.addEventListener('DOMContentLoaded', () => {
    // Conecta automaticamente ao mesmo host/porta do servidor
    const socket = io();
  
    // Logs de conexão
    socket.on('connect', () => {
      console.log('🟢 Socket conectado com ID:', socket.id);
    });
  
    socket.on('disconnect', () => {
      console.log('🔴 Socket desconectado!');
    });
  
    // Referências aos elementos do DOM
    const chatInput    = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const sendButton   = document.getElementById('send-button');
  
    // Verifica se todos os elementos existem antes de registrar eventos
    if (!chatInput || !chatMessages || !sendButton) {
      console.error('❌ Elementos do chat não encontrados no DOM.');
      return;
    }
  
    // Função para adicionar uma mensagem ao chat
    const appendMessage = (msg) => {
      const div = document.createElement('div');
      div.textContent = msg;
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };
  
    // Envia ao clicar no botão
    sendButton.addEventListener('click', () => {
      const message = chatInput.value.trim();
      if (message !== '') {
        console.log('🟠 Botão clicado!', message);
        appendMessage(message);           // adiciona localmente
        socket.emit('sendMessage', message); // envia aos outros clientes
        chatInput.value = '';
      }
    });
  
    // Envia ao pressionar Enter
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const message = chatInput.value.trim();
        if (message !== '') {
          console.log('🟠 Enter pressionado!', message);
          appendMessage(message);
          socket.emit('sendMessage', message);
          chatInput.value = '';
        }
      }
    });
  
    // Recebe e renderiza mensagens enviadas por outros clientes
    socket.on('receiveMessage', (msg) => {
      console.log('🔵 Mensagem recebida no client:', msg);
      appendMessage(msg);
    });
  });
  