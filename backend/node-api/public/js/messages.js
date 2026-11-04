/* Vibra - mensagens sociais e conversas de match. */
/**
 * Sistema de mensagens do Vibra.
 *
 * Trata de conversas sociais e de matches de namoro.
 *
 * Endpoints utilizados:
 *   - GET /api/conversations           → lista de conversas
 *   - GET /api/conversations/:id      → thread completa
 *   - POST /api/conversations/:id/messages
 * Polling: a cada 10 segundos, se a quantidade de mensagens mudou a thread é atualizada
 */

import {
  $,
  $$,
  state,
  icon,
  hydrateIcons,
  esc,
  formatCount,
  relTime,
  avatar,
  mediaMarkup,
  emptyState,
  api,
  toast,
  setBusy,
  navigate,
  addTimer,
  setUnread,
  interestChips,
} from './core.js';
import { openReportModal, blockUser, openPost } from './social-actions.js';

/**
 * Retorna rótulo de conversa.
 *
 * @param {string} kind Tipo de conversa: 'dating' ou 'social'.
 * @returns {string} Rótulo exibido na UI.
 */
function kindLabel(kind) {
  return kind === 'dating' ? 'Match' : 'Social';
}

/**
 * Resume a última mensagem de uma conversa.
 *
 * @param {object} conversation Conversa do estado.
 * @returns {string} Texto, aviso de post compartilhado ou mensagem padrão.
 */
function lastMessageText(conversation) {
  // Sem histórico: a prévia convida a iniciar uma conversa.
  if (!conversation.lastMessage) return 'Comece a conversa.';
  // Caso normal: mostra o corpo textual da última mensagem.
  if (conversation.lastMessage.body) return conversation.lastMessage.body;
  // Caso de post compartilhado: não há corpo, mas há referência a uma publicação.
  if (conversation.lastMessage.sharedPostId) return 'Compartilhou uma publicação.';
  // Fallback para mensagens sem corpo textual nem post compartilhado.
  return 'Mensagem';
}

/**
 * Renderiza a linha de conversa na lista.
 *
 * Inclui avatar, nome, horário, pré-visualização, contador de não lidas e destaque de conversa ativa.
 *
 * @param {object} conversation Dados da conversa.
 * @param {number|null} activeId ID do ID da conversa ativa.
 * @returns {string} Markup HTML.
 */
function conversationItem(conversation, activeId) {
  // A conversa ativa recebe a classe "active" para destacar a seleção atual.
  const active = conversation.id === activeId;
  return `
    <button type="button" class="conversation-item ${active ? 'active' : ''}" data-action="open-conversation" data-id="${conversation.id}">
      <span class="conversation-avatar">${avatar(conversation.other, 48)}</span>
      <span class="conversation-main">
        <span class="conversation-top">
          <strong>${esc(conversation.other.name)}</strong>
          <time>${relTime(conversation.updatedAt)}</time>
        </span>
        <span class="conversation-bottom">
          <span class="conversation-preview">${esc(lastMessageText(conversation))}</span>
          ${conversation.unread > 0 ? `<span class="conversation-unread">${conversation.unread > 9 ? '9+' : conversation.unread}</span>` : ''}
        </span>
        <span class="kind-pill ${conversation.kind}">${kindLabel(conversation.kind)}</span>
      </span>
    </button>`;
}

/**
 * Exibe uma etiqueta de data para um carimbo de tempo.
 *
 * Se for hoje retorna "Hoje", ontem "Ontem" ou uma data formatada.
 *
 * @param {number} timestamp DataUTC em milissegundos.
 * @returns {string}
 */
function dayLabel(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(date, today)) return 'Hoje';
  if (same(date, yesterday)) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

/**
 * Desenha uma bolha de mensagem.
 *
 * @param {object} message Objeto da mensagem com texto, post compartilhado e metadados.
 * @returns {string} Markup HTML da bolha.
 */
function messageBubble(message) {
  const shared = message.sharedPost;
  return `
    <div class="message-row ${message.mine ? 'mine' : 'theirs'}" data-message-id="${message.id}">
      <div class="message-bubble">
        ${message.body ? `<p>${esc(message.body).replace(/\n/g, '<br />')}</p>` : ''}
        ${shared ? `
          <button type="button" class="message-shared-post" data-action="open-shared-post" data-id="${shared.id}">
            ${shared.mediaType === 'video'
              ? `<video src="${esc(shared.image)}" muted playsinline preload="metadata" aria-hidden="true"></video>`
              : `<img src="${esc(shared.image)}" alt="" />`}
            <span><strong>@${esc(shared.user.username)}</strong><small>${esc(shared.caption || 'Publicação compartilhada')}</small></span>
          </button>` : ''}
        <span class="message-meta">${relTime(message.createdAt)}${message.mine ? ' · enviada' : ''}</span>
      </div>
      ${!message.mine ? `<button type="button" class="message-report" data-action="report-message" data-id="${message.id}" aria-label="Denunciar mensagem">${icon('flag', 13)}</button>` : ''}
    </div>`;
}

/**
 * Monta a lista de mensagens com separadores de dia.
 *
 * @param {Array<object>} messages Mensagens ordenadas da thread.
 * @returns {string} Markup HTML da lista.
 */
function messagesList(messages) {
  let lastDay = '';
  const rows = [];
  for (const message of messages) {
    const day = dayLabel(message.createdAt);
    if (day !== lastDay) {
      rows.push(`<div class="message-day"><span>${esc(day)}</span></div>`);
      lastDay = day;
    }
    rows.push(messageBubble(message));
  }
  return rows.join('');
}

/**
 * Monta a marcação completa da thread.
 *
 * @param {object} conversation Dados da conversa.
 * @param {object} other Usuário pelo outro lado da conversa.
 * @param {Array<object>} messages Mensagens da thread.
 * @param {boolean} canSend Se pode enviar novas mensagens.
 * @param {string|null} reason Motivo para bloqueio, se houver.
 * @returns {string} Markup HTML da thread.
 */
function threadMarkup(conversation, other, messages, canSend, reason) {
  const reasonText = reason === 'match_ended'
    ? 'Este match foi encerrado. O histórico continua visível, mas novas mensagens estão desativadas.'
    : reason === 'dating_locked'
      ? 'O Namoro exige verificação de identidade e idade aprovada para as duas pessoas. Regularize sua verificação para voltar a conversar.'
      : reason === 'messaging_policy'
        ? 'As preferências de mensagem desta pessoa não permitem novas mensagens suas.'
        : 'Não é possível enviar mensagens nesta conversa.';
  return `
    <header class="thread-head">
      <button type="button" class="icon-btn thread-back" data-action="messages-back" aria-label="Voltar para conversas">${icon('back')}</button>
      <button type="button" class="thread-person" data-action="thread-profile" data-username="${esc(other.username)}">
        ${avatar(other, 42)}
        <span class="user-meta">
          <strong>${esc(other.name)}</strong>
          <small>@${esc(other.username)} · ${kindLabel(conversation.kind)}</small>
        </span>
      </button>
      <div class="thread-actions">
        <button type="button" class="icon-btn tiny" data-action="thread-profile" data-username="${esc(other.username)}" aria-label="Ver perfil">${icon('user', 18)}</button>
        <button type="button" class="icon-btn tiny" data-action="report-thread-user" data-id="${other.id}" data-username="${esc(other.username)}" aria-label="Denunciar pessoa">${icon('flag', 18)}</button>
        <button type="button" class="icon-btn tiny" data-action="block-thread-user" data-username="${esc(other.username)}" aria-label="Bloquear pessoa">${icon('ban', 18)}</button>
      </div>
    </header>
    <div class="thread-messages" id="thread-messages" aria-live="polite">
      ${messages.length ? messagesList(messages) : `<div class="thread-empty">${icon('message', 26)}<p>Diga olá. Esta conversa ainda não tem mensagens.</p></div>`}
    </div>
    ${canSend
      ? `<form id="message-form" class="message-form" data-conversation="${conversation.id}" autocomplete="off">
          <textarea name="text" rows="1" maxlength="2000" placeholder="Escreva uma mensagem..." aria-label="Mensagem"></textarea>
          <button type="submit" class="btn primary send-btn" aria-label="Enviar mensagem">${icon('send', 18)}</button>
        </form>`
      : `<div class="thread-locked">${icon('lock', 18)}<p>${esc(reasonText)}</p></div>`}
  `;
}

/**
 * Renderiza a página de mensagens.
 *
 * Gerencia a lista de conversas, a thread aberta, polling e atualizações de não lidas.
 *
 * @param {HTMLElement} viewElement Elemento container da página.
 * @param {Object} params Parâmetros de navegação, pode conter `conversation`.
 */
export async function renderMessages(viewElement, params = {}) {
  const activeId = params.conversation ? Number(params.conversation) : null;
  state.activeConversation = activeId;
  const conversationsData = await api('/api/conversations');
  state.conversations = conversationsData.conversations;
  const conversation = activeId ? state.conversations.find((item) => item.id === activeId) : null;
  let thread = null;
  let loadError = null;
  if (activeId) {
    try {
      thread = await api(`/api/conversations/${activeId}`);
    } catch (error) {
      loadError = error;
    }
  }
  if (state.view !== 'messages') return;

  viewElement.innerHTML = `
    <div class="messages-page ${activeId ? 'messages-active' : ''}">
      <aside class="conversation-panel" aria-label="Lista de conversas">
        <header class="conversation-head">
          <div>
            <p class="eyebrow">Mensagens</p>
            <h1>Conversas</h1>
          </div>
          <button type="button" class="icon-btn" data-action="messages-refresh" aria-label="Atualizar conversas">${icon('compass', 18)}</button>
        </header>
        <div class="conversation-list">
          ${state.conversations.length
            ? state.conversations.map((item) => conversationItem(item, activeId)).join('')
            : `<div class="conversation-empty">
                <p>Nenhuma conversa ainda.</p>
                <button type="button" class="btn ghost small" data-action="nav" data-view="explore">Explorar pessoas</button>
              </div>`}
        </div>
      </aside>

      <section class="thread-panel ${activeId ? 'active' : ''}" aria-label="Conversa">
        ${loadError
          ? `<div class="thread-placeholder">${icon('alert', 28)}<h2>Conversa indisponível</h2><p>${esc(loadError.message)}</p><button type="button" class="btn ghost" data-action="messages-back">Voltar</button></div>`
          : thread
            ? threadMarkup(
                thread.conversation,
                thread.other,
                thread.messages,
                thread.conversation.canSend,
                thread.conversation.reason
              )
            : `<div class="thread-placeholder">
                <span class="thread-placeholder-icon">${icon('message', 34)}</span>
                <h2>Suas conversas em um só lugar</h2>
                <p>Converse com pessoas que você segue e com matches do Namoro. As permissões de cada área continuam valendo.</p>
                <button type="button" class="btn ghost" data-action="nav" data-view="explore">Descobrir pessoas</button>
              </div>`}
      </section>
    </div>`;

  hydrateIcons(viewElement);

  if (!loadError && thread) {
    const unread = conversation ? conversation.unread : 0;
    if (unread > 0) {
      await api(`/api/conversations/${activeId}/read`, { method: 'POST' }).catch(() => {});
      conversation.unread = 0;
      $(`.conversation-item[data-id="${activeId}"] .conversation-unread`)?.remove();
      setUnread({ messages: Math.max(0, state.unreadMessages - unread) });
      await refreshUnread();
    }
    const list = $('#thread-messages');
    if (list) list.scrollTop = list.scrollHeight;
    const textarea = $('#message-form textarea');
    if (textarea) {
      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(120, textarea.scrollHeight)}px`;
      });
      textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          const form = $('#message-form');
          if (form) form.requestSubmit();
        }
      });
      setTimeout(() => textarea.focus(), 40);
    }
    const interval = setInterval(async () => {
      if (state.view !== 'messages' || state.params.conversation !== activeId) return;
      try {
        const fresh = await api(`/api/conversations/${activeId}`);
        const container = $('#thread-messages');
        if (!container) return;
        const current = $$('.message-row', container).length;
        if (fresh.messages.length !== current) {
          container.innerHTML = messagesList(fresh.messages);
          container.scrollTop = container.scrollHeight;
          await api(`/api/conversations/${activeId}/read`, { method: 'POST' }).catch(() => {});
          await refreshUnread();
        }
      } catch {
        /* tenta novamente no próximo ciclo */
      }
    }, 10000);
    addTimer(interval);
  }
}

async function refreshUnread() {
  try {
    const me = await api('/api/me');
    state.me = me.user;
    state.stats = me.stats;
    setUnread({ messages: me.unreadMessages, notifications: me.unreadNotifications });
  } catch {
    /* mantém o valor atual */
  }
}

/* Atualiza a thread adicionando uma nova mensagem sem recarregar */
function appendMessage(message) {
  const container = $('#thread-messages');
  if (!container) return;
  const placeholder = container.querySelector('.thread-empty');
  if (placeholder) placeholder.remove();
  container.insertAdjacentHTML('beforeend', messageBubble(message));
  container.scrollTop = container.scrollHeight;
}

/* Atualiza a prévia da conversa sem recarregar a lista inteira */
function updateConversationPreview(conversationId, text) {
  const conversation = state.conversations.find((item) => item.id === conversationId);
  if (!conversation) return;
  conversation.lastMessage = { body: text, createdAt: Date.now(), mine: true };
  conversation.updatedAt = Date.now();
  const item = $(`.conversation-item[data-id="${conversationId}"]`);
  if (item) {
    const preview = item.querySelector('.conversation-preview');
    if (preview) preview.textContent = text;
    const time = item.querySelector('time');
    if (time) time.textContent = relTime(Date.now());
    item.parentElement.prepend(item);
  }
}

// Gerencia ações de UI na página de mensagens, como abrir chat, reportar e bloquear usuários.
export async function handleAction(action, target) {
  if (action === 'open-conversation') {
    await navigate('messages', { conversation: Number(target.dataset.id) });
    return true;
  }
  if (action === 'messages-back') {
    await navigate('messages');
    return true;
  }
  if (action === 'messages-refresh') {
    await navigate('messages', state.params.conversation ? { conversation: state.params.conversation } : {});
    return true;
  }
  if (action === 'thread-profile') {
    await navigate('profile', { username: target.dataset.username });
    return true;
  }
  if (action === 'report-message') {
    openReportModal({ targetType: 'message', targetId: Number(target.dataset.id), label: 'mensagem' });
    return true;
  }
  if (action === 'report-thread-user') {
    openReportModal({ targetType: 'user', targetId: Number(target.dataset.id), label: 'perfil' });
    return true;
  }
  if (action === 'block-thread-user') {
    const blocked = await blockUser(target.dataset.username);
    if (blocked) await navigate('messages');
    return true;
  }
  if (action === 'open-shared-post') {
    await openPost(Number(target.dataset.id));
    return true;
  }
  return false;
}

// Envia o formulário de mensagem para a conversa associated.
export async function handleSubmit(form, event) {
  if (form.id !== 'message-form') return false;
  event.preventDefault();
  const conversationId = Number(form.dataset.conversation);
  const textarea = form.querySelector('textarea');
  const raw = textarea.value;
  const text = raw.trim();
  if (!text) return true;
  const button = form.querySelector('button[type="submit"]');
  setBusy(button, true);
  try {
    const data = await api(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    appendMessage({ ...data.message, sharedPost: null });
    textarea.value = '';
    textarea.style.height = 'auto';
    textarea.focus();
    updateConversationPreview(conversationId, text);
  } finally {
    setBusy(button, false);
  }
  return true;
}
