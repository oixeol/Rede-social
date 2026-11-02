/*
 * App.js – cliente Vanilla da rede social local.
 *
 * Estrutura:
 *  - `state` mantém o usuário autenticado (`me`), a view atual, usuários envolvidos e o filtro de pesquisa.
 *  - Funções auxiliares de DOM (`$`, `$$`) e utilitários de UI (`toast`, `setBusy`).
 *  - `api()` consome a API `/api/*` do backend, sempre usando `credentials: 'same-origin'`.
 *  - Modais e vídeo‑player são renderizados em `#modal-root` e `#story-root`.
 *  - Roteiro de navegação (`navigate`, `enterApp`) controla as 5 abas da aplicação (feed, explorar, namoro, mensagens, perfil).
 *  - `setAuthTab`/`showAuth` coordenam a tela de login/registro.
 *  - `applyTheme`/`toggleTheme` gerenciam o tema claro/escuro com persitência em localStorage.
 */
/* Vibe - cliente da rede social local */
(() => {
  'use strict';

  /* ---------------------------------------------------------------- */
  /* Helpers                                                          */
  /* ---------------------------------------------------------------- */

  /** Seleciona um único elemento via CSS. */
  const $ = (selector, root = document) => root.querySelector(selector);
  /** Seleciona todos os elementos via CSS como array. */
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /* Estado global da aplicação: usuário logado, view ativa e dados em cache. */
  const state = {
    me: null,
    view: 'feed',
    profileUsername: null,
    profile: null,
    feed: [],
    storyGroups: [],
  };

  /**
   * Catálogo de ícones SVG (path data) usados pela UI.
   * `icon()` monta o `<svg>` final; nomes ausentes renderizam vazio.
   */
  const ICONS = {
    home: '<path d="M3.5 10.5 12 3.5l8.5 7v9.2a1.3 1.3 0 0 1-1.3 1.3h-4.7v-6.6H9.5V21H4.8a1.3 1.3 0 0 1-1.3-1.3z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16.2 16.2 4.3 4.3"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9z"/>',
    plus: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M4.5 20c.8-3.6 3.7-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/>',
    heart: '<path d="M12 20.2s-7.6-4.6-9.2-9A5.1 5.1 0 0 1 12 6.4a5.1 5.1 0 0 1 9.2 4.8c-1.6 4.4-9.2 9-9.2 9z"/>',
    comment: '<path d="M20.5 11.3a7.9 7.9 0 0 1-8.1 7.9 8.7 8.7 0 0 1-3.3-.8L4 20l1.6-4.7a7.6 7.6 0 0 1-.9-3.6 7.9 7.9 0 0 1 8.1-7.9 7.9 7.9 0 0 1 7.7 7.5z"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m5.5 17 4.3-4.2a1.6 1.6 0 0 1 2.2 0l2.4 2.4 1.7-1.6a1.6 1.6 0 0 1 2.2 0l2.2 2"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M7 7l.8 12.2h8.4L17 7"/><path d="M10.2 10.5v5.5M13.8 10.5v5.5"/>',
    send: '<path d="m21 3.5-7.2 17-3.1-6.7L4 10.6z"/><path d="M10.7 13.8 21 3.5"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
    logout: '<path d="M14.5 4.5H6.8A1.3 1.3 0 0 0 5.5 5.8v12.4a1.3 1.3 0 0 0 1.3 1.3h7.7"/><path d="M17 8.5 20.5 12 17 15.5M10 12h10"/>',
    camera: '<path d="M4.5 8.5h3l1.5-2h6l1.5 2h3a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5v-6.5a1.5 1.5 0 0 1 1.5-1.5z"/><circle cx="12" cy="12.5" r="3.2"/>',
    check: '<path d="m5 12.5 4.3 4.3L19 7"/>',
    more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  };

  /** Gera o markup SVG de um ícone do catálogo `ICONS`. */
  function icon(name, size = 24) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  /** Substitui o conteúdo de todo `[data-icon]` pelo SVG correspondente. */
  function hydrateIcons(root = document) {
    $$('[data-icon]', root).forEach((element) => {
      element.innerHTML = icon(element.dataset.icon);
    });
  }

  /**
   * Escapa caracteres especiais de HTML.
   * Obrigatório antes de interpolar qualquer valor vindo do usuário ou da API
   * em templates de string — é a barreira contra XSS do lado do cliente.
   */
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]));
  }

  function formatCount(value) {
    const number = Number(value) || 0;
    if (number >= 1000000) return `${(number / 1000000).toFixed(1).replace('.', ',')} mi`;
    if (number >= 1000) return `${(number / 1000).toFixed(1).replace('.', ',')} mil`;
    return String(number);
  }

  function plural(value, singular, pluralForm) {
    return Number(value) === 1 ? singular : pluralForm;
  }

  function relTime(timestamp) {
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

  function initialsFor(user) {
    const source = (user.name || user.username || '?').trim();
    return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function avatar(user, size = 36, className = '') {
    if (!user) return '';
    if (user.avatar) {
      return `<img class="avatar ${className}" src="${esc(user.avatar)}" alt="Foto de ${esc(user.username)}" width="${size}" height="${size}" style="width:${size}px;height:${size}px" loading="lazy" />`;
    }
    return `<span class="avatar avatar-fallback ${className}" style="width:${size}px;height:${size}px;font-size:${Math.max(10, Math.round(size * 0.38))}px" aria-hidden="true">${esc(initialsFor(user))}</span>`;
  }

  /**
   * Chama a API `/api/*`.
   * Envia `credentials: 'same-origin'` para incluir o cookie de sessão.
   * Em resposta 401 com usuário logado, força o retorno à tela de autenticação.
   */
  async function api(path, options = {}) {
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
      if (response.status === 401 && state.me) {
        state.me = null;
        showAuth();
      }
      throw new Error(data.error || 'Não foi possível concluir a ação.');
    }
    return data;
  }

  /** Exibe uma mensagem temporária (2,8 s) na área de toasts. */
  function toast(message, kind = '') {
    const root = $('#toast-root');
    const element = document.createElement('div');
    element.className = `toast ${kind}`;
    element.textContent = message;
    root.appendChild(element);
    setTimeout(() => {
      element.classList.add('leaving');
      setTimeout(() => element.remove(), 220);
    }, 2800);
  }

  /**
   * Liga/desliga o estado "carregando" de um botão.
   * Preserva o rótulo original em `dataset.idleLabel` para restaurá-lo depois.
   */
  function setBusy(button, isBusy) {
    if (!button) return;
    if (isBusy) {
      button.dataset.idleLabel = button.textContent;
      button.disabled = true;
      button.classList.add('is-busy');
    } else {
      button.disabled = false;
      button.classList.remove('is-busy');
      if (button.dataset.idleLabel) button.textContent = button.dataset.idleLabel;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Theme                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Aplica o tema (claro/escuro) no documento e persiste a escolha.
   * O atributo `data-theme` no `<html>` é o gatilho de todas as variantes
   * visuais definidas em `public/styles.css`.
   */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('vibe-theme', theme);
    const dark = theme === 'dark';
    $$('[data-theme-icon]').forEach((element) => {
      element.innerHTML = icon(dark ? 'sun' : 'moon');
    });
    $$('[data-theme-label]').forEach((element) => {
      element.textContent = dark ? 'Tema claro' : 'Tema escuro';
    });
  }

  /** Alterna entre tema claro e escuro. */
  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }

  /**
   * Define o tema inicial: preferência salva > preferência do sistema operacional.
   */
  function initTheme() {
    const saved = localStorage.getItem('vibe-theme');
    const preferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(saved || preferred);
  }

  /* ---------------------------------------------------------------- */
  /* Auth                                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Alterna entre as abas "entrar" e "criar conta".
   * Atualiza títulos, mensagens de erro e move o foco para o primeiro campo.
   */
  function setAuthTab(tab) {
    const isLogin = tab === 'login';
    $('#login-form').classList.toggle('hidden', !isLogin);
    $('#register-form').classList.toggle('hidden', isLogin);
    $$('.auth-switch [data-when]').forEach((element) => {
      element.classList.toggle('hidden', element.dataset.when !== tab);
    });
    $('#auth-title').textContent = isLogin ? 'Bem-vindo de volta' : 'Crie seu espaço';
    $('#auth-subtitle').textContent = isLogin
      ? 'Entre para ver o que as pessoas que você acompanha publicaram.'
      : 'Um perfil simples, do seu jeito. Leva menos de um minuto.';
    $('#auth-error').textContent = '';
    $('#register-form .form-error').textContent = '';
    const focusField = (isLogin ? $('#login-form') : $('#register-form')).querySelector('input');
    if (focusField) setTimeout(() => focusField.focus(), 30);
  }

  /** Exibe a tela de autenticação e descarta o estado de sessão em memória. */
  function showAuth(tab = 'login') {
    state.me = null;
    state.profile = null;
    $('#app-shell').classList.add('hidden');
    $('#auth-screen').classList.remove('hidden');
    setAuthTab(tab);
  }

  /** Atualiza o avatar exibido na topbar e na navegação inferior. */
  function refreshNavAvatar() {
    const markup = state.me ? avatar(state.me, 30) : icon('user');
    const top = $('#top-avatar');
    if (top) top.innerHTML = markup;
    const bottom = $('#bottom-avatar');
    if (bottom) bottom.innerHTML = markup;
  }

  /** Troca da tela de auth para o shell da aplicação e abre a view inicial. */
  async function enterApp() {
    $('#auth-screen').classList.add('hidden');
    $('#app-shell').classList.remove('hidden');
    refreshNavAvatar();
    await navigate('feed');
  }

  /**
   * Autentica via `POST /api/login` e entra no app.
   * O botão fica em estado "carregando" durante a requisição.
   */
  async function login(username, password, button) {
    setBusy(button, true);
    try {
      const data = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      state.me = data.user;
      state.profile = null;
      await enterApp();
      toast(`Bem-vindo, ${data.user.name}.`);
    } finally {
      setBusy(button, false);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Modal / story shell                                              */
  /* ---------------------------------------------------------------- */

  /**
   * Abre um modal genérico.
   * O markup é injetado em `#modal-root`; o caller é responsável por sanitizar.
   */
  function openModal(markup, className = '') {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal ${className}" role="dialog" aria-modal="true">${markup}</div></div>`;
    document.body.classList.add('modal-open');
    return $('.modal', root);
  }

  function closeModal() {
    $('#modal-root').innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  const storyViewer = { groups: [], groupIndex: 0, storyIndex: 0, timer: null };

  function closeStories() {
    clearTimeout(storyViewer.timer);
    storyViewer.timer = null;
    storyViewer.groups = [];
    $('#story-root').innerHTML = '';
    document.body.classList.remove('story-open');
    if (state.view === 'feed') refreshAgora();
  }

  function storyNext() {
    clearTimeout(storyViewer.timer);
    const group = storyViewer.groups[storyViewer.groupIndex];
    if (!group) return closeStories();
    storyViewer.storyIndex += 1;
    if (storyViewer.storyIndex >= group.stories.length) {
      storyViewer.groupIndex += 1;
      storyViewer.storyIndex = 0;
    }
    if (storyViewer.groupIndex >= storyViewer.groups.length) return closeStories();
    renderStoryViewer();
  }

  function storyPrev() {
    clearTimeout(storyViewer.timer);
    storyViewer.storyIndex -= 1;
    if (storyViewer.storyIndex < 0) {
      storyViewer.groupIndex -= 1;
      if (storyViewer.groupIndex < 0) {
        storyViewer.groupIndex = 0;
        storyViewer.storyIndex = 0;
      } else {
        storyViewer.storyIndex = storyViewer.groups[storyViewer.groupIndex].stories.length - 1;
      }
    }
    renderStoryViewer();
  }

  function renderStoryViewer() {
    clearTimeout(storyViewer.timer);
    const group = storyViewer.groups[storyViewer.groupIndex];
    if (!group) return closeStories();
    const story = group.stories[storyViewer.storyIndex];
    if (!story) return closeStories();

    const root = $('#story-root');
    root.innerHTML = `
      <div class="story-viewer" role="dialog" aria-modal="true" aria-label="Story de ${esc(group.user.username)}">
        <img class="story-bg" src="${esc(story.image)}" alt="" aria-hidden="true" />
        <div class="story-progress">
          ${group.stories.map((item, index) => `
            <span class="story-seg ${index < storyViewer.storyIndex ? 'done' : ''} ${index === storyViewer.storyIndex ? 'active' : ''}"><i></i></span>
          `).join('')}
        </div>
        <header class="story-head">
          ${avatar(group.user, 36)}
          <div class="story-head-meta">
            <strong>${esc(group.user.username)}</strong>
            <span>${relTime(story.createdAt)}</span>
          </div>
          <span class="story-counter">${storyViewer.storyIndex + 1}/${group.stories.length}</span>
          ${group.user.id === state.me.id ? `<button type="button" class="icon-btn story-close" data-action="delete-story" data-id="${story.id}" aria-label="Apagar story">${icon('trash', 18)}</button>` : ''}
          <button type="button" class="icon-btn story-close" data-action="close-stories" aria-label="Fechar story">${icon('close')}</button>
        </header>
        <img class="story-image" src="${esc(story.image)}" alt="Story de ${esc(group.user.username)}" />
        <button type="button" class="story-nav story-nav-prev" data-action="story-prev" aria-label="Story anterior"></button>
        <button type="button" class="story-nav story-nav-next" data-action="story-next" aria-label="Próximo story"></button>
        <footer class="story-foot">
          <button type="button" class="story-profile" data-action="story-profile" data-username="${esc(group.user.username)}">
            ${avatar(group.user, 28)} <span>@${esc(group.user.username)}</span>
          </button>
        </footer>
      </div>`;
    document.body.classList.add('story-open');

    story.viewed = true;
    group.allViewed = group.stories.every((item) => item.viewed);
    api(`/api/stories/${story.id}/view`, { method: 'POST' }).catch(() => {});

    storyViewer.timer = setTimeout(storyNext, 5000);
  }

  function openStories(userId) {
    const index = state.storyGroups.findIndex((group) => group.user.id === userId);
    if (index < 0) return;
    storyViewer.groups = state.storyGroups;
    storyViewer.groupIndex = index;
    const group = state.storyGroups[index];
    const firstUnseen = group.stories.findIndex((story) => !story.viewed);
    storyViewer.storyIndex = firstUnseen === -1 ? 0 : firstUnseen;
    renderStoryViewer();
  }

  /* ---------------------------------------------------------------- */
  /* Post rendering                                                   */
  /* ---------------------------------------------------------------- */

  function captionHtml(text) {
    return esc(text).replace(/\n/g, '<br />');
  }

  function previewComments(post) {
    if (!post.preview || !post.preview.length) return '';
    return `<div class="comments-preview">${post.preview.map((comment) => `
      <p>
        <button type="button" class="inline-user" data-action="profile" data-username="${esc(comment.user.username)}">${esc(comment.user.username)}</button>
        ${esc(comment.text)}
      </p>`).join('')}</div>`;
  }

  function postCard(post, index = 0) {
    const mine = state.me && post.user.id === state.me.id;
    const featured = index === 0;
    return `
      <article class="post-card ${featured ? 'post-card--featured' : ''}" data-post-card="${post.id}">
        <button type="button" class="post-cover ${featured ? 'post-cover--featured' : 'post-cover--standard'}" data-action="open-post" data-id="${post.id}" aria-label="Abrir publicação de ${esc(post.user.username)}">
          <img src="${esc(post.image)}" alt="${esc(post.caption || `Foto de ${post.user.username}`)}" />
        </button>
        <div class="post-content">
          <div class="post-author">
            <button type="button" class="user-link" data-action="profile" data-username="${esc(post.user.username)}">
              ${avatar(post.user, 34)}
              <span class="user-meta">
                <strong>${esc(post.user.username)}</strong>
                <small>${relTime(post.createdAt)}</small>
              </span>
            </button>
            ${mine ? `<button type="button" class="icon-btn tiny" data-action="delete-post" data-id="${post.id}" aria-label="Apagar publicação">${icon('trash', 16)}</button>` : ''}
          </div>
          ${post.caption ? `<p class="caption">${captionHtml(post.caption)}</p>` : ''}
          <div class="post-reactions">
            <button type="button" class="reaction ${post.liked ? 'active' : ''}" data-action="like" data-like-btn="${post.id}" aria-label="Curtir">
              ${icon('heart', 18)} <span data-like-count="${post.id}">${formatCount(post.likes)}</span>
            </button>
            <button type="button" class="reaction" data-action="open-post" data-id="${post.id}" aria-label="Comentar">
              ${icon('comment', 18)} <span data-comment-count="${post.id}">${formatCount(post.comments)}</span>
            </button>
          </div>
          ${previewComments(post)}
          ${post.comments > 0 ? `<button type="button" class="view-comments" data-action="open-post" data-id="${post.id}">Ver conversa</button>` : ''}
        </div>
      </article>`;
  }

  function gridItem(post) {
    return `
      <button type="button" class="gallery-item" data-action="open-post" data-id="${post.id}" aria-label="Abrir publicação de ${esc(post.user.username)}">
        <img src="${esc(post.image)}" alt="${esc(post.caption || 'Publicação')}" />
        <span class="gallery-overlay">
          <span>${icon('heart', 16)} ${formatCount(post.likes)}</span>
          <span>${icon('comment', 16)} ${formatCount(post.comments)}</span>
        </span>
      </button>`;
  }

  function exploreCard(post) {
    return `
      <button type="button" class="explore-card" data-action="open-post" data-id="${post.id}" aria-label="Abrir publicação de ${esc(post.user.username)}">
        <img src="${esc(post.image)}" alt="${esc(post.caption || 'Publicação')}" />
        <span class="explore-meta">
          <strong>@${esc(post.user.username)}</strong>
          <span>${icon('heart', 14)} ${formatCount(post.likes)}</span>
        </span>
      </button>`;
  }

  function commentRow(comment, canDelete) {
    return `
      <div class="comment-bubble" data-comment-id="${comment.id}">
        ${avatar(comment.user, 30)}
        <div class="comment-body">
          <div class="comment-head">
            <button type="button" class="inline-user" data-action="profile" data-username="${esc(comment.user.username)}">${esc(comment.user.username)}</button>
            <span>${relTime(comment.createdAt)}</span>
          </div>
          <p>${esc(comment.text)}</p>
        </div>
        ${canDelete ? `<button type="button" class="icon-btn tiny" data-action="delete-comment" data-id="${comment.id}" aria-label="Apagar comentário">${icon('close', 14)}</button>` : ''}
      </div>`;
  }

  function applyLikeUI(postId, liked, likes) {
    $$(`[data-like-btn="${postId}"]`).forEach((button) => {
      button.classList.toggle('active', liked);
      button.classList.toggle('liked', liked);
    });
    $$(`[data-like-count="${postId}"]`).forEach((element) => {
      element.textContent = formatCount(likes);
    });
    const post = state.feed.find((item) => item.id === postId);
    if (post) {
      post.liked = liked;
      post.likes = likes;
    }
  }

  const liking = new Set();

  async function toggleLike(postId) {
    if (liking.has(postId)) return;
    liking.add(postId);
    try {
      const data = await api(`/api/posts/${postId}/like`, { method: 'POST' });
      applyLikeUI(postId, data.liked, data.likes);
    } finally {
      liking.delete(postId);
    }
  }

  function adjustCommentTotals(postId, total) {
    $$(`[data-comment-count="${postId}"]`).forEach((element) => {
      element.textContent = formatCount(total);
    });
    $$(`[data-comment-total="${postId}"]`).forEach((element) => {
      element.textContent = `${formatCount(total)} ${plural(total, 'comentário', 'comentários')}`;
    });
    const post = state.feed.find((item) => item.id === postId);
    if (post) post.comments = total;
  }

  /* ---------------------------------------------------------------- */
  /* Views                                                            */
  /* ---------------------------------------------------------------- */

  function renderNavActive() {
    $$('[data-nav]').forEach((element) => {
      element.classList.toggle('active', element.dataset.nav === state.view);
    });
  }

  async function navigate(view, username = null) {
    if (!state.me) return;
    closeModal();
    closeStories();
    state.view = view;
    state.profileUsername = view === 'profile' ? (username || state.me.username) : state.profileUsername;
    renderNavActive();
    window.scrollTo({ top: 0, behavior: 'auto' });
    const viewElement = $('#view');

    try {
      if (view === 'feed') await renderFeed(viewElement);
      else if (view === 'explore') await renderExplore(viewElement);
      else if (view === 'search') renderSearch(viewElement);
      else if (view === 'profile') await renderProfile(viewElement, state.profileUsername);
    } catch (error) {
      viewElement.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icon('camera', 32)}</div>
          <h3>Não foi possível carregar</h3>
          <p>${esc(error.message)}</p>
          <button type="button" class="btn primary" data-action="retry-view">Tentar de novo</button>
        </div>`;
      toast(error.message, 'error');
    }
  }

  async function renderFeed(viewElement) {
    const rawToday = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    const today = rawToday.charAt(0).toUpperCase() + rawToday.slice(1);
    viewElement.innerHTML = `
      <div class="mural-layout">
        <div class="mural-main">
          <header class="mural-head">
            <div>
              <p class="eyebrow">Mural</p>
              <h1>O que está acontecendo</h1>
            </div>
            <p class="mural-date">${esc(today)}</p>
          </header>
          <section class="agora" id="agora" aria-label="Momentos de agora"></section>
          <div class="feed-grid" id="feed-list">
            ${Array.from({ length: 3 }).map(() => '<div class="skeleton-post"><div class="skeleton-cover"></div><div class="skeleton-body"></div></div>').join('')}
          </div>
        </div>
        <aside class="rail" id="rail"></aside>
      </div>`;

    const [feed, stories, suggestions] = await Promise.all([
      api('/api/feed'),
      api('/api/stories'),
      api('/api/suggestions').catch(() => ({ users: [] })),
    ]);
    state.feed = feed.posts;
    state.storyGroups = stories.groups;
    if (state.view !== 'feed') return;

    renderAgora();
    renderRail(suggestions.users || []);
    const list = $('#feed-list');
    list.innerHTML = feed.posts.length
      ? feed.posts.map((post, index) => postCard(post, index)).join('')
      : `<div class="empty-state feed-empty">
          <div class="empty-icon">${icon('camera', 30)}</div>
          <h3>O mural está quieto</h3>
          <p>Siga pessoas ou vá até Descobrir para encontrar novos momentos.</p>
          <button type="button" class="btn primary" data-action="nav" data-view="explore">Descobrir</button>
        </div>`;
  }

  async function refreshAgora() {
    try {
      const data = await api('/api/stories');
      state.storyGroups = data.groups;
      if (state.view === 'feed' && $('#agora')) renderAgora();
    } catch {
      /* silencioso */
    }
  }

  function renderAgora() {
    const agora = $('#agora');
    if (!agora) return;
    const groups = state.storyGroups || [];
    agora.innerHTML = `
      <div class="agora-head">
        <div>
          <p class="eyebrow">Agora</p>
          <h2>Momentos que duram 24 horas</h2>
        </div>
        <button type="button" class="btn ghost small" data-action="new-story">${icon('plus', 16)} Novo</button>
      </div>
      <div class="agora-track">
        ${groups.length
          ? groups.map((group) => `
            <button type="button" class="agora-card ${group.allViewed ? 'seen' : ''}" data-action="open-stories" data-user="${group.user.id}" aria-label="Ver story de ${esc(group.user.username)}">
              <img src="${esc(group.stories[0].image)}" alt="" />
              <span class="agora-shade"></span>
              <span class="agora-user">${avatar(group.user, 26)}<span>${esc(group.user.username)}</span></span>
              ${group.stories.length > 1 ? `<span class="agora-count">${group.stories.length}</span>` : ''}
            </button>`).join('')
          : `<button type="button" class="agora-card agora-empty" data-action="new-story">
              <span class="agora-placeholder">${icon('camera', 26)}<span>Nenhum story por aqui.<br />Compartilhe o primeiro.</span></span>
            </button>`}
      </div>`;
  }

  function renderRail(users) {
    const rail = $('#rail');
    if (!rail) return;
    rail.innerHTML = `
      <section class="rail-card">
        <div class="rail-head">
          <h2>Quem seguir</h2>
          <span class="rail-spark">${icon('compass', 18)}</span>
        </div>
        ${users.length
          ? users.map((user) => `
            <div class="rail-user">
              <button type="button" class="user-link" data-action="profile" data-username="${esc(user.username)}">
                ${avatar(user, 38)}
                <span class="user-meta">
                  <strong>${esc(user.username)}</strong>
                  <small>${esc(user.name)}</small>
                </span>
              </button>
              <button type="button" class="btn ghost small" data-action="follow" data-username="${esc(user.username)}" data-following="false">Seguir</button>
            </div>`).join('')
          : '<p class="muted-note">Você já segue todo mundo por aqui.</p>'}
      </section>
      <section class="rail-card rail-about">
        <p class="eyebrow">Sobre o Vibe</p>
        <h2>Seu espaço, suas regras.</h2>
        <p>Nada de feed infinito ou anuncios. As fotos e conversas ficam neste computador.</p>
        <button type="button" class="btn ghost small btn-block" data-action="new-story">Publicar um story</button>
      </section>`;
  }

  async function renderExplore(viewElement) {
    viewElement.innerHTML = `
      <div class="page">
        <header class="page-head">
          <p class="eyebrow">Descobrir</p>
          <h1>Um pouco de tudo</h1>
          <p>Fotos e momentos de quem também está por aqui.</p>
        </header>
        <div class="explore-grid" id="explore-grid">
          ${Array.from({ length: 6 }).map(() => '<div class="skeleton-square"></div>').join('')}
        </div>
      </div>`;
    const data = await api('/api/explore');
    if (state.view !== 'explore') return;
    const grid = $('#explore-grid');
    grid.innerHTML = data.posts.length
      ? data.posts.map(exploreCard).join('')
      : `<div class="empty-state grid-empty">
          <div class="empty-icon">${icon('camera', 30)}</div>
          <h3>Nada por aqui ainda</h3>
          <p>Seja a primeira pessoa a publicar.</p>
          <button type="button" class="btn primary" data-action="new-post">Criar publicação</button>
        </div>`;
  }

  function renderSearch(viewElement) {
    viewElement.innerHTML = `
      <div class="page page-narrow">
        <header class="page-head">
          <p class="eyebrow">Buscar</p>
          <h1>Encontre alguém</h1>
          <p>Pelo nome ou pelo @usuário.</p>
        </header>
        <div class="search-box">
          ${icon('search', 20)}
          <input id="search-input" type="search" placeholder="Buscar pessoas" autocomplete="off" aria-label="Buscar pessoas" />
        </div>
        <div id="search-results" class="user-list">
          <p class="muted-note">Carregando pessoas...</p>
        </div>
      </div>`;

    const input = $('#search-input');
    const results = $('#search-results');
    let timer = null;
    let sequence = 0;

    const paint = (users, query) => {
      if (!users.length) {
        results.innerHTML = `<div class="empty-state compact"><h3>Nenhum resultado</h3><p>Não encontramos ninguém com &quot;${esc(query)}&quot;.</p></div>`;
        return;
      }
      results.innerHTML = `
        <p class="search-label">${query ? 'Resultados' : 'Pessoas por aqui'}</p>
        ${users.map((user) => `
          <div class="user-row">
            <button type="button" class="user-link" data-action="profile" data-username="${esc(user.username)}">
              ${avatar(user, 48)}
              <span class="user-meta">
                <strong>${esc(user.username)}</strong>
                <small>${esc(user.name)}</small>
              </span>
            </button>
            ${user.isMe
              ? '<span class="pill">Você</span>'
              : `<button type="button" class="btn small ${user.isFollowing ? 'ghost' : 'primary'}" data-action="follow" data-username="${esc(user.username)}" data-following="${user.isFollowing}">${user.isFollowing ? 'Seguindo' : 'Seguir'}</button>`}
          </div>`).join('')}`;
    };

    const search = async (query) => {
      const current = ++sequence;
      results.innerHTML = `<p class="muted-note">${query ? 'Buscando...' : 'Carregando pessoas...'}</p>`;
      try {
        const data = await api(`/api/search?q=${encodeURIComponent(query)}`);
        if (current !== sequence) return;
        paint(data.users, query);
      } catch (error) {
        if (current !== sequence) return;
        results.innerHTML = `<p class="muted-note">${esc(error.message)}</p>`;
      }
    };

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const query = input.value.trim();
      timer = setTimeout(() => search(query), 240);
    });

    setTimeout(() => input.focus(), 40);
    search('');
  }

  async function renderProfile(viewElement, username) {
    viewElement.innerHTML = `
      <div class="profile">
        <div class="profile-cover skeleton-cover"></div>
        <header class="profile-card">
          <div class="profile-avatar-wrap"><div class="skeleton-avatar"></div></div>
          <div class="profile-info">
            <div class="skeleton-line wide"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
          </div>
        </header>
      </div>`;

    const data = await api(`/api/users/${encodeURIComponent(username)}`);
    if (state.view !== 'profile') return;
    state.profile = data;
    state.profileUsername = data.user.username;

    const bio = data.user.bio
      ? `<p>${captionHtml(data.user.bio)}</p>`
      : '<p class="muted">Sem bio ainda.</p>';

    viewElement.innerHTML = `
      <div class="profile">
        <div class="profile-cover">
          ${data.posts[0] ? `<img src="${esc(data.posts[0].image)}" alt="" aria-hidden="true" />` : ''}
          <span class="profile-cover-shade"></span>
        </div>
        <header class="profile-card">
          <div class="profile-avatar-wrap">${avatar(data.user, 112, 'profile-avatar')}</div>
          <div class="profile-info">
            <div class="profile-top">
              <div class="profile-identity">
                <p class="eyebrow">@${esc(data.user.username)}</p>
                <h1>${esc(data.user.name)}</h1>
              </div>
              <div class="profile-actions">
                ${data.isMe
                  ? `<button type="button" class="btn ghost" data-action="open-settings">Configurações</button>
                     <button type="button" class="btn ghost" data-action="logout">Sair</button>`
                  : `<button type="button" class="btn ${data.isFollowing ? 'ghost' : 'primary'}" data-action="follow" data-username="${esc(data.user.username)}" data-following="${data.isFollowing}">${data.isFollowing ? 'Seguindo' : 'Seguir'}</button>`}
              </div>
            </div>
            <div class="profile-bio">${bio}</div>
            <div class="profile-stats">
              <span><strong>${formatCount(data.stats.posts)}</strong> ${plural(data.stats.posts, 'publicação', 'publicações')}</span>
              <span><strong data-profile-followers>${formatCount(data.stats.followers)}</strong> ${plural(data.stats.followers, 'seguidor', 'seguidores')}</span>
              <span><strong>${formatCount(data.stats.following)}</strong> seguindo</span>
            </div>
          </div>
        </header>
        <div class="gallery-head">
          <h2>Publicações</h2>
          <span>${formatCount(data.posts.length)}</span>
        </div>
        <div class="gallery" id="profile-grid">
          ${data.posts.length
            ? data.posts.map(gridItem).join('')
            : `<div class="empty-state grid-empty">
                <div class="empty-icon">${icon('camera', 30)}</div>
                <h3>Nenhuma publicação</h3>
                <p>${data.isMe ? 'Sua primeira foto pode estar aqui.' : 'Quando publicar, as fotos aparecem aqui.'}</p>
                ${data.isMe ? '<button type="button" class="btn primary" data-action="new-post">Criar publicação</button>' : ''}
              </div>`}
        </div>
      </div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Post detail                                                      */
  /* ---------------------------------------------------------------- */

  async function openPost(postId) {
    const data = await api(`/api/posts/${postId}`);
    const post = data.post;
    const comments = data.comments || [];
    const canDeletePost = data.canDelete;

    const markup = `
      <div class="moment-modal">
        <div class="moment-media">
          <img src="${esc(post.image)}" alt="${esc(post.caption || 'Publicação')}" />
        </div>
        <aside class="moment-side">
          <header class="moment-head">
            <button type="button" class="user-link" data-action="profile" data-username="${esc(post.user.username)}">
              ${avatar(post.user, 36)}
              <span class="user-meta">
                <strong>${esc(post.user.username)}</strong>
                <small>${relTime(post.createdAt)}</small>
              </span>
            </button>
            ${canDeletePost ? `<button type="button" class="icon-btn tiny" data-action="delete-post" data-id="${post.id}" aria-label="Apagar publicação">${icon('trash', 16)}</button>` : ''}
          </header>

          <div class="moment-scroll">
            ${post.caption ? `<p class="moment-caption">${captionHtml(post.caption)}</p>` : ''}
            <div class="moment-comments" id="comments-list">
              ${comments.length
                ? comments.map((comment) => commentRow(comment, canDeletePost || (state.me && comment.user.id === state.me.id))).join('')
                : '<p class="muted-note moment-empty">Ainda não há comentários. Comece a conversa.</p>'}
            </div>
          </div>

          <div class="moment-bottom">
            <div class="moment-actions">
              <button type="button" class="reaction big ${post.liked ? 'active' : ''}" data-action="like" data-like-btn="${post.id}" aria-label="Curtir">
                ${icon('heart', 20)} <span data-like-count="${post.id}">${formatCount(post.likes)}</span>
              </button>
              <button type="button" class="moment-comment-link" data-action="focus-comment">
                <span data-comment-total="${post.id}">${formatCount(post.comments)} ${plural(post.comments, 'comentário', 'comentários')}</span>
              </button>
            </div>
            <form id="comment-form" class="comment-form" data-post="${post.id}" autocomplete="off">
              <input name="text" type="text" placeholder="Escreva um comentário..." maxlength="500" required />
              <button type="submit" class="btn-text">Enviar</button>
            </form>
          </div>
        </aside>
      </div>`;

    openModal(markup, 'moment-modal-wrap');
  }

  /* ---------------------------------------------------------------- */
  /* Create / edit modals                                             */
  /* ---------------------------------------------------------------- */

  let pendingImage = null;
  let pendingAvatar = null;

  function imagePreviewMarkup(dataUrl) {
    return `<img src="${dataUrl}" alt="Previa da imagem" />`;
  }

  function openCreateModal() {
    pendingImage = null;
    openModal(`
      <div class="modal-head">
        <h2>Nova publicação</h2>
        <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
      </div>
      <form id="create-form" class="modal-form">
        <label class="upload-area" for="post-image">
          <input id="post-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden />
          <span class="upload-preview" id="upload-preview">
            <span class="upload-icon">${icon('image', 30)}</span>
            <strong>Escolha uma foto</strong>
            <span class="muted">PNG, JPG, WEBP ou GIF - até 8 MB</span>
          </span>
        </label>
        <label class="field">
          <span>Legenda</span>
          <textarea name="caption" rows="3" maxlength="2200" placeholder="Escreva uma legenda..."></textarea>
        </label>
        <p class="muted small">A imagem fica salva apenas neste computador.</p>
        <div class="modal-actions">
          <button type="button" class="btn ghost" data-action="close-modal">Cancelar</button>
          <button type="submit" class="btn primary">Publicar</button>
        </div>
      </form>`, 'create-modal');

    const input = $('#post-image');
    const preview = $('#upload-preview');
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        toast('A imagem precisa ter no máximo 8 MB.', 'error');
        input.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        pendingImage = String(reader.result);
        preview.classList.add('has-image');
        preview.innerHTML = imagePreviewMarkup(pendingImage);
      };
      reader.readAsDataURL(file);
    });
  }

  function openStoryModal() {
    pendingImage = null;
    openModal(`
      <div class="modal-head">
        <h2>Novo story</h2>
        <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
      </div>
      <form id="story-form" class="modal-form">
        <label class="upload-area" for="story-image">
          <input id="story-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden />
          <span class="upload-preview" id="upload-preview">
            <span class="upload-icon">${icon('image', 30)}</span>
            <strong>Escolha uma foto</strong>
            <span class="muted">O story desaparece em 24 horas</span>
          </span>
        </label>
        <div class="modal-actions">
          <button type="button" class="btn ghost" data-action="close-modal">Cancelar</button>
          <button type="submit" class="btn primary">Publicar story</button>
        </div>
      </form>`, 'create-modal');

    const input = $('#story-image');
    const preview = $('#upload-preview');
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        toast('A imagem precisa ter no máximo 8 MB.', 'error');
        input.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        pendingImage = String(reader.result);
        preview.classList.add('has-image');
        preview.innerHTML = imagePreviewMarkup(pendingImage);
      };
      reader.readAsDataURL(file);
    });
  }

  function openSettingsModal() {
    pendingAvatar = null;
    openModal(`
      <div class="modal-head">
        <h2>Configurações</h2>
        <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
      </div>
      <form id="edit-form" class="modal-form">
        <div class="edit-avatar">
          <span id="edit-avatar-preview">${avatar(state.me, 84)}</span>
          <label class="btn ghost small" for="avatar-image">Trocar foto</label>
          <input id="avatar-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden />
        </div>
        <label class="field">
          <span>Nome</span>
          <input name="name" type="text" value="${esc(state.me.name)}" maxlength="40" required />
        </label>
        <label class="field">
          <span>Usuário</span>
          <input type="text" value="@${esc(state.me.username)}" disabled />
        </label>
        <label class="field">
          <span>Bio</span>
          <textarea name="bio" rows="3" maxlength="150" placeholder="Conte um pouco sobre você">${esc(state.me.bio)}</textarea>
        </label>
        <div class="modal-actions">
          <button type="button" class="btn ghost" data-action="close-modal">Cancelar</button>
          <button type="submit" class="btn primary">Salvar</button>
        </div>
      </form>`, 'create-modal');

    const input = $('#avatar-image');
    if (input) {
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) {
          toast('A imagem precisa ter no máximo 8 MB.', 'error');
          input.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          pendingAvatar = String(reader.result);
          $('#edit-avatar-preview').innerHTML = `<img class="avatar" src="${pendingAvatar}" alt="Nova foto de perfil" style="width:84px;height:84px" />`;
        };
        reader.readAsDataURL(file);
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Actions                                                          */
  /* ---------------------------------------------------------------- */

  async function followUser(username) {
    const data = await api(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'POST' });
    const selector = `[data-action="follow"][data-username="${window.CSS && CSS.escape ? CSS.escape(username) : username}"]`;
    $$(selector).forEach((button) => {
      button.dataset.following = String(data.isFollowing);
      button.textContent = data.isFollowing ? 'Seguindo' : 'Seguir';
      button.classList.toggle('primary', !data.isFollowing);
      button.classList.toggle('ghost', data.isFollowing);
    });
    if (state.profile && state.profile.user.username.toLowerCase() === username.toLowerCase()) {
      state.profile.isFollowing = data.isFollowing;
      state.profile.stats = data.stats;
      const followers = $('[data-profile-followers]');
      if (followers) followers.textContent = formatCount(data.stats.followers);
    }
    toast(data.isFollowing ? `Seguindo @${username}.` : `Deixou de seguir @${username}.`);
  }

  async function deletePost(postId) {
    if (!window.confirm('Apagar esta publicação? Essa ação não pode ser desfeita.')) return;
    await api(`/api/posts/${postId}`, { method: 'DELETE' });
    closeModal();
    toast('Publicação apagada.');
    if (state.view === 'profile') await navigate('profile', state.profileUsername);
    else await navigate(state.view);
  }

  async function deleteComment(commentId, element) {
    await api(`/api/comments/${commentId}`, { method: 'DELETE' });
    const row = element.closest('.comment-bubble');
    const list = row ? row.parentElement : null;
    if (row) row.remove();
    if (list && !list.querySelector('.comment-bubble')) {
      const note = document.createElement('p');
      note.className = 'muted-note moment-empty';
      note.textContent = 'Ainda não há comentários. Comece a conversa.';
      list.appendChild(note);
    }
    toast('Comentário apagado.');
  }

  /* ---------------------------------------------------------------- */
  /* Event wiring                                                     */
  /* ---------------------------------------------------------------- */

  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    try {
      if (action === 'auth-tab') {
        setAuthTab(target.dataset.tab);
        return;
      }

      if (action === 'theme') {
        toggleTheme();
        return;
      }

      if (action === 'close-modal') {
        closeModal();
        return;
      }

      if (action === 'close-stories') {
        closeStories();
        return;
      }

      if (action === 'story-next') {
        storyNext();
        return;
      }

      if (action === 'story-prev') {
        storyPrev();
        return;
      }

      if (action === 'story-profile') {
        const username = target.dataset.username;
        closeStories();
        await navigate('profile', username);
        return;
      }

      if (action === 'logout') {
        await api('/api/logout', { method: 'POST' });
        closeModal();
        closeStories();
        state.feed = [];
        state.storyGroups = [];
        showAuth();
        toast('Você saiu da conta.');
        return;
      }

      if (action === 'nav') {
        await navigate(target.dataset.view);
        return;
      }

      if (action === 'nav-self') {
        await navigate('profile', state.me.username);
        return;
      }

      if (action === 'profile') {
        await navigate('profile', target.dataset.username);
        return;
      }

      if (action === 'retry-view') {
        await navigate(state.view, state.profileUsername);
        return;
      }

      if (action === 'new-post') {
        openCreateModal();
        return;
      }

      if (action === 'new-story') {
        openStoryModal();
        return;
      }

      if (action === 'open-settings') {
        openSettingsModal();
        return;
      }

      if (action === 'like') {
        await toggleLike(Number(target.dataset.likeBtn));
        return;
      }

      if (action === 'open-post') {
        await openPost(Number(target.dataset.id));
        return;
      }

      if (action === 'focus-comment') {
        const input = $('#comment-form input');
        if (input) input.focus();
        return;
      }

      if (action === 'follow') {
        await followUser(target.dataset.username);
        return;
      }

      if (action === 'delete-post') {
        await deletePost(Number(target.dataset.id));
        return;
      }

      if (action === 'delete-comment') {
        await deleteComment(Number(target.dataset.id), target);
        return;
      }

      if (action === 'delete-story') {
        await api(`/api/stories/${Number(target.dataset.id)}`, { method: 'DELETE' });
        closeStories();
        toast('Story apagado.');
        return;
      }

      if (action === 'open-stories') {
        openStories(Number(target.dataset.user));
        return;
      }
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target;

    try {
      if (form.id === 'login-form') {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const errorBox = form.querySelector('.form-error');
        errorBox.textContent = '';
        const data = new FormData(form);
        try {
          await login(String(data.get('username') || '').trim(), String(data.get('password') || ''), button);
        } catch (error) {
          errorBox.textContent = error.message;
        }
        return;
      }

      if (form.id === 'register-form') {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const errorBox = form.querySelector('.form-error');
        errorBox.textContent = '';
        const data = new FormData(form);
        setBusy(button, true);
        try {
          const result = await api('/api/register', {
            method: 'POST',
            body: JSON.stringify({
              name: String(data.get('name') || '').trim(),
              username: String(data.get('username') || '').trim(),
              password: String(data.get('password') || ''),
            }),
          });
          state.me = result.user;
          await enterApp();
          toast('Conta criada. Bem-vindo ao Vibe!');
        } catch (error) {
          errorBox.textContent = error.message;
        } finally {
          setBusy(button, false);
        }
        return;
      }

      if (form.id === 'create-form') {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        if (!pendingImage) {
          toast('Escolha uma foto antes de publicar.', 'error');
          return;
        }
        const caption = String(new FormData(form).get('caption') || '');
        setBusy(button, true);
        try {
          await api('/api/posts', {
            method: 'POST',
            body: JSON.stringify({ image: pendingImage, caption }),
          });
          closeModal();
          pendingImage = null;
          toast('Publicação criada.');
          await navigate('feed');
        } finally {
          setBusy(button, false);
        }
        return;
      }

      if (form.id === 'story-form') {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        if (!pendingImage) {
          toast('Escolha uma foto antes de publicar.', 'error');
          return;
        }
        setBusy(button, true);
        try {
          await api('/api/stories', {
            method: 'POST',
            body: JSON.stringify({ image: pendingImage }),
          });
          closeModal();
          pendingImage = null;
          toast('Story publicado. Ele desaparece em 24 horas.');
          await navigate('feed');
        } finally {
          setBusy(button, false);
        }
        return;
      }

      if (form.id === 'edit-form') {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const data = new FormData(form);
        const payload = {
          name: String(data.get('name') || '').trim(),
          bio: String(data.get('bio') || '').trim(),
        };
        if (pendingAvatar) payload.avatar = pendingAvatar;
        setBusy(button, true);
        try {
          const result = await api('/api/me', { method: 'PATCH', body: JSON.stringify(payload) });
          state.me = result.user;
          pendingAvatar = null;
          refreshNavAvatar();
          closeModal();
          toast('Perfil atualizado.');
          await navigate('profile', state.me.username);
        } finally {
          setBusy(button, false);
        }
        return;
      }

      if (form.id === 'comment-form') {
        event.preventDefault();
        const postId = Number(form.dataset.post);
        const input = form.querySelector('input[name="text"]');
        const text = input.value.trim();
        if (!text) return;
        const button = form.querySelector('button[type="submit"]');
        setBusy(button, true);
        try {
          const data = await api(`/api/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ text }),
          });
          const list = $('#comments-list');
          if (list) {
            const empty = list.querySelector('.moment-empty');
            if (empty) empty.remove();
            list.insertAdjacentHTML('beforeend', commentRow(data.comment, true));
            list.scrollTop = list.scrollHeight;
          }
          input.value = '';
          adjustCommentTotals(postId, data.comments);
        } finally {
          setBusy(button, false);
        }
        return;
      }
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('#modal-root').addEventListener('click', (event) => {
    if (event.target.classList.contains('modal-backdrop')) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if ($('#story-root').innerHTML) {
        closeStories();
      } else {
        closeModal();
      }
      return;
    }
    if ($('#story-root').innerHTML) {
      if (event.key === 'ArrowRight') storyNext();
      if (event.key === 'ArrowLeft') storyPrev();
    }
  });

  /* ---------------------------------------------------------------- */
  /* Boot                                                            */
  /* ---------------------------------------------------------------- */

  async function boot() {
    hydrateIcons();
    initTheme();
    refreshNavAvatar();
    setAuthTab('login');

    try {
      const data = await api('/api/me');
      state.me = data.user;
      await enterApp();
    } catch {
      showAuth();
    }
  }

  boot();
})();
