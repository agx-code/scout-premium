document.addEventListener('DOMContentLoaded', () => {
  let nick = localStorage.getItem('scouteiNick') || '';
  let replyingTo = null; // Adicionado: controle de reply

  const toggleBtn     = document.getElementById('chat-toggle');
  const widget        = document.getElementById('chat-widget');
  const closeBtn      = document.getElementById('chat-close');
  const body          = document.getElementById('chat-body');
  const input         = document.getElementById('chat-input');
  const sendBtn       = document.getElementById('chat-send');
  const nickContainer = document.getElementById('nick-container');
  const nickInput     = document.getElementById('nick-input');
  const nickSend      = document.getElementById('nick-send');
  const chatFooter    = document.getElementById('chat-footer');
  const replyBox      = document.createElement('div'); // Caixa de reply
  replyBox.id = 'reply-box';
  replyBox.style = 'padding:6px 12px; background:#f3f4f6; border-left:4px solid #2563eb; font-size:0.8rem; margin-bottom:6px; display:none;';
  chatFooter.insertBefore(replyBox, chatFooter.firstChild);

  toggleBtn.addEventListener('click', () => {
    widget.classList.toggle('active');
    if (!widget.classList.contains('active')) return;

    if (nick) {
      nickContainer.style.display = 'none';
      chatFooter.style.display    = 'flex';
      input.focus();
    } else {
      nickContainer.style.display = 'block';
      chatFooter.style.display    = 'none';
      nickInput.focus();
    }
  });

  closeBtn.addEventListener('click', () => {
    widget.classList.remove('active');
  });

  nickSend.addEventListener('click', () => {
    const val = nickInput.value.trim();
    if (!val) {
      nickInput.focus();
      return;
    }
    nick = val;
    localStorage.setItem('scouteiNick', nick);
    nickContainer.style.display = 'none';
    chatFooter.style.display    = 'flex';
    input.focus();
  });

  const socket = io();
  socket.on('connect',    () => console.log('🔌 Conectado:', socket.id));
  socket.on('disconnect', () => console.log('🔌 Desconectado'));

  function addMsg({ text, time, nick: origem, reply }, mine) {
    const el = document.createElement('div');
    el.classList.add('message-bubble', mine ? 'my-message' : 'other-message');
    el.innerHTML = `
      <div class="message-nick">
        <img src="/avatar-default.png" alt="avatar" class="avatar-img">
        ${origem}
      </div>
      ${reply ? `<div class="reply-info">↪️ Resposta a <strong>${reply.nick}</strong>: "${reply.text}"</div>` : ''}
      <div class="message-text">${text}</div>
      <span class="message-meta">${time}</span>
    `;
    // Adiciona evento de reply ao clicar na mensagem
    el.addEventListener('click', () => {
      replyingTo = { nick: origem, text: text };
      replyBox.style.display = 'block';
      const limitText = text.length > 80 ? text.slice(0, 80) + '…' : text;
replyBox.innerHTML = `
  Respondendo a <strong>${origem}</strong>: "${limitText}" 
  <button id="cancel-reply" style="margin-left:8px; background:#f87171; color:white; border:none; padding:2px 8px; border-radius:4px; cursor:pointer;">
    Cancelar
  </button>
`;

      document.getElementById('cancel-reply').addEventListener('click', () => {
        replyingTo = null;
        replyBox.style.display = 'none';
      });
    });

    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  function send() {
    const txt = input.value.trim();
    if (!txt || !nick) return;
    const now  = new Date();
    const time = now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    const msg  = { text: txt, time, nick, reply: replyingTo };
    addMsg(msg, true);
    socket.emit('sendMessage', msg);
    input.value = '';
    input.focus();
    replyingTo = null;
    replyBox.style.display = 'none';
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  });

  // Autoexpande o textarea conforme o usuário digita
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = (input.scrollHeight) + 'px';
});


  socket.on('receiveMessage', msg => {
    addMsg(msg, false);
  });
});
