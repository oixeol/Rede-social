/* Vibra - núcleo do cliente: estado, helpers, navegação e componentes comuns. */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const state = {
  config: {
    app: { name: 'Vibra', slug: 'vibra', tagline: 'Conexões que fazem sentido.' },
    interests: [],
    identity: { mode: 'dev', simulation: true, configured: true },
  },
  me: null,
  stats: null,
  unreadMessages: 0,
  unreadNotifications: 0,
  view: 'home',
  params: {},
  profile: null,
  feed: [],
  storyGroups: [],
  conversations: [],
  activeConversation: null,
  dating: {
    tab: 'discover',
    status: null,
    discover: null,
    matches: null,
    radar: null,
    profileData: null,
    radarBusy: false,
  },
  timers: new Set(),
};

/* ------------------------------------------------------------------ */
/* Ícones                                                             */
/* ------------------------------------------------------------------ */

const ICONS = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7v9.2a1.3 1.3 0 0 1-1.3 1.3h-4.7v-6.6H9.5V21H4.8a1.3 1.3 0 0 1-1.3-1.3z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16.2 16.2 4.3 4.3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9z"/>',
  spark:
    '<path d="M11 3.8c.7 4 2.9 6.2 6.9 6.9-4 .7-6.2 2.9-6.9 6.9-.7-4-2.9-6.2-6.9-6.9 4-.7 6.2-2.9 6.9-6.9z"/><path d="M18.5 2.8v3M17 4.3h3"/>',
  message: '<path d="M20.5 11.3a7.9 7.9 0 0 1-8.1 7.9 8.7 8.7 0 0 1-3.3-.8L4 20l1.6-4.7a7.6 7.6 0 0 1-.9-3.6 7.9 7.9 0 0 1 8.1-7.9 7.9 7.9 0 0 1 7.7 7.5z"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M4.5 20c.8-3.6 3.7-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M2.8 19c.7-3.2 3.1-4.8 6.2-4.8s5.5 1.6 6.2 4.8"/><path d="M16 5.4a3.2 3.2 0 0 1 0 6.2M17.5 14.4c2 .5 3.3 1.9 3.7 4.1"/>',
  plus: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/>',
  heart: '<path d="M12 20.2s-7.6-4.6-9.2-9A5.1 5.1 0 0 1 12 6.4a5.1 5.1 0 0 1 9.2 4.8c-1.6 4.4-9.2 9-9.2 9z"/>',
  comment: '<path d="M20.5 11.3a7.9 7.9 0 0 1-8.1 7.9 8.7 8.7 0 0 1-3.3-.8L4 20l1.6-4.7a7.6 7.6 0 0 1-.9-3.6 7.9 7.9 0 0 1 8.1-7.9 7.9 7.9 0 0 1 7.7 7.5z"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4"/>',
  bell: '<path d="M18 9.5a6 6 0 0 0-12 0c0 5.2-2 6.5-2 6.5h16s-2-1.3-2-6.5z"/><path d="M9.7 19a2.4 2.4 0 0 0 4.6 0"/>',
  send: '<path d="m21 3.5-7.2 17-3.1-6.7L4 10.6z"/><path d="M10.7 13.8 21 3.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.3 4.3L19 7"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M7 7l.8 12.2h8.4L17 7"/><path d="M10.2 10.5v5.5M13.8 10.5v5.5"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
  logout: '<path d="M14.5 4.5H6.8A1.3 1.3 0 0 0 5.5 5.8v12.4a1.3 1.3 0 0 0 1.3 1.3h7.7"/><path d="M17 8.5 20.5 12 17 15.5M10 12h10"/>',
  camera: '<path d="M4.5 8.5h3l1.5-2h6l1.5 2h3a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5v-6.5a1.5 1.5 0 0 1 1.5-1.5z"/><circle cx="12" cy="12.5" r="3.2"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m5.5 17 4.3-4.2a1.6 1.6 0 0 1 2.2 0l2.4 2.4 1.7-1.6a1.6 1.6 0 0 1 2.2 0l2.2 2"/>',
  video: '<rect x="3" y="5.5" width="12.5" height="13" rx="2.5"/><path d="m15.5 10 5.5-3v10l-5.5-3z"/>',
  more:
    '<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  shield:
    '<path d="M12 3.2 20 6v5.4c0 4.7-3.2 7.9-8 9.4-4.8-1.5-8-4.7-8-9.4V6z"/><path d="m8.6 12 2.4 2.4 4.6-4.7"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.4"/><path d="M8.3 10.5V8a3.7 3.7 0 0 1 7.4 0v2.5"/>',
  mapPin: '<path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0c0 5 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  radar: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><path d="M12 12 18 6.5"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="7" cy="17" r="2.2"/>',
  flag: '<path d="M5.5 21V4h9l-1 3h6l-1.4 4L19 15h-6.5l-1-3H5.5"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 18 12-12"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M8 3.5v4M16 3.5v4M3.5 10h17"/>',
  play: '<path d="M8 5.2v13.6L19 12z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  volume: '<path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 9a4.5 4.5 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>',
  volumeOff: '<path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="m16.5 9.5 5 5M21.5 9.5l-5 5"/>',
  eye: '<path d="M2.8 12S6.2 6.2 12 6.2 21.2 12 21.2 12 17.8 17.8 12 17.8 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.8"/>',
  alert: '<path d="M12 3.5 21 20H3z"/><path d="M12 9v5M12 17.2v.1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
  edit: '<path d="M4 20h4.3L20 8.3a2.2 2.2 0 0 0-3.1-3.1L5 17v3z"/><path d="m14.8 6.2 3 3"/>',
  link: '<path d="M9.5 14.5 14.5 9.5"/><path d="M7.8 17.9 6.1 19.6a3.6 3.6 0 0 1-5.1-5.1l3-3a3.6 3.6 0 0 1 5.1 0"/><path d="m16.2 6.1 1.7-1.7a3.6 3.6 0 0 1 5.1 5.1l-3 3a3.6 3.6 0 0 1-5.1 0"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  filter: '<path d="M3.5 5.5h17l-6.5 7.5v5.5l-4 1.5v-7z"/>',
};

export function icon(name, size = 24) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;
}

export function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach((element) => {
    element.innerHTML = icon(element.dataset.icon);
  });
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                         */
/* ------------------------------------------------------------------ */

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

export function formatCount(value) {
  const number = Number(value) || 0;
  if (number >= 1000000) return `${(number / 1000000).toFixed(1).replace('.', ',')} mi`;
  if (number >= 1000) return `${(number / 1000).toFixed(1).replace('.', ',')} mil`;
  return String(number);
}

export function plural(value, singular, pluralForm) {
  return Number(value) === 1 ? singular : pluralForm;
}

export function relTime(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function longDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function initialsFor(user) {
  const source = (user.name || user.username || '?').trim();
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function avatar(user, size = 36, className = '') {
  if (!user) return '';
  if (user.avatar) {
    return `<img class="avatar ${className}" src="${esc(user.avatar)}" alt="Foto de ${esc(user.username)}" width="${size}" height="${size}" style="width:${size}px;height:${size}px" loading="lazy" />`;
  }
  return `<span class="avatar avatar-fallback ${className}" style="width:${size}px;height:${size}px;font-size:${Math.max(10, Math.round(size * 0.38))}px" aria-hidden="true">${esc(initialsFor(user))}</span>`;
}

export function interestLabel(id) {
  return state.config.interests.find((item) => item.id === id)?.label || id;
}

export function interestChips(ids, className = '') {
  const list = (ids || []).map((id) => interestLabel(id)).filter(Boolean);
  if (!list.length) return '';
  return `<div class="chips ${className}">${list.map((label) => `<span class="chip chip-static">${esc(label)}</span>`).join('')}</div>`;
}

export function mediaMarkup(post, alt = '') {
  const label = esc(alt || post.caption || 'Publicação');
  if (post.mediaType === 'video') {
    return `<video src="${esc(post.image)}" controls playsinline preload="metadata" aria-label="${label}"></video>`;
  }
  return `<img src="${esc(post.image)}" alt="${label}" loading="lazy" />`;
}

export function emptyState({ iconName = 'compass', title, text, action = '' }) {
  return `<div class="empty-state">
    <div class="empty-icon">${icon(iconName, 30)}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    ${action}
  </div>`;
}

export function loadingBlock(label = 'Carregando...') {
  return `<div class="page-loading" role="status">
    <span class="spinner" aria-hidden="true"></span>
    <span>${esc(label)}</span>
  </div>`;
}

export function setBusy(button, isBusy) {
  if (!button) return;
  if (isBusy) {
    if (!button.dataset.idleHtml) button.dataset.idleHtml = button.innerHTML;
    button.disabled = true;
    button.classList.add('is-busy');
    button.setAttribute('aria-busy', 'true');
  } else {
    button.disabled = false;
    button.classList.remove('is-busy');
    button.removeAttribute('aria-busy');
    if (button.dataset.idleHtml) {
      button.innerHTML = button.dataset.idleHtml;
      delete button.dataset.idleHtml;
    }
  }
}

export async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    if (response.status === 401 && state.me) showAuth();
    const error = new Error(data.error || 'Não foi possível concluir a ação.');
    error.status = response.status;
    error.code = data.code || null;
    error.details = data.details || null;
    throw error;
  }
  return data;
}

export function toast(message, kind = '') {
  const root = $('#toast-root');
  if (!root) return;
  const element = document.createElement('div');
  element.className = `toast ${kind}`;
  element.textContent = message;
  root.appendChild(element);
  setTimeout(() => {
    element.classList.add('leaving');
    setTimeout(() => element.remove(), 220);
  }, 3200);
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

export function uploadVideo(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/uploads/video');
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) {
        resolve(data.url);
        return;
      }
      if (xhr.status === 401 && state.me) showAuth();
      const error = new Error(data.error || 'Não foi possível enviar o vídeo.');
      error.status = xhr.status;
      reject(error);
    };
    xhr.onerror = () => reject(new Error('Falha de conexão ao enviar o vídeo.'));
    xhr.onabort = () => reject(new Error('Envio do vídeo cancelado.'));
    xhr.send(file);
  });
}

export function addTimer(timer) {
  state.timers.add(timer);
  return timer;
}

export function clearTimers() {
  for (const timer of state.timers) clearInterval(timer);
  state.timers.clear();
}

/* ------------------------------------------------------------------ */
/* Tema                                                              */
/* ------------------------------------------------------------------ */

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem('vibra-theme', theme);
  const dark = theme === 'dark';
  $$('[data-theme-icon]').forEach((element) => {
    element.innerHTML = icon(dark ? 'sun' : 'moon');
  });
  $$('[data-theme-label]').forEach((element) => {
    element.textContent = dark ? 'Tema claro' : 'Tema escuro';
  });
}

export function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  const saved = localStorage.getItem('vibra-theme');
  const preferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(saved || preferred);
}

/* ------------------------------------------------------------------ */
/* Modal                                                              */
/* ------------------------------------------------------------------ */

let pendingConfirm = null;

export function openModal(markup, className = '') {
  if (pendingConfirm) {
    pendingConfirm(false);
    pendingConfirm = null;
  }
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal ${className}" role="dialog" aria-modal="true">${markup}</div></div>`;
  document.body.classList.add('modal-open');
  hydrateIcons(root);
  const modal = $('.modal', root);
  const focusable = modal.querySelector('input, textarea, select, button');
  if (focusable) setTimeout(() => focusable.focus(), 30);
  return modal;
}

export function closeModal() {
  const root = $('#modal-root');
  if (!root || !root.innerHTML) return;
  root.innerHTML = '';
  document.body.classList.remove('modal-open');
  if (pendingConfirm) {
    const resolve = pendingConfirm;
    pendingConfirm = null;
    resolve(false);
  }
}

export function confirmDialog({
  title,
  body,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
}) {
  return new Promise((resolve) => {
    const settle = (value) => {
      if (pendingConfirm) pendingConfirm = null;
      closeModal();
      resolve(value);
    };
    const modal = openModal(
      `<div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-confirm-no aria-label="Fechar">${icon('close')}</button></div>
       <div class="confirm-body"><p>${esc(body)}</p></div>
       <div class="modal-actions">
         <button type="button" class="btn ghost" data-confirm-no>${esc(cancelLabel)}</button>
         <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-confirm-yes>${esc(confirmLabel)}</button>
       </div>`,
      'confirm-modal'
    );
    pendingConfirm = settle;
    modal.querySelector('[data-confirm-yes]').addEventListener('click', () => settle(true));
    $$('[data-confirm-no]', modal).forEach((button) => button.addEventListener('click', () => settle(false)));
  });
}

/* ------------------------------------------------------------------ */
/* Autenticação e shell                                               */
/* ------------------------------------------------------------------ */

export function setAuthTab(tab) {
  const isLogin = tab === 'login';
  $('#login-form').classList.toggle('hidden', !isLogin);
  $('#register-form').classList.toggle('hidden', isLogin);
  $$('.auth-switch [data-when]').forEach((element) => {
    element.classList.toggle('hidden', element.dataset.when !== tab);
  });
  $('#auth-title').textContent = isLogin ? 'Bem-vindo de volta' : 'Crie seu espaço';
  $('#auth-subtitle').textContent = isLogin
    ? 'Entre para acompanhar as pessoas e os interesses que você escolheu.'
    : 'Um perfil social leve. O Namoro é opcional e tem verificação própria.';
  const authError = $('#auth-error');
  if (authError) authError.textContent = '';
  const registerError = $('#register-form .form-error');
  if (registerError) registerError.textContent = '';
  const registerBirth = $('#register-form input[name="birthDate"]');
  if (registerBirth) {
    const max = new Date();
    max.setFullYear(max.getFullYear() - 13);
    registerBirth.max = max.toISOString().slice(0, 10);
  }
  const focusField = (isLogin ? $('#login-form') : $('#register-form')).querySelector('input');
  if (focusField) setTimeout(() => focusField.focus(), 40);
}

export function showAuth(tab = 'login') {
  state.me = null;
  state.profile = null;
  clearTimers();
  $('#app-shell').classList.add('hidden');
  $('#auth-screen').classList.remove('hidden');
  setAuthTab(tab);
}

export function refreshNavAvatar() {
  const markup = state.me ? avatar(state.me, 30) : icon('user');
  const top = $('#top-avatar');
  if (top) top.innerHTML = markup;
  const bottom = $('#bottom-avatar');
  if (bottom) bottom.innerHTML = markup;
}

export function refreshBadges() {
  const values = {
    messages: state.unreadMessages,
    notifications: state.unreadNotifications,
  };
  $$('[data-badge]').forEach((element) => {
    const value = values[element.dataset.badge] || 0;
    element.hidden = value <= 0;
    element.textContent = value > 9 ? '9+' : String(value);
  });
}

export function setUnread({ messages, notifications } = {}) {
  if (Number.isFinite(messages)) state.unreadMessages = messages;
  if (Number.isFinite(notifications)) state.unreadNotifications = notifications;
  refreshBadges();
}

export function applyAppConfig(config) {
  if (!config) return;
  state.config = {
    ...state.config,
    ...config,
    app: { ...state.config.app, ...(config.app || {}) },
  };
  const name = state.config.app.name || 'Vibra';
  document.title = name;
  $$('[data-brand-name]').forEach((element) => {
    element.textContent = name;
  });
  const meta = $('meta[name="description"]');
  if (meta) meta.content = `${name} - ${state.config.app.tagline || state.config.app.description || 'rede social'}`;
  const tagline = $('[data-brand-tagline]');
  if (tagline && state.config.app.tagline) tagline.textContent = state.config.app.tagline;
}

export async function loadConfig() {
  try {
    const config = await api('/api/config');
    applyAppConfig(config);
    return config;
  } catch {
    return state.config;
  }
}

/* ------------------------------------------------------------------ */
/* Navegação                                                          */
/* ------------------------------------------------------------------ */

const views = new Map();
let beforeNavigate = [];

export function registerView(name, render) {
  views.set(name, render);
}

export function onBeforeNavigate(callback) {
  beforeNavigate.push(callback);
}

export function renderNavActive() {
  $$('[data-nav]').forEach((element) => {
    const active = element.dataset.nav === state.view;
    element.classList.toggle('active', active);
    if (active) element.setAttribute('aria-current', 'page');
    else element.removeAttribute('aria-current');
  });
}

export async function navigate(view, params = {}) {
  if (!state.me) return;
  closeModal();
  for (const callback of beforeNavigate) {
    try {
      callback();
    } catch {
      /* um callback com problema não deve impedir a navegação */
    }
  }
  clearTimers();
  state.view = view;
  state.params = params || {};
  renderNavActive();
  const viewElement = $('#view');
  viewElement.innerHTML = loadingBlock();
  window.scrollTo({ top: 0, behavior: 'auto' });

  const renderer = views.get(view);
  try {
    if (!renderer) throw new Error('Área indisponível.');
    await renderer(viewElement, state.params);
    if (state.view === view) hydrateIcons(viewElement);
  } catch (error) {
    if (state.view !== view) return;
    if (error.status === 401) {
      showAuth();
      return;
    }
    viewElement.innerHTML = `<div class="page"><div class="empty-state">
      <div class="empty-icon">${icon('alert', 30)}</div>
      <h3>Não foi possível carregar esta área</h3>
      <p>${esc(error.message)}</p>
      <button type="button" class="btn primary" data-action="retry-view">Tentar de novo</button>
    </div></div>`;
    toast(error.message, 'error');
  }
}

export async function enterApp() {
  $('#auth-screen').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');
  refreshNavAvatar();
  refreshBadges();
  await navigate('home');
}

export function goToProfile(username) {
  return navigate('profile', { username });
}
