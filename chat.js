const socket = io();  // 🔥 Isso conecta AUTOMATICAMENTE na MESMA porta do servidor!

socket.on('connect', () => {
  console.log('🟢 Socket conectado com ID:', socket.id);  // TEM QUE aparecer isso!
});

socket.on('disconnect', () => {
  console.log('🔴 Socket desconectado!');
});

const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const sendButton = document.getElementById('send-button');

if (sendButton) {
  sendButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message !== '') {
      console.log('🟠 Botão clicado!');
      socket.emit('sendMessage', message);
      chatInput.value = '';
    }
  });
}

socket.on('receiveMessage', (msg) => {
  console.log('🔵 Mensagem recebida no client:', msg);
  const div = document.createElement('div');
  div.textContent = msg;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});
