/* Vibra - rede social: início, explorar, perfis, publicações e stories. */

/**
 * Módulo social.js – renderiza as três telas principais: Início, Explorar e Perfil.
 * As requisições são feitas por `api()` e o HTML é montado por modelos de string.
 *
 * Exports:
 *   * `renderHome`, `renderExplore` e `renderProfile`: telas renderizadas pelo roteador.
 *   * Helpers de publicação, carrossel, curtidas e comentários, consumidos por `social-actions.js`.
 *   * Helpers de stories e cards, também reutilizados por `messages.js` ao montar conteúdo social.
 *
 * Dependências de `core.js`: o estado compartilhado `state`, o cliente `api()`, a navegação `navigate()`,
 * os modais `openModal()`/`closeModal()` e avisos `toast()`. Açõesdelegadas usam `data-action` para que
 * `social-actions.js` aplique os efeitos; conteúdo vindo de usuários é escapado com `esc()` para evitar XSS.
 */

import {
  $,
  $$,
  state,
  icon,
  hydrateIcons,
  esc,
  formatCount,
  plural,
  relTime,
  longDate,
  avatar,
  interestLabel,
  mediaMarkup,
  emptyState,
  api,
  toast,
  setBusy,
  openModal,
  closeModal,
  confirmDialog,
  navigate,
  refreshNavAvatar,
  refreshBadges,
  fileToDataUrl,
  onBeforeNavigate,
  addTimer,
} from './core.js';

/**
 * Converte uma legenda em HTML seguro, preservando as quebras de linha.
 * `esc()` neutraliza caracteres especiais antes da inserção no DOM para impedir XSS.
 *
 * @param {string} text Texto da legenda.
 * @returns {string} HTML com quebras de linha representedas por `<br />`.
 */
function captionHtml(text) {
  return esc(text).replace(/\n/g, '<br />');
}

/**
 * Cria o botão de seguir para os estados de relacionamento possíveis.
 * O rótulo e a classe CSS refletem quatro situações: seguindo, solicitação enviada,
 * perfil privado (solicitar) e perfil público normal (seguir). Os atributos `data-*`
 * permitem que `social-actions.js` interprete a ação sem consultar novamente a API.
 *
 * @param {Object} user Usuário alvo.
 * @param {string} [extra] Classes CSS adicionais.
 * @returns {string} Markup do botão de seguir.
 */
export function followButton(user, extra = '') {
  const following = !!user.isFollowing;
  const requested = !!user.followRequested;
  const isPrivate = !!user.isPrivate;
  const label = following
    ? 'Seguindo'
    : requested
      ? 'Solicitação enviada'
      : isPrivate
        ? 'Solicitar para seguir'
        : 'Seguir';
  const style = following || requested ? 'ghost' : 'primary';
  return `<button type="button" class="btn ${style}${extra ? ` ${extra}` : ''}" data-action="follow" data-username="${esc(user.username)}" data-following="${following}" data-requested="${requested}" data-private="${isPrivate}">${label}</button>`;
}

/**
 * Normaliza a coleção de mídias de uma publicação.
 * Publicações legadas podem ter apenas `image`; nesse caso, cria uma lista sintética
 * para que os demais helpers tratem imagens e vídeos de maneira uniforme.
 *
 * @param {Object} post Publicação recebida da API.
 * @returns {Array<Object>} Lista de itens com `url` e `mediaType`.
 */
function postMedia(post) {
  return Array.isArray(post.media) && post.media.length
    ? post.media
    : [{ url: post.image, mediaType: post.mediaType || 'image' }];
}

/**
 * Gera a miniatura usada nos grids de Explorar e Perfil.
 * Vídeos são renderizados sem controles e imagens recebem `loading="lazy"` para
 * adiar o carregamento de conteúdo fora da viewport.
 *
 * @param {Object} post Publicação de origem.
 * @returns {string} Markup da miniatura.
 */
function thumbMarkup(post) {
  const [cover] = postMedia(post);
  if (cover.mediaType === 'video') {
    return `<video src="${esc(cover.url)}" muted playsinline preload="metadata" aria-hidden="true"></video>`;
  }
  return `<img src="${esc(cover.url)}" alt="${esc(post.caption || 'Publicação')}" loading="lazy" />`;
}

/**
 * Monta o carrossel de mídias de uma publicação.
 * Cada item vira um slide; a primeira imagem usa `loading="eager"` para aparecer
 * imediatamente, enquanto as demais são preguiçosas. Indicadores (`dots`) refletem
 * o slide inicial. A opção `modal: true` adiciona a classe de variante para o modal
 * e habilita controles nos vídeos; `modal: false` mantém o vídeo silencioso e inline.
 *
 * @param {Object} post Publicização que pode conter várias mídias.
 * @param {Object} [options] Opções de renderização.
 * @param {boolean} [options.modal=false] Indica renderização dentro de modal.
 * @returns {string} Markup do carrossel ou string vazia se houver menos de duas mídias.
 */
export function carouselMarkup(post, { modal = false } = {}) {
  const media = postMedia(post);
  if (media.length < 2) return '';
  const alt = post.caption || `Publicação de ${post.user.username}`;
  return `<div class="post-carousel ${modal ? 'post-carousel--modal' : ''}" data-carousel data-index="0" role="group" aria-roledescription="carrossel" aria-label="Fotos da publicação de ${esc(post.user.username)}">
    <div class="post-carousel-track" data-carousel-track>
      ${media.map((item, index) => `<div class="post-carousel-slide" data-carousel-slide>
        ${item.mediaType === 'video'
          ? `<video src="${esc(item.url)}" ${modal ? 'controls playsinline' : 'muted playsinline preload="metadata"'} aria-label="${esc(alt)}"></video>`
          : `<img src="${esc(item.url)}" alt="${esc(alt)} (${index + 1} de ${media.length})" loading="${index === 0 ? 'eager' : 'lazy'}" />`}
      </div>`).join('')}
    </div>
    <button type="button" class="carousel-nav carousel-nav--prev" data-action="carousel-prev" aria-label="Foto anterior" disabled>${icon('chevronLeft', 18)}</button>
    <button type="button" class="carousel-nav carousel-nav--next" data-action="carousel-next" aria-label="Próxima foto">${icon('chevronRight', 18)}</button>
    <span class="carousel-counter" data-carousel-counter aria-live="polite" aria-label="Foto 1 de ${media.length}">1/${media.length}</span>
    <div class="carousel-dots" aria-hidden="true">${media.map((_, index) => `<span class="carousel-dot ${index === 0 ? 'active' : ''}" data-carousel-dot></span>`).join('')}</div>
  </div>`;
}

/**
 * Sincroniza o estado visual do carrossel com o índice informado.
 * Atualiza o contador e os dots ativos, além de desabilitar a navegação nas
 * extremidades, de modo que o slide ativo e seus indicadores permaneçam coerentes.
 *
 * @param {HTMLElement} carousel Elemento raiz `[data-carousel]`.
 * @param {number} index Índice desejado do slide.
 */
function updateCarousel(carousel, index) {
  const slides = [...carousel.querySelectorAll('[data-carousel-slide]')];
  if (!slides.length) return;
  const safe = Math.max(0, Math.min(index, slides.length - 1));
  carousel.dataset.index = String(safe);
  const counter = carousel.querySelector('[data-carousel-counter]');
  if (counter) {
    counter.textContent = `${safe + 1}/${slides.length}`;
    counter.setAttribute('aria-label', `Foto ${safe + 1} de ${slides.length}`);
  }
  carousel.querySelectorAll('[data-carousel-dot]').forEach((dot, dotIndex) => {
    dot.classList.toggle('active', dotIndex === safe);
  });
  const prev = carousel.querySelector('[data-action="carousel-prev"]');
  const next = carousel.querySelector('[data-action="carousel-next"]');
  if (prev) prev.disabled = safe === 0;
  if (next) next.disabled = safe === slides.length - 1;
}

/**
 * Move o carrossel para o slide anterior ou seguinte.
 * O deslocamento horizontal é calculado pela largura da trilha e a transição
 * é suave, exceto quando o usuário pediu movimento reduzido no sistema.
 *
 * @param {HTMLElement} target Elemento que originou a ação.
 * @param {number} direction Deslocamento: `-1` para voltar e `1` para avançar.
 */
export function carouselStep(target, direction) {
  const carousel = target.closest('[data-carousel]');
  const track = carousel?.querySelector('[data-carousel-track]');
  if (!carousel || !track) return;
  const slides = [...track.querySelectorAll('[data-carousel-slide]')];
  const index = Number(carousel.dataset.index || 0);
  const next = Math.max(0, Math.min(index + direction, slides.length - 1));
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  track.scrollTo({ left: next * track.clientWidth, behavior });
  updateCarousel(carousel, next);
}

document.addEventListener('scroll', (event) => {
  const track = event.target;
  if (!(track instanceof HTMLElement) || !track.matches('[data-carousel-track]')) return;
  const carousel = track.closest('[data-carousel]');
  if (!carousel) return;
  updateCarousel(carousel, Math.round(track.scrollLeft / track.clientWidth));
}, true);

/* ------------------------------------------------------------------ */
/* Cartões de publicação                                              */
/* ------------------------------------------------------------------ */

function previewComments(post) {
  if (!post.preview || !post.preview.length) return '';
  return `<div class="comments-preview">${post.preview.map((comment) => `
    <p>
      <button type="button" class="inline-user" data-action="profile" data-username="${esc(comment.user.username)}">${esc(comment.user.username)}</button>
      ${esc(comment.text)}
    </p>`).join('')}</div>`;
}

function feedCommentsLabel(total) {
  return total === 1 ? 'Ver 1 comentário' : `Ver todos os ${formatCount(total)} comentários`;
}

function feedVideoMarkup(post) {
  const [cover] = postMedia(post);
  const label = post.caption || `Vídeo de ${post.user.username}`;
  return `<div class="post-cover post-cover--video" data-video-player data-action="toggle-video">
    <video src="${esc(cover.url)}" playsinline preload="metadata" aria-label="${esc(label)}"></video>
    <button type="button" class="post-video-toggle" data-action="toggle-video" aria-label="Reproduzir vídeo">
      <span data-video-icon>${icon('play', 28)}</span>
    </button>
    <div class="post-video-controls">
      <button type="button" class="post-video-open" data-action="open-post" data-id="${post.id}">${icon('video', 15)} Abrir vídeo</button>
      <button type="button" class="post-video-mute" data-action="toggle-video-mute" aria-label="Silenciar vídeo" aria-pressed="false">${icon('volume', 18)}</button>
    </div>
  </div>`;
}

/**
 * Renderiza um card de publicação completo, usado no feed.
 * Escolhe entre carrossel, vídeo ou imagem e conecta as ações de curtir,
 * comentar, compartilhar, abrir e denunciar por atributos `data-action`.
 *
 * @param {Object} post Publicação retornada pela API.
 * @returns {string} Markup HTML do card.
 */
function postCard(post) {
  // O conteúdo editorial é inserido diretamente no template; por isso todo texto,
  // nome e atributo proveniente do usuário precisa passar por `esc()`.
  const mine = state.me && post.user.id === state.me.id;
  const media = postMedia(post);
  const cover = media.length > 1
    ? carouselMarkup(post)
    : post.mediaType === 'video'
      ? feedVideoMarkup(post)
      : `<button type="button" class="post-cover" data-action="open-post" data-id="${post.id}" aria-label="Abrir publicação de ${esc(post.user.username)}">
          <img src="${esc(post.image)}" alt="${esc(post.caption || `Foto de ${post.user.username}`)}" loading="lazy" />
        </button>`;

  return `
    <article class="post-card" data-post-card="${post.id}">
      <header class="post-head">
        <button type="button" class="user-link" data-action="profile" data-username="${esc(post.user.username)}">
          ${avatar(post.user, 36)}
          <span class="user-meta">
            <strong>${esc(post.user.username)}</strong>
            <small>${relTime(post.createdAt)}</small>
          </span>
        </button>
        <div class="post-author-tools">
          ${post.mediaType === 'video' ? '<span class="pill pill-video">Vídeo</span>' : ''}
          ${mine ? `<button type="button" class="icon-btn tiny" data-action="delete-post" data-id="${post.id}" aria-label="Apagar publicação">${icon('trash', 16)}</button>` : ''}
        </div>
      </header>
      ${cover}
      <div class="post-content">
        <div class="post-reactions">
          <button type="button" class="reaction ${post.liked ? 'active' : ''}" data-action="like" data-like-btn="${post.id}" aria-label="Curtir">
            ${icon('heart', 20)}
          </button>
          <button type="button" class="reaction" data-action="open-post" data-id="${post.id}" aria-label="Comentar">
            ${icon('comment', 20)}
          </button>
          <button type="button" class="reaction" data-action="share-post" data-id="${post.id}" aria-label="Compartilhar">
            ${icon('share', 20)}
          </button>
          <button type="button" class="reaction reaction-more" data-action="report-post" data-id="${post.id}" aria-label="Denunciar publicação">
            ${icon('flag', 18)}
          </button>
        </div>
        <p class="post-likes">
          <strong data-like-count="${post.id}">${formatCount(post.likes)}</strong>
          <span data-like-label="${post.id}">${plural(post.likes, 'curtida', 'curtidas')}</span>
        </p>
        ${post.caption ? `<p class="caption"><button type="button" class="inline-user" data-action="profile" data-username="${esc(post.user.username)}">${esc(post.user.username)}</button> ${captionHtml(post.caption)}</p>` : ''}
        ${previewComments(post)}
        ${post.comments > 0 ? `<button type="button" class="view-comments" data-action="open-post" data-id="${post.id}" data-feed-comments="${post.id}">${feedCommentsLabel(post.comments)}</button>` : ''}
      </div>
    </article>`;
}

function gridItem(post) {
  return `
    <button type="button" class="gallery-item ${post.mediaType === 'video' ? 'gallery-video' : ''}" data-action="open-post" data-id="${post.id}" aria-label="Abrir publicação de ${esc(post.user.username)}">
      ${thumbMarkup(post)}
      ${postMedia(post).length > 1 ? `<span class="carousel-badge" aria-label="${postMedia(post).length} fotos">${icon('image', 13)} ${postMedia(post).length}</span>` : ''}
      ${post.mediaType === 'video' ? `<span class="gallery-video-mark">${icon('video', 18)}</span>` : ''}
      <span class="gallery-overlay">
        <span>${icon('heart', 16)} ${formatCount(post.likes)}</span>
        <span>${icon('comment', 16)} ${formatCount(post.comments)}</span>
      </span>
    </button>`;
}

function exploreCard(post) {
  return `
    <button type="button" class="explore-card" data-action="open-post" data-id="${post.id}" aria-label="Abrir publicação de ${esc(post.user.username)}">
      ${thumbMarkup(post)}
      ${postMedia(post).length > 1 ? `<span class="carousel-badge" aria-label="${postMedia(post).length} fotos">${icon('image', 13)} ${postMedia(post).length}</span>` : ''}
      ${post.mediaType === 'video' ? `<span class="gallery-video-mark">${icon('video', 18)}</span>` : ''}
      <span class="explore-meta">
        <strong>@${esc(post.user.username)}</strong>
        <span>${icon('heart', 14)} ${formatCount(post.likes)}</span>
      </span>
    </button>`;
}

/**
 * Monta a linha visual de um comentário.
 * O botão de remoção aparece apenas quando `canDelete` é verdadeiro; o texto,
 * o nome de usuário e os atributos interleados são escapados para evitar XSS.
 *
 * @param {Object} comment Comentário retornado pela API.
 * @param {boolean} canDelete Indica se o botão de apagar pode ser exibido.
 * @returns {string} Markup HTML da linha de comentário.
 */
export function commentRow(comment, canDelete) {
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
  $$(`[data-like-label="${postId}"]`).forEach((element) => {
    element.textContent = plural(likes, 'curtida', 'curtidas');
  });
  for (const collection of [state.feed]) {
    const post = collection.find((item) => item.id === postId);
    if (post) {
      post.liked = liked;
      post.likes = likes;
    }
  }
}

const liking = new Set();

export async function toggleLike(postId) {
  if (liking.has(postId)) return;
  liking.add(postId);
  try {
    const data = await api(`/api/posts/${postId}/like`, { method: 'POST' });
    applyLikeUI(postId, data.liked, data.likes);
  } finally {
    liking.delete(postId);
  }
}

/**
 * Atualiza os contadores de comentários exibidos no ticker do post.
 * Garante que a UI esteja sincronizada com o estado interno e re‑renderiza
 * os botões de “ver comentários”.
 *
 * @param {number|string} postId Identificador da publicação.
 * @param {number} total Número atual de comentários.
 */
export function adjustCommentTotals(postId, total) {
  $$(`[data-comment-count="${postId}"]`).forEach((element) => {
    element.textContent = formatCount(total);
  });
  $$(`[data-comment-total="${postId}"]`).forEach((element) => {
    element.textContent = `${formatCount(total)} ${plural(total, 'comentário', 'comentários')}`;
  });
  $$(`[data-feed-comments="${postId}"]`).forEach((element) => {
    element.textContent = feedCommentsLabel(total);
  });
  const post = state.feed.find((item) => item.id === postId);
  if (post) post.comments = total;
}

/* ------------------------------------------------------------------ */
/* Início                                                             */
/* ------------------------------------------------------------------ */

/**
 * Renderiza a tela inicial (feed) do social.
 *
 * Operações realizadas:
 *   1. Constrói o layout do "mural" (header, spinner, grid).
 *   2. Recupera o feed via `/api/feed` (padrão) – paginado/segmentado.
 *   3. Trata pré‑renderização de loading e espera a resposta.
 *   4. Atualiza a contagem de likes, comentários, e chama `fetchMoreFeed`
 *      quando o usuário scrollear (não há scroll por conta de `window.scroll`)
 *      então apenas chama o fetch do feed.
 *
 * A estrutura do markup corresponde ao template usado por `postCard`.
 * @param {HTMLElement} viewElement elemento onde o conteúdo será injetado.
 */
export async function renderHome(viewElement) {
  const rawToday = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const today = rawToday.charAt(0).toUpperCase() + rawToday.slice(1);
  viewElement.innerHTML = `
    <div class="mural-layout">
      <div class="mural-main">
        <header class="mural-head">
          <div>
            <p class="eyebrow">Início</p>
            <h1>O que está acontecendo</h1>
          </div>
          <p class="mural-date">${esc(today)}</p>
        </header>
        <section class="agora" id="agora" aria-label="Momentos de agora"></section>
        <div class="feed-grid" id="feed-list">
          ${Array.from({ length: 3 }).map(() => '<div class="skeleton-post"><div class="skeleton-cover"></div><div class="skeleton-body"></div></div>').join('')}
        </div>
        <div id="feed-more-wrap"></div>
      </div>
      <aside class="rail" id="rail"></aside>
    </div>`;

  const [feed, stories, suggestions] = await Promise.all([
    api('/api/feed'),
    api('/api/stories').catch(() => ({ groups: [] })),
    api('/api/suggestions').catch(() => ({ users: [] })),
  ]);
  state.feed = feed.posts;
  state.feedCursor = feed.nextCursor;
  state.storyGroups = stories.groups || [];
  if (state.view !== 'home') return;

  renderAgora();
  renderRail(suggestions.users || []);
  const list = $('#feed-list');
  list.innerHTML = feed.posts.length
    ? feed.posts.map((post) => postCard(post)).join('')
    : emptyState({
        iconName: 'camera',
        title: 'O início está quieto',
        text: 'Siga pessoas ou explore interesses para encontrar novos momentos.',
        action: '<button type="button" class="btn primary" data-action="nav" data-view="explore">Explorar</button>',
      });
  renderFeedMore();
  hydrateIcons(viewElement);
}

function renderFeedMore() {
  const wrap = $('#feed-more-wrap');
  if (!wrap) return;
  wrap.innerHTML = state.feedCursor
    ? '<button type="button" class="btn ghost btn-block load-more" data-action="feed-more">Carregar mais publicações</button>'
    : '';
}

export async function loadMoreFeed(button) {
  if (!state.feedCursor) return;
  setBusy(button, true);
  try {
    const data = await api(`/api/feed?before=${encodeURIComponent(state.feedCursor)}`);
    const known = new Set(state.feed.map((post) => post.id));
    const fresh = data.posts.filter((post) => !known.has(post.id));
    state.feed = [...state.feed, ...fresh];
    state.feedCursor = data.nextCursor;
    const list = $('#feed-list');
    if (list && fresh.length) {
      list.insertAdjacentHTML('beforeend', fresh.map((post) => postCard(post)).join(''));
      hydrateIcons(list);
    }
    renderFeedMore();
  } finally {
    setBusy(button, false);
  }
}

async function refreshAgora() {
  try {
    const data = await api('/api/stories');
    state.storyGroups = data.groups;
    if (state.view === 'home' && $('#agora')) renderAgora();
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
          <button type="button" class="agora-card ${group.allViewed ? 'seen' : ''} ${group.isCloseFriend ? 'close-friend' : ''}" data-action="open-stories" data-user="${group.user.id}" aria-label="Ver story de ${esc(group.user.username)}">
            ${group.stories[0].mediaType === 'video'
              ? `<video src="${esc(group.stories[0].image)}" muted playsinline preload="metadata" aria-hidden="true"></video>`
              : `<img src="${esc(group.stories[0].image)}" alt="" />`}
            <span class="agora-shade"></span>
            <span class="agora-user">${avatar(group.user, 26)}<span>${esc(group.user.username)}</span></span>
            ${group.stories.length > 1 ? `<span class="agora-count">${group.stories.length}</span>` : ''}
          </button>`).join('')
        : `<button type="button" class="agora-card agora-empty" data-action="new-story">
            <span class="agora-placeholder">${icon('camera', 26)}<span>Nenhum story por aqui.<br />Compartilhe o primeiro.</span></span>
          </button>`}
    </div>`;
  hydrateIcons(agora);
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
                <small>${user.sharedInterests && user.sharedInterests.length ? `${user.sharedInterests.length} ${plural(user.sharedInterests.length, 'interesse', 'interesses')} em comum` : esc(user.name)}</small>
              </span>
            </button>
            ${followButton(user, 'small')}
          </div>`).join('')
        : '<p class="muted-note">Você já segue todo mundo por aqui.</p>'}
    </section>
    <section class="rail-card dating-teaser">
      <p class="eyebrow">Namoro</p>
      <h2>Afeto com contexto.</h2>
      <p>Uma área separada, só para maiores de 18 anos com identidade verificada. Você decide se quer entrar.</p>
      <button type="button" class="btn primary small btn-block" data-action="nav" data-view="dating">${icon('spark', 15)} Conhecer o Namoro</button>
      <small>Verificação de idade obrigatória.</small>
    </section>
    <section class="rail-card rail-about">
      <p class="eyebrow">Privacidade por padrão</p>
      <h2>Seu espaço, suas regras.</h2>
      <p>Preferências românticas nunca aparecem no perfil social. A localização do Radar só é compartilhada com consentimento dos dois lados.</p>
      <button type="button" class="btn ghost small btn-block" data-action="new-story">Publicar um story</button>
    </section>`;
  hydrateIcons(rail);
}

/* ------------------------------------------------------------------ */
/* Stories                                                            */
/* ------------------------------------------------------------------ */

const storyViewer = { groups: [], groupIndex: 0, storyIndex: 0, timer: null };

export function closeStories() {
  clearTimeout(storyViewer.timer);
  storyViewer.timer = null;
  storyViewer.groups = [];
  const root = $('#story-root');
  if (root) root.innerHTML = '';
  document.body.classList.remove('story-open');
}

export function storyNext() {
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

export function storyPrev() {
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
    <div class="story-viewer ${story.audience === 'close_friends' ? 'story-viewer--close-friends' : ''}" role="dialog" aria-modal="true" aria-label="Story de ${esc(group.user.username)}">

      ${story.mediaType === 'video'
        ? `<video class="story-bg" src="${esc(story.image)}" muted playsinline aria-hidden="true"></video>`
        : `<img class="story-bg" src="${esc(story.image)}" alt="" aria-hidden="true" />`}
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
          ${story.audience === 'close_friends' ? `<span class="story-close-friends">${icon('users', 13)} Melhores amigos</span>` : ''}
        </div>
        <span class="story-counter">${storyViewer.storyIndex + 1}/${group.stories.length}</span>
        ${group.user.id === state.me.id ? `<button type="button" class="icon-btn story-close" data-action="story-views" data-id="${story.id}" aria-label="Visualizações">${icon('eye', 18)}</button>` : ''}
        ${group.user.id === state.me.id ? `<button type="button" class="icon-btn story-close" data-action="delete-story" data-id="${story.id}" aria-label="Apagar story">${icon('trash', 18)}</button>` : ''}
        <button type="button" class="icon-btn story-close" data-action="close-stories" aria-label="Fechar story">${icon('close')}</button>
      </header>
      ${story.mediaType === 'video'
        ? `<video class="story-image" src="${esc(story.image)}" playsinline autoplay controls aria-label="Story de ${esc(group.user.username)}"></video>`
        : `<img class="story-image" src="${esc(story.image)}" alt="Story de ${esc(group.user.username)}" />`}
      <button type="button" class="story-nav story-nav-prev" data-action="story-prev" aria-label="Story anterior"></button>
      <button type="button" class="story-nav story-nav-next" data-action="story-next" aria-label="Próximo story"></button>
      <footer class="story-foot">
        ${story.mentions && story.mentions.length ? `<div class="story-mentions">${story.mentions.map((username) => `<button type="button" class="story-mention" data-action="story-profile" data-username="${esc(username)}">@${esc(username)}</button>`).join(' ')}</div>` : ''}
        <div class="story-reactions">
          ${['❤️', '😂', '😮', '😢', '👏', '🔥', '😍', '💯'].map((emoji) => `<button type="button" class="story-reaction" data-action="react-story" data-id="${story.id}" data-emoji="${emoji}">${emoji}</button>`).join('')}
        </div>
        ${group.user.id !== state.me.id ? `
          <form id="story-reply-form" class="story-reply" data-story="${story.id}">
            <input name="text" type="text" placeholder="Responder..." maxlength="500" />
            <button type="submit" class="btn primary small">Enviar</button>
          </form>` : ''}
        <button type="button" class="story-profile" data-action="story-profile" data-username="${esc(group.user.username)}">
          ${avatar(group.user, 28)} <span>@${esc(group.user.username)}</span>
        </button>
      </footer>
    </div>`;
  document.body.classList.add('story-open');
  hydrateIcons(root);

  story.viewed = true;
  group.allViewed = group.stories.every((item) => item.viewed);
  api(`/api/stories/${story.id}/view`, { method: 'POST' }).catch(() => {});
  storyViewer.timer = setTimeout(storyNext, story.mediaType === 'video' ? 12000 : 6000);
}

export function openStories(userId) {
  const index = state.storyGroups.findIndex((group) => group.user.id === userId);
  if (index < 0) return;
  storyViewer.groups = state.storyGroups;
  storyViewer.groupIndex = index;
  const group = state.storyGroups[index];
  const firstUnseen = group.stories.findIndex((story) => !story.viewed);
  storyViewer.storyIndex = firstUnseen === -1 ? 0 : firstUnseen;
  renderStoryViewer();
}

onBeforeNavigate(() => {
  closeStories();
});

/* ------------------------------------------------------------------ */
/* Explorar                                                           */
/* ------------------------------------------------------------------ */

let exploreContext = null;

export async function renderExplore(viewElement) {
  exploreContext = {
    query: '',
    cursor: null,
    sequence: 0,
    typingTimer: null,
  };

  viewElement.innerHTML = `
    <div class="page">
      <header class="page-head explore-head">
        <div>
          <p class="eyebrow">Explorar</p>
          <h1>Pessoas, interesses e descobertas</h1>
          <p>Busque por pessoas, @usuário ou legenda e encontre conexões sociais. Recomendações românticas ficam no Namoro.</p>
        </div>
      </header>

      <div class="search-box explore-search">
        ${icon('search', 20)}
        <input id="explore-search" type="search" placeholder="Buscar pessoas, @usuário ou legenda" autocomplete="off" aria-label="Buscar pessoas e publicações" />
      </div>

      <section class="explore-people" id="explore-people" aria-label="Pessoas para descobrir">
        <div class="section-head"><h2>Pessoas para descobrir</h2><span class="section-note">Por interesses em comum</span></div>
        <div class="people-grid" id="people-grid">
          ${Array.from({ length: 3 }).map(() => '<div class="skeleton-person"><div class="skeleton-avatar"></div><div class="skeleton-line wide"></div><div class="skeleton-line short"></div></div>').join('')}
        </div>
      </section>

      <section class="explore-posts">
        <div class="section-head"><h2 id="explore-title">Publicações</h2><span class="section-note" id="explore-count"></span></div>
        <div class="explore-grid" id="explore-grid">
          ${Array.from({ length: 6 }).map(() => '<div class="skeleton-square"></div>').join('')}
        </div>
        <div id="explore-more-wrap"></div>
      </section>
    </div>`;

  hydrateIcons(viewElement);
  const input = $('#explore-search');
  if (input) {
    input.addEventListener('input', () => {
      clearTimeout(exploreContext.typingTimer);
      exploreContext.typingTimer = setTimeout(() => {
        exploreContext.query = input.value.trim();
        fetchExplore(true);
      }, 280);
    });
  }
  await fetchExplore(true);
}

export async function fetchExplore(reset) {
  if (!exploreContext) return;
  const context = exploreContext;
  const sequence = ++context.sequence;
  if (reset) context.cursor = null;
  const query = new URLSearchParams();
  if (context.query) query.set('q', context.query);
  if (!reset && context.cursor) query.set('before', String(context.cursor));
  query.set('limit', '24');

  const grid = $('#explore-grid');
  const moreWrap = $('#explore-more-wrap');
  if (grid && reset) {
    grid.innerHTML = Array.from({ length: 6 }).map(() => '<div class="skeleton-square"></div>').join('');
  }
  if (moreWrap && reset) moreWrap.innerHTML = '';

  try {
    const data = await api(`/api/explore?${query.toString()}`);
    if (!exploreContext || sequence !== context.sequence || state.view !== 'explore') return;
    context.cursor = data.nextCursor;
    if (reset) {
      state.explorePosts = data.posts;
      const gridElement = $('#explore-grid');
      if (gridElement) {
        gridElement.innerHTML = data.posts.length
          ? data.posts.map(exploreCard).join('')
          : emptyState({
              iconName: 'image',
              title: 'Nada encontrado',
              text: context.query
                ? 'Tente outra busca ou confira o nome de usuário.'
                : 'Seja a primeira pessoa a publicar por aqui.',
              action: '<button type="button" class="btn primary" data-action="new-post">Criar publicação</button>',
            });
        hydrateIcons(gridElement);
      }
      paintExplorePeople(data.people || []);
      const count = $('#explore-count');
      if (count) count.textContent = data.posts.length ? `${formatCount(data.posts.length)} em destaque` : '';
    } else {
      const known = new Set((state.explorePosts || []).map((post) => post.id));
      const fresh = data.posts.filter((post) => !known.has(post.id));
      state.explorePosts = [...(state.explorePosts || []), ...fresh];
      const gridElement = $('#explore-grid');
      if (gridElement && fresh.length) {
        gridElement.insertAdjacentHTML('beforeend', fresh.map(exploreCard).join(''));
        hydrateIcons(gridElement);
      }
    }
    paintExploreMore();
    if (context.query) await paintSearchPeople(context.query, sequence, context);
  } catch (error) {
    if (sequence !== context.sequence) return;
    const gridElement = $('#explore-grid');
    if (gridElement) {
      gridElement.innerHTML = `<div class="empty-state grid-empty"><h3>Não foi possível carregar</h3><p>${esc(error.message)}</p></div>`;
    }
    throw error;
  }
}

function paintExploreMore() {
  const wrap = $('#explore-more-wrap');
  if (!wrap) return;
  wrap.innerHTML = exploreContext && exploreContext.cursor
    ? '<button type="button" class="btn ghost btn-block load-more" data-action="explore-more">Carregar mais</button>'
    : '';
}

async function paintSearchPeople(query, sequence, context) {
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(query)}`);
    if (!exploreContext || sequence !== context.sequence) return;
    paintExplorePeople(data.users.slice(0, 6));
  } catch {
    /* mantém as sugestões anteriores */
  }
}

function paintExplorePeople(users) {
  const grid = $('#people-grid');
  if (!grid) return;
  if (!users.length) {
    grid.innerHTML = '<p class="muted-note">Nenhuma pessoa encontrada com esses critérios.</p>';
    return;
  }
  grid.innerHTML = users.map((user) => `
    <article class="person-card">
      <button type="button" class="person-main" data-action="profile" data-username="${esc(user.username)}">
        ${avatar(user, 54)}
        <span class="user-meta">
          <strong>${esc(user.name)}</strong>
          <small>@${esc(user.username)}</small>
        </span>
      </button>
      ${user.sharedInterests && user.sharedInterests.length
        ? `<p class="person-note">${user.sharedInterests.length} ${plural(user.sharedInterests.length, 'interesse', 'interesses')} em comum: ${user.sharedInterests.slice(0, 3).map((id) => esc(interestLabel(id))).join(', ')}</p>`
        : '<p class="person-note muted">Descubra interesses no perfil.</p>'}
      <div class="person-actions">
        <button type="button" class="btn ghost small" data-action="profile" data-username="${esc(user.username)}">Ver perfil</button>
        ${user.isMe
          ? '<span class="pill">Você</span>'
          : followButton(user, 'small')}
      </div>
    </article>`).join('');
  hydrateIcons(grid);
}

/* ------------------------------------------------------------------ */
/* Perfil                                                             */
/* ------------------------------------------------------------------ */

export async function renderProfile(viewElement, params = {}) {
  const username = params.username || state.me.username;
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
  state.params.username = data.user.username;

  const cover = data.posts.find((post) => post.mediaType !== 'video') || data.posts[0];
  const bio = data.user.bio
    ? `<p>${captionHtml(data.user.bio)}</p>`
    : '<p class="muted">Sem bio ainda.</p>';
  const policyLabel = data.user.messagePolicy === 'everyone'
    ? 'Qualquer pessoa pode enviar mensagem'
    : data.user.messagePolicy === 'nobody'
      ? 'Ninguém pode enviar mensagem'
      : 'Pessoas que você segue de volta podem enviar mensagem';
  const isPrivate = !!data.user.isPrivate;
  const pendingRequests = data.pendingFollowRequests || 0;
  const badges = Array.isArray(data.badges) ? data.badges : [];
  const privateBadge = isPrivate
    ? `<span class="private-badge">${icon('lock', 12)} Privado</span>`
    : '';

  viewElement.innerHTML = `
    <div class="profile">
      <div class="profile-cover">
        ${cover ? (cover.mediaType === 'video'
          ? `<video src="${esc(cover.image)}" muted playsinline preload="metadata" aria-hidden="true"></video>`
          : `<img src="${esc(cover.image)}" alt="" aria-hidden="true" />`) : ''}
        <span class="profile-cover-shade"></span>
      </div>
      <header class="profile-card">
        <div class="profile-avatar-wrap">${avatar(data.user, 112, 'profile-avatar')}</div>
        <div class="profile-info">
          <div class="profile-top">
            <div class="profile-identity">
              <p class="eyebrow">@${esc(data.user.username)} ${privateBadge}</p>
              <h1>${esc(data.user.name)}</h1>
            </div>
            <div class="profile-actions">
              ${data.isMe
                ? `<button type="button" class="btn ghost" data-action="edit-profile">${icon('edit', 16)} Editar perfil</button>
                   <button type="button" class="btn primary" data-action="nav" data-view="dating">${icon('spark', 16)} Namoro</button>
                   <button type="button" class="btn ghost" data-action="blocked-users">${icon('ban', 16)} Pessoas bloqueadas</button>
                   <button type="button" class="btn ghost" data-action="logout">Sair</button>`
                : `${followButton({ ...data.user, isFollowing: data.isFollowing, followRequested: data.followRequested })}
                   ${data.canMessage ? `<button type="button" class="btn ghost" data-action="message-user" data-username="${esc(data.user.username)}">${icon('message', 16)} Mensagem</button>` : ''}
                   <button type="button" class="icon-btn" data-action="profile-menu" data-username="${esc(data.user.username)}" aria-label="Mais opções">${icon('more')}</button>`}
            </div>
          </div>
          <div class="profile-bio">${bio}</div>
          <div class="profile-stats">
            <span><strong>${formatCount(data.stats.posts)}</strong> ${plural(data.stats.posts, 'publicação', 'publicações')}</span>
            <button type="button" class="profile-stat" data-action="followers-list" data-username="${esc(data.user.username)}">
              <strong data-profile-followers>${formatCount(data.stats.followers)}</strong> ${plural(data.stats.followers, 'seguidor', 'seguidores')}
            </button>
            <button type="button" class="profile-stat" data-action="following-list" data-username="${esc(data.user.username)}">
              <strong>${formatCount(data.stats.following)}</strong> seguindo
            </button>
          </div>
          ${badges.length ? `
            <div class="profile-badges">
              <p class="eyebrow">Conquistas</p>
              <div class="badges">
                ${badges.map((badge) => `<span class="badge" title="${esc(badge.description)}">${icon(badge.icon, 15)} ${esc(badge.label)}</span>`).join('')}
              </div>
            </div>` : ''}
          ${data.isMe ? `
            <div class="profile-privacy">
              <div>
                <strong>Quem pode enviar mensagens</strong>
                <span>${esc(policyLabel)}</span>
              </div>
              <button type="button" class="btn ghost small" data-action="edit-profile">Ajustar</button>
            </div>
            <div class="profile-privacy">
              <div>
                <strong>Perfil ${isPrivate ? 'privado' : 'público'}</strong>
                <span>${isPrivate ? 'Só quem você aprovar pode ver suas publicações e stories.' : 'Qualquer pessoa pode ver suas publicações e stories.'}</span>
              </div>
              <div class="profile-privacy-actions">
                ${isPrivate ? `<button type="button" class="btn ghost small" data-action="follow-requests">${icon('users', 15)} Solicitações <span class="pending-count" data-pending-follow-requests ${pendingRequests > 0 ? '' : 'hidden'}>${pendingRequests}</span></button>` : ''}
                <button type="button" class="btn ghost small" data-action="edit-profile">Ajustar</button>
              </div>
            </div>
            <div class="profile-privacy">
              <div>
                <strong>Melhores amigos</strong>
                <span>Escolha quem vê seus stories exclusivos.</span>
              </div>
              <button type="button" class="btn ghost small" data-action="close-friends">${icon('users', 15)} Gerenciar</button>
            </div>` : ''}
        </div>
      </header>

      ${data.canViewContent ? `
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
                <p>${data.isMe ? 'Sua primeira foto ou vídeo pode estar aqui.' : 'Quando publicar, as fotos aparecem aqui.'}</p>
                ${data.isMe ? '<button type="button" class="btn primary" data-action="new-post">Criar publicação</button>' : ''}
              </div>`}
        </div>`
      : `
        <div class="private-gate">
          <div class="private-gate-icon">${icon('lock', 30)}</div>
          <h2>Este perfil é privado</h2>
          <p>${data.followRequested
            ? 'Sua solicitação está aguardando aprovação. Enquanto isso, as publicações e stories ficam ocultos.'
            : 'Envie uma solicitação para seguir. Quando aprovada, você poderá ver as publicações e stories deste perfil.'}</p>
          ${data.followRequested
            ? `<button type="button" class="btn ghost" data-action="follow" data-username="${esc(data.user.username)}" data-following="false" data-requested="true" data-private="true">Cancelar solicitação</button>`
            : `<button type="button" class="btn primary" data-action="follow" data-username="${esc(data.user.username)}" data-following="false" data-requested="false" data-private="true">${icon('lock', 16)} Solicitar para seguir</button>`}
        </div>`}
    </div>`;
  hydrateIcons(viewElement);
}

/* PART2 */

