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
  initialsFor,
  interestLabel,
  interestChips,
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
import { openAvatarEditor, openCoverEditor } from './media-editor.js';

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
 * Formata a data de criação da conta no formato "mês de ano" (pt-BR).
 * É usado no painel "Sobre mim" para indicar quando a pessoa entrou no Vibra.
 *
 * @param {number|string} timestamp Marca de tempo da criação da conta.
 * @returns {string} Texto como "março de 2024" ou string vazia.
 */
function joinedMonthYear(timestamp) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
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

/**
 * Monta o card usado na grade do perfil.
 *
 * O card reproduz o formato de "post" da referência: a mídia ocupa a parte
 * superior, com o menu "..." flutuando no canto superior direito, e o rodapé
 * concentra as ações reais (curtir, comentar e compartilhar) com os
 * contadores correspondentes. As ações usam `data-action`, reaproveitando o
 * mesmo fluxo do feed; os contadores usam `data-like-count`/`data-comment-count`
 * para serem atualizados sem recarregar a grade.
 *
 * @param {Object} post Publicação retornada pela API.
 * @returns {string} Markup HTML do card.
 */
function gridItem(post) {
  const media = postMedia(post);
  const mine = state.me && post.user.id === state.me.id;
  return `
    <article class="gallery-item">
      <div class="gallery-media-wrap">
        <button type="button" class="gallery-media" data-action="open-post" data-id="${post.id}" aria-label="Abrir publicação de ${esc(post.user.username)}">
          ${thumbMarkup(post)}
          ${media.length > 1 ? `<span class="carousel-badge" aria-label="${media.length} fotos">${icon('image', 13)} ${media.length}</span>` : ''}
          ${post.mediaType === 'video' ? `<span class="gallery-video-mark">${icon('video', 18)}</span>` : ''}
        </button>
        <button type="button" class="gallery-menu" data-action="post-menu" data-id="${post.id}" data-owner="${mine ? '1' : '0'}" aria-label="Mais opções da publicação">
          ${icon('more', 18)}
        </button>
      </div>

      <div class="gallery-foot">
        <div class="gallery-actions">
          <button type="button" class="gallery-action${post.liked ? ' active liked' : ''}" data-action="like" data-like-btn="${post.id}" aria-label="Curtir publicação">
            ${icon('heart', 18)}
          </button>
          <button type="button" class="gallery-action" data-action="open-post" data-id="${post.id}" aria-label="Comentar publicação">
            ${icon('comment', 18)}
          </button>
          <button type="button" class="gallery-action" data-action="share-post" data-id="${post.id}" aria-label="Compartilhar publicação">
            ${icon('share', 18)}
          </button>
        </div>
        <div class="gallery-metrics">
          <span>${icon('heart', 14)} <strong data-like-count="${post.id}">${formatCount(post.likes)}</strong></span>
          <span>${icon('comment', 14)} <strong data-comment-count="${post.id}">${formatCount(post.comments)}</strong></span>
        </div>
      </div>
    </article>`;
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
 * Renderiza a tela inicial (feed) do social - estilo X/Twitter.
 *
 * Layout:
 * - Coluna central: Caixa de criação rápida + Timeline contínua
 * - Lateral direita: 3 caixas (Namoro, Turbo Vibra, Sugestões/Assuntos)
 *
 * @param {HTMLElement} viewElement elemento onde o conteúdo será injetado.
 */
export async function renderHome(viewElement) {
  viewElement.innerHTML = `
    <div class="home-layout">
      <!-- Coluna Central - Feed estilo X -->
      <main class="home-main" id="home-main">
        <!-- Caixa de criação rápida (estilo X) -->
        <section class="quick-post" id="quick-post" aria-label="Criar publicação rápida">
          ${renderQuickPostBox()}
        </section>

        <!-- Divisor "Mostrar posts" -->
        <div class="feed-divider" id="feed-divider">
          <span>Mostrar publicações</span>
        </div>

        <!-- Timeline vertical contínua -->
        <section class="timeline" id="timeline" aria-label="Linha do tempo">
          <div class="feed-grid" id="feed-list">
            ${Array.from({ length: 3 }).map(() => '<div class="skeleton-post"><div class="skeleton-cover"></div><div class="skeleton-body"></div></div>').join('')}
          </div>
          <div id="feed-more-wrap"></div>
        </section>
      </main>

      <!-- Lateral Direita - 3 Caixas -->
      <aside class="home-rail" id="home-rail" aria-label="Recursos e sugestões">
        ${renderRailBoxes()}
      </aside>
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

  // Renderiza stories (Agora) no topo da timeline se houver
  renderAgora();

  // Renderiza as 3 caixas da lateral
  renderRailBoxesContent(suggestions.users || []);

  // Renderiza o feed
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

/**
 * Renderiza a caixa de criação rápida estilo X/Twitter.
 */
function renderQuickPostBox() {
  const me = state.me;
  if (!me) return '';

  return `
    <form id="quick-post-form" class="quick-post-form" data-action="quick-post-submit">
      <div class="quick-post-header">
        ${avatar(me, 40)}
        <div class="quick-post-input-wrapper">
          <textarea
            name="caption"
            class="quick-post-input"
            placeholder="O que está acontecendo?"
            maxlength="2200"
            rows="1"
            aria-label="O que está acontecendo?"
          ></textarea>
          <div class="quick-post-hint" hidden>Máximo 2200 caracteres</div>
        </div>
      </div>

      <div class="quick-post-media-preview" id="quick-post-media-preview" hidden></div>

      <div class="quick-post-toolbar">
        <div class="quick-post-tools">
          <button type="button" class="quick-post-tool" data-action="quick-post-media" aria-label="Adicionar foto ou vídeo">
            ${icon('image', 20)}
          </button>
          <button type="button" class="quick-post-tool" data-action="quick-post-gif" aria-label="Adicionar GIF">
            ${icon('gif', 20)}
          </button>
          <button type="button" class="quick-post-tool" data-action="quick-post-poll" aria-label="Criar enquete">
            ${icon('chart', 20)}
          </button>
          <button type="button" class="quick-post-tool" data-action="quick-post-emoji" aria-label="Adicionar emoji">
            ${icon('smile', 20)}
          </button>
          <button type="button" class="quick-post-tool" data-action="quick-post-schedule" aria-label="Agendar publicação">
            ${icon('calendar', 20)}
          </button>
          <button type="button" class="quick-post-tool" data-action="quick-post-location" aria-label="Adicionar localização">
            ${icon('mapPin', 20)}
          </button>
        </div>
        <div class="quick-post-actions">
          <button type="button" class="btn ghost quick-post-cancel" data-action="quick-post-cancel" hidden>Cancelar</button>
          <button type="submit" class="btn primary quick-post-submit-btn" disabled>
            <span data-icon="send" class="quick-post-send-icon"></span>
            <span>Postar</span>
          </button>
        </div>
      </div>

      <input type="file" id="quick-post-media-input" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" multiple hidden />
    </form>`;
}

/**
 * Renderiza as 3 caixas da lateral direita.
 */
function renderRailBoxes() {
  return `
    <!-- Caixa 1: Sistema de Namoro -->
    <section class="rail-box rail-box-dating" id="rail-box-dating">
      <div class="rail-box-content">
        <div class="rail-box-icon dating">
          ${icon('spark', 28)}
        </div>
        <div class="rail-box-text">
          <h3>Namoro no Vibra</h3>
          <p>Conheça pessoas com intenção. Verificação de identidade, quiz de afinidade e Radar consensual para conexões seguras e reais.</p>
        </div>
        <button type="button" class="btn primary rail-box-cta" data-action="nav" data-view="dating">
          <span data-icon="spark" class="rail-box-cta-icon"></span>
          Conhecer o Namoro
        </button>
        <small class="rail-box-note">Apenas para maiores de 18 anos com verificação aprovada.</small>
      </div>
    </section>

    <!-- Caixa 2: Turbo Vibra -->
    <section class="rail-box rail-box-turbo" id="rail-box-turbo">
      <div class="rail-box-content">
        <div class="rail-box-icon turbo">
          ${icon('bolt', 28)}
        </div>
        <div class="rail-box-text">
          <h3>Turbo Vibra</h3>
          <p>Desbloqueie vantagens exclusivas: curtidas ilimitadas, personalização completa do perfil com fotos e banners em GIF, e mais visibilidade.</p>
        </div>
        <button type="button" class="btn primary rail-box-cta" data-action="open-turbo">
          <span data-icon="bolt" class="rail-box-cta-icon"></span>
          Ativar Turbo
        </button>
        <small class="rail-box-note">Assinatura mensal. Cancele quando quiser.</small>
      </div>
    </section>

    <!-- Caixa 3: Sugestões Personalizadas / Assuntos de Interesse -->
    <section class="rail-box rail-box-topics" id="rail-box-topics">
      <div class="rail-box-content">
        <div class="rail-box-icon topics">
          ${icon('hashtag', 28)}
        </div>
        <div class="rail-box-text">
          <h3>Assuntos do seu interesse</h3>
          <p>Descubra publicações e pessoas baseadas nos temas que você curte. Personalize seus interesses no perfil para recomendações melhores.</p>
        </div>
        <button type="button" class="btn ghost rail-box-cta" data-action="nav" data-view="explore">
          <span data-icon="compass" class="rail-box-cta-icon"></span>
          Explorar assuntos
        </button>
        <div class="rail-box-topics-list" id="rail-box-topics-list"></div>
      </div>
    </section>`;
}

/**
 * Preenche o conteúdo dinâmico das caixas da lateral (tópicos de interesse).
 */
async function renderRailBoxesContent(suggestedUsers) {
  // Preenche tópicos de interesse na Caixa 3
  const topicsList = $('#rail-box-topics-list');
  if (topicsList && state.config.interests && state.config.interests.length) {
    const userInterests = state.me?.interests || [];
    const displayInterests = userInterests.length
      ? state.config.interests.filter(i => userInterests.includes(i.id)).slice(0, 5)
      : state.config.interests.slice(0, 5);

    if (displayInterests.length) {
      topicsList.innerHTML = `
        <p class="rail-box-topics-label">Seus interesses:</p>
        <div class="chips">
          ${displayInterests.map(interest => `
            <span class="chip chip-static" data-action="nav" data-view="explore" data-interest="${esc(interest.id)}">
              ${esc(interest.label)}
            </span>
          `).join('')}
        </div>`;
    }
  }

  // Preenche sugestões de usuários na Caixa 1 (opcional - pessoas para seguir no Namoro)
  // Mantemos a renderização original de sugestões se necessário
}

/**
 * Configura os event listeners da caixa de criação rápida.
 */
export function setupQuickPostListeners() {
  const form = $('#quick-post-form');
  if (!form) return;

  const textarea = form.querySelector('.quick-post-input');
  const submitBtn = form.querySelector('.quick-post-submit-btn');
  const cancelBtn = form.querySelector('.quick-post-cancel');
  const mediaInput = $('#quick-post-media-input');
  const mediaPreview = $('#quick-post-media-preview');
  const hint = form.querySelector('.quick-post-hint');

  if (!textarea || !submitBtn || !mediaInput || !mediaPreview) return;

  // Auto-resize textarea
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';

    const length = textarea.value.length;
    submitBtn.disabled = length === 0 && !mediaPreview.querySelector('img, video');
    hint.hidden = length < 2000;
    if (length > 2000) hint.textContent = `Excedido em ${length - 2200} caracteres`;
  });

  // Cancel button
  cancelBtn?.addEventListener('click', () => {
    resetQuickPostForm();
  });

  // Media selection (Foto/Vídeo)
  const mediaTools = form.querySelector('[data-action="quick-post-media"]');
  mediaTools?.addEventListener('click', () => mediaInput.click());

  mediaInput.addEventListener('change', async () => {
    const files = [...(mediaInput.files || [])];
    if (!files.length) return;

    if (files.length > 10) {
      toast('Escolha no máximo 10 fotos por publicação.', 'error');
      mediaInput.value = '';
      return;
    }

    const hasVideo = files.some(f => f.type.startsWith('video/'));
    if (hasVideo && files.length > 1) {
      toast('Para publicar vídeo, selecione apenas um arquivo.', 'error');
      mediaInput.value = '';
      return;
    }

    try {
      mediaPreview.innerHTML = '';
      mediaPreview.hidden = false;
      cancelBtn.hidden = false;

      if (hasVideo) {
        const file = files[0];
        if (file.size > 1024 * 1024 * 1024) {
          toast('O vídeo pode ter no máximo 1 GB.', 'error');
          mediaInput.value = '';
          return;
        }
        const duration = await readVideoDuration(file);
        if (duration > 60 * 60) {
          toast('O vídeo pode ter no máximo 60 minutos.', 'error');
          mediaInput.value = '';
          return;
        }
        const url = URL.createObjectURL(file);
        mediaPreview.innerHTML = `
          <video src="${url}" controls playsinline class="quick-post-media-item"></video>
          <button type="button" class="quick-post-media-remove" data-action="quick-post-remove-media" aria-label="Remover vídeo">${icon('close', 16)}</button>
        `;
      } else {
        for (const file of files) {
          if (file.size > 8 * 1024 * 1024) {
            toast('A imagem pode ter no máximo 8 MB.', 'error');
            mediaInput.value = '';
            return;
          }
          const dataUrl = await fileToDataUrl(file);
          mediaPreview.insertAdjacentHTML('beforeend', `
            <figure class="quick-post-media-item">
              <img src="${dataUrl}" alt="Prévia da foto" />
              <button type="button" class="quick-post-media-remove" data-action="quick-post-remove-media" aria-label="Remover foto">${icon('close', 16)}</button>
            </figure>
          `);
        }
      }
      submitBtn.disabled = false;
      mediaInput.value = '';
    } catch (error) {
      toast(error.message, 'error');
      mediaInput.value = '';
    }
  });

  // GIF Selection
  const gifTool = form.querySelector('[data-action="quick-post-gif"]');
  gifTool?.addEventListener('click', () => openGifModal());

  // Poll Creation
  const pollTool = form.querySelector('[data-action="quick-post-poll"]');
  pollTool?.addEventListener('click', () => togglePollFields());

  // Emoji Picker
  const emojiTool = form.querySelector('[data-action="quick-post-emoji"]');
  emojiTool?.addEventListener('click', (e) => openEmojiPicker(e, textarea));

  // Schedule Post
  const scheduleTool = form.querySelector('[data-action="quick-post-schedule"]');
  scheduleTool?.addEventListener('click', () => openSchedulePicker());

  // Location
  const locationTool = form.querySelector('[data-action="quick-post-location"]');
  locationTool?.addEventListener('click', () => addLocation());

  // Remove media
  mediaPreview.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-action="quick-post-remove-media"]');
    if (removeBtn) {
      const item = removeBtn.closest('.quick-post-media-item');
      item?.remove();
      if (!mediaPreview.querySelector('.quick-post-media-item')) {
        mediaPreview.hidden = true;
        cancelBtn.hidden = true;
        submitBtn.disabled = textarea.value.trim().length === 0;
      }
    }
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleQuickPostSubmit(form);
  });
}

/**
 * Reseta o formulário de postagem rápida.
 */
function resetQuickPostForm() {
  const form = $('#quick-post-form');
  if (!form) return;

  const textarea = form.querySelector('.quick-post-input');
  const mediaPreview = $('#quick-post-media-preview');
  const cancelBtn = form.querySelector('.quick-post-cancel');
  const submitBtn = form.querySelector('.quick-post-submit-btn');
  const hint = form.querySelector('.quick-post-hint');

  if (textarea) {
    textarea.value = '';
    textarea.style.height = 'auto';
  }
  if (mediaPreview) {
    mediaPreview.innerHTML = '';
    mediaPreview.hidden = true;
  }
  if (cancelBtn) cancelBtn.hidden = true;
  if (submitBtn) submitBtn.disabled = true;
  if (hint) hint.hidden = true;
}

/**
 * Lê a duração de um arquivo de vídeo.
 */
function readVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      callback(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('Não foi possível verificar a duração.')), 10000);
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0) finish(resolve, duration);
      else finish(reject, new Error('Não foi possível verificar a duração.'));
    };
    video.onerror = () => finish(reject, new Error('Não foi possível ler o vídeo.'));
    video.src = url;
  });
}

/* ------------------------------------------------------------------ */
/* Quick Post Toolbar Actions                                         */
/* ------------------------------------------------------------------ */

// Estado para controles da quick post
let quickPostState = {
  pollOptions: ['', ''],
  pollDuration: 7, // dias
  scheduledDate: null,
  location: null,
  gifUrl: null
};

/** Abre modal de busca de GIFs (simulado com Giphy-like search) */
function openGifModal() {
  const trendingGifs = [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3aWQ9Zw/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3aWQ9Zw/3oEjI6SIIHBdRxXI40/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3aWQ9Zw/l0HlBO7eyXzSZkJri/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3aWQ9Zw/xT0xeJpnrWC4XWblEk/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3aWQ9Zw/3oKIPwoeGErMmaI43G/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3Z3J3aWQ9Zw/l0HlNa5v3Fs7lyT9K/giphy.gif'
  ];

  openModal(`
    <div class="modal-head">
      <h2>Adicionar GIF</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
    </div>
    <div class="modal-form">
      <div class="gif-search">
        <input type="text" id="gif-search-input" placeholder="Buscar GIFs..." class="gif-search-input" autocomplete="off">
        <div class="gif-search-results" id="gif-search-results">
          ${trendingGifs.map(url => `
            <button type="button" class="gif-result-item" data-gif-url="${esc(url)}" aria-label="Selecionar GIF">
              <img src="${esc(url)}" alt="GIF" loading="lazy">
            </button>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn ghost" data-action="close-modal">Cancelar</button>
    </div>
  `, 'gif-modal');
  hydrateIcons($('#modal-root'));

  // Event listeners para busca de GIFs
  const searchInput = $('#gif-search-input');
  const resultsContainer = $('#gif-search-results');
  let searchTimeout;

  if (searchInput && resultsContainer) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const query = searchInput.value.trim();
        if (query.length < 2) {
          // Mostrar trending novamente
          resultsContainer.innerHTML = trendingGifs.map(url => `
            <button type="button" class="gif-result-item" data-gif-url="${esc(url)}" aria-label="Selecionar GIF">
              <img src="${esc(url)}" alt="GIF" loading="lazy">
            </button>
          `).join('');
          return;
        }
        
        resultsContainer.innerHTML = '<div class="gif-loading">Buscando...</div>';
        
        // Simulação de busca - em produção usaria API real do Giphy/Tenor
        try {
          // Aqui faria fetch real para Giphy API
          // const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=YOUR_KEY&q=${encodeURIComponent(query)}&limit=20`);
          // const data = await response.json();
          // resultsContainer.innerHTML = data.data.map(gif => `...`).join('');
          
          // Por enquanto, filtra os trending
          resultsContainer.innerHTML = trendingGifs.map(url => `
            <button type="button" class="gif-result-item" data-gif-url="${esc(url)}" aria-label="Selecionar GIF">
              <img src="${esc(url)}" alt="GIF" loading="lazy">
            </button>
          `).join('');
        } catch {
          resultsContainer.innerHTML = '<div class="gif-error">Erro ao buscar GIFs</div>';
        }
      }, 300);
    });

    resultsContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.gif-result-item');
      if (item) {
        const gifUrl = item.dataset.gifUrl;
        addGifToPost(gifUrl);
        closeModal();
      }
    });

    searchInput.focus();
  }
}

/** Adiciona GIF selecionado ao post */
function addGifToPost(gifUrl) {
  const mediaPreview = $('#quick-post-media-preview');
  const cancelBtn = $('#quick-post-form .quick-post-cancel');
  const submitBtn = $('#quick-post-form .quick-post-submit-btn');
  
  if (!mediaPreview) return;
  
  mediaPreview.innerHTML = '';
  mediaPreview.hidden = false;
  if (cancelBtn) cancelBtn.hidden = false;
  
  mediaPreview.insertAdjacentHTML('beforeend', `
    <figure class="quick-post-media-item">
      <img src="${esc(gifUrl)}" alt="GIF" />
      <button type="button" class="quick-post-media-remove" data-action="quick-post-remove-media" aria-label="Remover GIF">${icon('close', 16)}</button>
    </figure>
  `);
  
  if (submitBtn) submitBtn.disabled = false;
  quickPostState.gifUrl = gifUrl;
}

/** Alterna exibição dos campos de enquete */
function togglePollFields() {
  const form = $('#quick-post-form');
  if (!form) return;
  
  let pollContainer = form.querySelector('.quick-post-poll-container');
  
  if (pollContainer) {
    // Remover campos de enquete
    pollContainer.remove();
    quickPostState.pollOptions = ['', ''];
  } else {
    // Adicionar campos de enquete
    pollContainer = document.createElement('div');
    pollContainer.className = 'quick-post-poll-container';
    pollContainer.innerHTML = `
      <div class="poll-header">
        <span>${icon('chart', 16)} Enquete</span>
        <button type="button" class="poll-close" data-action="quick-post-poll-close" aria-label="Remover enquete">${icon('close', 16)}</button>
      </div>
      <div class="poll-options" id="poll-options">
        <div class="poll-option">
          <input type="text" class="poll-option-input" placeholder="Opção 1" maxlength="50" value="${esc(quickPostState.pollOptions[0])}">
        </div>
        <div class="poll-option">
          <input type="text" class="poll-option-input" placeholder="Opção 2" maxlength="50" value="${esc(quickPostState.pollOptions[1])}">
        </div>
      </div>
      <div class="poll-controls">
        <button type="button" class="btn ghost small" data-action="poll-add-option">${icon('plus', 14)} Adicionar opção</button>
        <div class="poll-duration">
          <label>Duração: </label>
          <select class="poll-duration-select" id="poll-duration-select">
            <option value="1" ${quickPostState.pollDuration === 1 ? 'selected' : ''}>1 dia</option>
            <option value="3" ${quickPostState.pollDuration === 3 ? 'selected' : ''}>3 dias</option>
            <option value="7" ${quickPostState.pollDuration === 7 ? 'selected' : ''}>7 dias</option>
            <option value="30" ${quickPostState.pollDuration === 30 ? 'selected' : ''}>30 dias</option>
          </select>
        </div>
      </div>
    `;
    
    // Inserir antes da toolbar
    const toolbar = form.querySelector('.quick-post-toolbar');
    form.insertBefore(pollContainer, toolbar);
    
    // Event listeners para enquete
    pollContainer.querySelector('[data-action="quick-post-poll-close"]')?.addEventListener('click', () => {
      pollContainer.remove();
      quickPostState.pollOptions = ['', ''];
    });
    
    pollContainer.querySelector('[data-action="poll-add-option"]')?.addEventListener('click', () => {
      if (quickPostState.pollOptions.length < 4) {
        quickPostState.pollOptions.push('');
        const optionsContainer = pollContainer.querySelector('#poll-options');
        optionsContainer.insertAdjacentHTML('beforeend', `
          <div class="poll-option">
            <input type="text" class="poll-option-input" placeholder="Opção ${quickPostState.pollOptions.length}" maxlength="50">
          </div>
        `);
      }
    });
    
    pollContainer.querySelector('#poll-duration-select')?.addEventListener('change', (e) => {
      quickPostState.pollDuration = parseInt(e.target.value);
    });
    
    pollContainer.querySelectorAll('.poll-option-input').forEach((input, index) => {
      input.addEventListener('input', () => {
        quickPostState.pollOptions[index] = input.value;
      });
    });
  }
}

/** Abre seletor de emojis */
function openEmojiPicker(event, textarea) {
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  
  // Categorias de emojis comuns
  const emojiCategories = {
    'Smileys': ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
    'Gestos': ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦿','🦶','🦷','🦴','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦'],
    'Corações': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🧡','💛','💚','💙','💜','🖤','🤍','🤎'],
    'Natureza': ['🌞','🌝','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌙','🌎','🌍','🌏','🪐','⭐','🌟','🌠','☀️','🌤️','⛅','🌥️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','☄️','🌊','🌈','🗻','🏔️','⛰️','🌋','🏞️','🏜️','🏝️','🏖️','🏟️','🏛️','🏗️','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛱️','🌁','🌃','🌄','🌅','🌆','🌇','🌉','♨️','🎠','🎡','🎢','💈','🎪','🚂','🚁','🚀','✈️','🛸','🛶','⛵','🚤','🛳️'],
    'Comida': ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍩','🍪','🌰','🥜','🍯','🥛','🍼','☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊']
  };

  // Remover picker anterior se existir
  const existingPicker = document.querySelector('.emoji-picker-popover');
  if (existingPicker) existingPicker.remove();

  const picker = document.createElement('div');
  picker.className = 'emoji-picker-popover';
  picker.style.cssText = `
    position: fixed;
    top: ${rect.bottom + 8}px;
    left: ${rect.left}px;
    z-index: 1000;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    padding: 12px;
    max-width: 320px;
    max-height: 400px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `;

  let html = '<div class="emoji-tabs" style="display: flex; gap: 4px; margin-bottom: 8px; overflow-x: auto; padding-bottom: 4px;">';
  Object.keys(emojiCategories).forEach((cat, i) => {
    html += `<button type="button" class="emoji-tab ${i === 0 ? 'active' : ''}" data-category="${cat}" style="padding: 6px 10px; border: none; background: ${i === 0 ? 'var(--primary-soft)' : 'transparent'}; color: ${i === 0 ? 'var(--primary)' : 'var(--muted)'}; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; cursor: pointer;">${cat}</button>`;
  });
  html += '</div>';
  
  html += '<div class="emoji-content" style="flex: 1; overflow-y: auto; max-height: 300px;">';
  Object.entries(emojiCategories).forEach(([cat, emojis], i) => {
    html += `<div class="emoji-category ${i === 0 ? 'active' : ''}" data-category="${cat}" style="${i === 0 ? '' : 'display: none;'}">`;
    html += '<div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px;">';
    emojis.forEach(emoji => {
      html += `<button type="button" class="emoji-btn" data-emoji="${esc(emoji)}" style="width: 100%; aspect-ratio: 1; border: none; background: transparent; font-size: 22px; cursor: pointer; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: background 0.1s;">${emoji}</button>`;
    });
    html += '</div></div>';
  });
  html += '</div>';

  picker.innerHTML = html;
  document.body.appendChild(picker);

  // Event listeners
  picker.querySelectorAll('.emoji-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      picker.querySelectorAll('.emoji-tab').forEach(t => {
        t.style.background = 'transparent';
        t.style.color = 'var(--muted)';
      });
      tab.style.background = 'var(--primary-soft)';
      tab.style.color = 'var(--primary)';
      
      const category = tab.dataset.category;
      picker.querySelectorAll('.emoji-category').forEach(cat => {
        cat.style.display = cat.dataset.category === category ? 'block' : 'none';
      });
    });
  });

  picker.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.dataset.emoji;
      insertEmojiAtCursor(textarea, emoji);
      picker.remove();
    });
    btn.addEventListener('mouseenter', () => btn.style.background = 'var(--surface-2)');
    btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
  });

  // Fechar ao clicar fora
  const closeHandler = (e) => {
    if (!picker.contains(e.target) && e.target !== button) {
      picker.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

/** Insere emoji na posição do cursor */
function insertEmojiAtCursor(textarea, emoji) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  textarea.value = text.substring(0, start) + emoji + text.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
  textarea.focus();
  textarea.dispatchEvent(new Event('input'));
}

/** Abre seletor de data/hora para agendamento */
function openSchedulePicker() {
  const form = $('#quick-post-form');
  if (!form) return;

  let scheduleContainer = form.querySelector('.quick-post-schedule-container');
  
  if (scheduleContainer) {
    scheduleContainer.remove();
    quickPostState.scheduledDate = null;
    return;
  }

  const now = new Date();
  const minDate = now.toISOString().slice(0, 16);
  const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  scheduleContainer = document.createElement('div');
  scheduleContainer.className = 'quick-post-schedule-container';
  scheduleContainer.innerHTML = `
    <div class="schedule-header">
      <span>${icon('calendar', 16)} Agendar publicação</span>
      <button type="button" class="schedule-close" data-action="quick-post-schedule-close" aria-label="Remover agendamento">${icon('close', 16)}</button>
    </div>
    <div class="schedule-inputs">
      <label>
        Data e hora:
        <input type="datetime-local" id="schedule-datetime" min="${minDate}" max="${maxDate}" value="${quickPostState.scheduledDate || ''}">
      </label>
    </div>
  `;

  const toolbar = form.querySelector('.quick-post-toolbar');
  form.insertBefore(scheduleContainer, toolbar);

  scheduleContainer.querySelector('[data-action="quick-post-schedule-close"]')?.addEventListener('click', () => {
    scheduleContainer.remove();
    quickPostState.scheduledDate = null;
  });

  scheduleContainer.querySelector('#schedule-datetime')?.addEventListener('change', (e) => {
    quickPostState.scheduledDate = e.target.value ? new Date(e.target.value).toISOString() : null;
  });
}

/** Adiciona localização (geolocalização do navegador) */
function addLocation() {
  if (!navigator.geolocation) {
    toast('Geolocalização não suportada neste navegador.', 'error');
    return;
  }

  toast('Obtendo localização...');
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      // Em produção, faria reverse geocoding para obter nome da cidade
      const locationName = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
      quickPostState.location = { latitude, longitude, name: locationName };
      showLocationInPost(locationName);
      toast('Localização adicionada.');
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        toast('Permissão de localização negada. Ative nas configurações do navegador.', 'error');
      } else {
        toast('Não foi possível obter a localização.', 'error');
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

/** Mostra localização na caixa de postagem */
function showLocationInPost(locationName) {
  const form = $('#quick-post-form');
  if (!form) return;

  let locationContainer = form.querySelector('.quick-post-location-container');
  
  if (locationContainer) {
    locationContainer.querySelector('.location-name').textContent = locationName;
    return;
  }

  locationContainer = document.createElement('div');
  locationContainer.className = 'quick-post-location-container';
  locationContainer.innerHTML = `
    <div class="location-header">
      <span>${icon('mapPin', 16)} Localização</span>
      <button type="button" class="location-close" data-action="quick-post-location-close" aria-label="Remover localização">${icon('close', 16)}</button>
    </div>
    <div class="location-name">${esc(locationName)}</div>
  `;

  const toolbar = form.querySelector('.quick-post-toolbar');
  form.insertBefore(locationContainer, toolbar);

  locationContainer.querySelector('[data-action="quick-post-location-close"]')?.addEventListener('click', () => {
    locationContainer.remove();
    quickPostState.location = null;
  });
}

/** Reseta estado da quick post */
function resetQuickPostState() {
  quickPostState = {
    pollOptions: ['', ''],
    pollDuration: 7,
    scheduledDate: null,
    location: null,
    gifUrl: null
  };
}

/** Manipula o envio da postagem rápida (versão completa com poll, schedule, location, gif) */
async function handleQuickPostSubmit(form) {
  const textarea = form.querySelector('.quick-post-input');
  const mediaPreview = $('#quick-post-media-preview');
  const submitBtn = form.querySelector('.quick-post-submit-btn');

  const caption = textarea?.value.trim() || '';
  const mediaItems = [...mediaPreview?.querySelectorAll('.quick-post-media-item') || []];

  // Verifica se tem enquete
  const pollOptions = quickPostState.pollOptions.filter(opt => opt.trim());
  const hasPoll = pollOptions.length >= 2;

  if (!caption && mediaItems.length === 0 && !hasPoll && !quickPostState.gifUrl) return;

  setBusy(submitBtn, true);

  try {
    const body = { caption };

    if (mediaItems.length === 1) {
      const item = mediaItems[0];
      const isVideo = item.querySelector('video');
      if (isVideo) {
        toast('Para vídeos, use o botão "Publicar" completo.', 'error');
        setBusy(submitBtn, false);
        return;
      } else {
        const img = item.querySelector('img');
        if (img) body.image = img.src;
      }
    } else if (mediaItems.length > 1) {
      body.images = mediaItems.map(item => {
        const img = item.querySelector('img');
        return img?.src;
      }).filter(Boolean);
    }

    // Adiciona GIF se houver
    if (quickPostState.gifUrl) {
      body.gif = quickPostState.gifUrl;
    }

    // Adiciona enquete
    if (hasPoll) {
      body.poll = {
        options: pollOptions,
        durationDays: quickPostState.pollDuration
      };
    }

    // Adiciona agendamento
    if (quickPostState.scheduledDate) {
      body.scheduledAt = quickPostState.scheduledDate;
    }

    // Adiciona localização
    if (quickPostState.location) {
      body.location = quickPostState.location;
    }

    await api('/api/posts', { method: 'POST', body: JSON.stringify(body) });
    resetQuickPostForm();
    resetQuickPostState();
    toast('Publicação criada.');
    await navigate('home');
  } catch (error) {
    toast(error.message || 'Não foi possível publicar.', 'error');
  } finally {
    setBusy(submitBtn, false);
  }
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

/**
 * Aplica no estado local o retorno de `PATCH /api/me`.
 *
 * O DTO do usuário não traz `pendingFollowRequests` nem `badges`; ambos são
 * repostos manualmente para não perder os contadores exibidos na interface.
 *
 * @param {object} result Resposta da API.
 */
function applyMeUpdate(result) {
  if (!result || !result.user) return;
  state.me = result.user;
  state.stats = result.stats;
  state.me.pendingFollowRequests = Number.isFinite(result.pendingFollowRequests)
    ? result.pendingFollowRequests
    : 0;
  state.me.badges = Array.isArray(result.badges) ? result.badges : [];
  refreshNavAvatar();
}

/**
 * Abas disponíveis no perfil, na ordem exibida.
 *
 * @type {Array<{id: string, label: string, icon: string}>}
 */
const PROFILE_TABS = [
  { id: 'posts', label: 'Publicações', icon: 'grid' },
  { id: 'reels', label: 'Reels', icon: 'reel' },
  { id: 'photos', label: 'Fotos', icon: 'image' },
  { id: 'likes', label: 'Curtidas', icon: 'heart' },
];

/**
 * Monta a barra de abas do perfil.
 *
 * @param {object} data Dados do perfil exibido.
 * @param {string} active Aba atualmente selecionada.
 * @returns {string} Markup HTML das abas.
 */
function profileTabsMarkup(data, active) {
  return `
    <nav class="profile-tabs" role="tablist" aria-label="Conteúdo do perfil">
      ${PROFILE_TABS.map((tab) => `
        <button type="button" class="profile-tab${tab.id === active ? ' is-active' : ''}" role="tab"
          aria-selected="${tab.id === active}" data-action="profile-tab" data-tab="${tab.id}">
          ${icon(tab.icon, 16)} <span>${esc(tab.label)}</span>
        </button>`).join('')}
    </nav>`;
}

/**
 * Carrega as publicações correspondentes a uma aba do perfil.
 *
 * As abas Publicações, Reels e Fotos são filtradas a partir dos posts já
 * baixados; a aba Curtidas usa a lista de curtidas da pessoa autenticada.
 *
 * @param {object} data Dados do perfil exibido.
 * @param {string} tab Identificador da aba.
 * @returns {Promise<Array>} Lista de publicações da aba.
 */
async function loadProfileTabPosts(data, tab) {
  const posts = Array.isArray(data.posts) ? data.posts : [];
  if (tab === 'reels') return posts.filter((post) => post.mediaType === 'video');
  if (tab === 'photos') return posts.filter((post) => post.mediaType !== 'video');
  if (tab === 'likes') {
    const username = state.me && state.me.username ? state.me.username : data.user.username;
    const result = await api(`/api/users/${encodeURIComponent(username)}/likes`);
    return Array.isArray(result.posts) ? result.posts : [];
  }
  return posts;
}

/**
 * Monta o card vertical usado na aba Reels.
 *
 * @param {Object} post Publicação de vídeo.
 * @returns {string} Markup HTML do card.
 */
function profileReelItem(post) {
  const [cover] = postMedia(post);
  return `
    <button type="button" class="reel-item" data-action="open-post" data-id="${post.id}"
      aria-label="Abrir reel de ${esc(post.user.username)}">
      <video src="${esc(cover.url)}" muted playsinline preload="metadata" aria-hidden="true"></video>
      <span class="reel-item-mark">${icon('reel', 16)}</span>
      <span class="reel-item-meta">
        <span>${icon('heart', 14)} ${formatCount(post.likes)}</span>
        <span>${icon('comment', 14)} ${formatCount(post.comments)}</span>
      </span>
    </button>`;
}

/**
 * Monta o conteúdo (grade) de uma aba do perfil.
 *
 * @param {Array} posts Publicações da aba.
 * @param {string} tab Identificador da aba.
 * @param {object} data Dados do perfil exibido.
 * @returns {string} Markup HTML da grade.
 */
function profileTabContent(posts, tab, data) {
  if (!posts.length) {
    const empty = {
      posts: {
        title: 'Nenhuma publicação',
        own: 'Suas fotos e vídeos aparecerão aqui.',
        other: 'Quando publicar, as fotos e vídeos aparecem aqui.',
      },
      reels: {
        title: 'Nenhum reel',
        own: 'Suas fotos e vídeos aparecerão aqui.',
        other: 'Quando publicar, os vídeos aparecem aqui.',
      },
      photos: {
        title: 'Nenhuma foto',
        own: 'Suas fotos e vídeos aparecerão aqui.',
        other: 'Quando publicar, as fotos aparecem aqui.',
      },
      likes: {
        title: 'Nenhuma curtida',
        own: 'As publicações que você curtir aparecem aqui.',
        other: 'As publicações que você curtiu aparecem aqui.',
      },
    }[tab] || { title: 'Nada por aqui', own: 'Este perfil ainda não tem conteúdo.', other: 'Este perfil ainda não tem conteúdo.' };
    const canCreate = data.isMe && (tab === 'posts' || tab === 'reels' || tab === 'photos');
    return `<div class="empty-state grid-empty">
      <div class="empty-icon">${icon(tab === 'likes' ? 'heart' : 'camera', 30)}</div>
      <h3>${esc(empty.title)}</h3>
      <p>${esc(data.isMe ? empty.own : empty.other)}</p>
      ${canCreate ? '<button type="button" class="btn primary" data-action="new-post">Criar publicação</button>' : ''}
    </div>`;
  }
  if (tab === 'reels') {
    return `<div class="reel-grid">${posts.map(profileReelItem).join('')}</div>`;
  }
  return `<div class="gallery">${posts.map(gridItem).join('')}</div>`;
}

/**
 * Troca a aba exibida no perfil e recarrega o conteúdo correspondente.
 *
 * @param {string} tab Identificador da aba.
 * @returns {Promise<void>} Resolve após a renderização da aba.
 */
export async function selectProfileTab(tab) {
  const data = state.profile;
  if (!data || !data.user) return;
  const known = PROFILE_TABS.some((item) => item.id === tab);
  if (!known) return;
  state.profileTab = tab;

  const viewElement = $('#view');
  if (!viewElement) return;

  $$('.profile-tab', viewElement).forEach((button) => {
    const isActive = button.dataset.tab === tab;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  const container = $('#profile-tab-content', viewElement);
  if (!container) return;
  container.innerHTML = '<div class="page-loading"><span class="spinner" aria-hidden="true"></span><span>Carregando...</span></div>';

  try {
    const posts = await loadProfileTabPosts(data, tab);
    if (state.profileTab !== tab || state.view !== 'profile') return;
    container.innerHTML = profileTabContent(posts, tab, data);
    hydrateIcons(container);
  } catch (error) {
    if (state.profileTab !== tab) return;
    container.innerHTML = `<div class="empty-state grid-empty">
      <div class="empty-icon">${icon('alert', 30)}</div>
      <h3>Não foi possível carregar</h3>
      <p>${esc(error.message || 'Tente novamente em instantes.')}</p>
    </div>`;
    hydrateIcons(container);
  }
}

/**
 * Monta o painel "Sobre mim" com os dados públicos do perfil.
 *
 * Usa apenas informações liberadas pela rota de perfil do backend (bio,
 * data de criação, interesses, selos e estatísticas), sem inventar dados nem
 * expor campos privados de contas bloqueadas ou em modo privado.
 *
 * @param {object} data Dados do perfil exibido.
 * @returns {string} Markup HTML do painel.
 */
function profileAboutPanel(data) {
  const user = data.user || {};
  const badges = Array.isArray(data.badges) ? data.badges : [];
  const interests = Array.isArray(user.interests) ? user.interests : [];
  const bio = user.bio
    ? `<p class="profile-about-text">${captionHtml(user.bio)}</p>`
    : '<p class="profile-about-text muted">Esta pessoa ainda não escreveu uma bio.</p>';

  /* A data de entrada vem da criação da conta; só aparece quando existe. */
  const joined = user.createdAt
    ? `<li class="profile-about-meta-item">${icon('calendar', 15)}<span>Entrou em ${esc(joinedMonthYear(user.createdAt))}</span></li>`
    : '';

  /* O local é exibido apenas quando a conta registrou uma cidade pública. */
  const place = user.location
    ? `<li class="profile-about-meta-item">${icon('mapPin', 15)}<span>${esc(user.location)}</span></li>`
    : '';

  /* O link aparece apenas se o perfil tiver uma URL pública cadastrada. */
  const link = user.link
    ? `<li class="profile-about-meta-item">${icon('link', 15)}<a class="profile-about-link" href="${esc(user.link)}" target="_blank" rel="noopener noreferrer">${esc(user.link.replace(/^https?:\/\//, ''))}</a></li>`
    : '';

  const meta = place || joined || link
    ? `<ul class="profile-about-meta">${place}${joined}${link}</ul>`
    : '';

  return `
    <section class="side-panel profile-about" aria-labelledby="profile-about-title">
      <header class="side-panel-head">
        <h2 id="profile-about-title">Sobre mim</h2>
        <span class="side-panel-icon">${icon('user', 17)}</span>
      </header>
      <div class="side-panel-body">
        ${bio}
        ${meta}
        ${interests.length ? `
          <div class="profile-about-block">
            <span class="profile-about-label">Interesses</span>
            ${interestChips(interests, 'compact')}
          </div>` : ''}
        ${badges.length ? `
          <div class="profile-about-block">
            <span class="profile-about-label">Selos</span>
            <div class="profile-about-badges">
              ${badges.map((badge) => `
                <span class="profile-about-badge" title="${esc(badge.description || badge.label)}">
                  ${icon(badge.icon || 'spark', 14)} ${esc(badge.label)}
                </span>`).join('')}
            </div>
          </div>` : ''}
      </div>
    </section>`;
}

/**
 * Monta o painel "Destaques" usando os stories reais da pessoa.
 *
 * Os destaques são preenchidos de forma assíncrona por `loadProfileAside`,
 * que consulta `GET /api/stories`. O bloco inicial exibe apenas o estado de
 * carregamento; nenhum story é inventado.
 *
 * @param {object} data Dados do perfil exibido.
 * @returns {string} Markup HTML do painel.
 */
function profileHighlightsPanel(data) {
  const isMe = !!data.isMe;
  return `
    <section class="side-panel profile-highlights" aria-labelledby="profile-highlights-title">
      <header class="side-panel-head">
        <h2 id="profile-highlights-title">Destaques</h2>
        <span class="side-panel-icon">${icon('spark', 17)}</span>
      </header>
      <div class="side-panel-body" id="profile-highlights-body" aria-live="polite">
        <div class="side-panel-loading"><span class="spinner" aria-hidden="true"></span><span>Carregando destaques...</span></div>
      </div>
      ${isMe ? `
        <button type="button" class="side-panel-action" data-action="new-story">
          ${icon('camera', 16)} <span>Publicar story</span>
        </button>` : ''}
    </section>`;
}

/**
 * Monta o painel "Sugestões para você" com o estado de carregamento.
 *
 * A lista real é preenchida por `loadProfileAside` a partir de
 * `GET /api/suggestions`, respeitando contas privadas e bloqueios.
 *
 * @returns {string} Markup HTML do painel.
 */
function profileSuggestionsPanel() {
  return `
    <section class="side-panel profile-suggestions" aria-labelledby="profile-suggestions-title">
      <header class="side-panel-head">
        <h2 id="profile-suggestions-title">Sugestões para você</h2>
        <span class="side-panel-icon">${icon('users', 17)}</span>
      </header>
      <div class="side-panel-body" id="profile-suggestions-body" aria-live="polite">
        <div class="side-panel-loading"><span class="spinner" aria-hidden="true"></span><span>Carregando sugestões...</span></div>
      </div>
    </section>`;
}

/**
 * Renderiza a lista de sugestões reais de pessoas para seguir.
 *
 * O botão de seguir reutiliza `followButton`, que já trata os três estados
 * possíveis: perfil público, perfil privado (solicitação) e já seguindo.
 *
 * @param {Array} users Usuários sugeridos pela API.
 * @returns {string} Markup HTML da lista.
 */
function profileSuggestionsList(users) {
  if (!Array.isArray(users) || !users.length) {
    return '<p class="side-panel-empty">Você já está conectado às pessoas certas por aqui.</p>';
  }
  return `<div class="profile-suggestion-list">
    ${users.map((user) => `
      <article class="profile-suggestion">
        <button type="button" class="profile-suggestion-user" data-action="profile" data-username="${esc(user.username)}">
          ${avatar(user, 38)}
          <span class="profile-suggestion-meta">
            <strong>${esc(user.name)}</strong>
            <small>@${esc(user.username)}</small>
          </span>
        </button>
        ${followButton(user, 'small')}
      </article>`).join('')}
  </div>`;
}

/**
 * Renderiza os destaques (stories) da pessoa exibida no perfil.
 *
 * Usa o grupo de stories retornado por `GET /api/stories` para o usuário do
 * perfil. Quando a pessoa não tem stories visíveis, mostra um estado vazio
 * honesto, sem inventar conteúdo.
 *
 * @param {Array} groups Grupos de stories retornados pela API.
 * @param {object} data Dados do perfil exibido.
 * @returns {string} Markup HTML dos destaques.
 */
function profileHighlightsList(groups, data) {
  const userId = Number(data.user.id);
  const group = (Array.isArray(groups) ? groups : []).find((item) => Number(item.user.id) === userId);
  if (!group || !group.stories.length) {
    return `<p class="side-panel-empty">${data.isMe
      ? 'Você ainda não tem stories. Publique o primeiro para guardar seus momentos aqui.'
      : 'Esta pessoa não tem destaques visíveis no momento.'}</p>`;
  }
  return `<div class="profile-highlights-list">
    ${group.stories.map((story, index) => `
      <button type="button" class="profile-highlight${story.viewed ? ' seen' : ''}" data-action="open-stories" data-user="${userId}"
        aria-label="Ver story de ${esc(group.user.username)}">
        <span class="profile-highlight-media">
          <img src="${esc(story.image)}" alt="" loading="lazy" />
          ${story.mediaType === 'video' ? `<span class="profile-highlight-mark">${icon('video', 14)}</span>` : ''}
        </span>
        <span class="profile-highlight-label">${esc(story.caption || `Destaque ${index + 1}`)}</span>
      </button>`).join('')}
  </div>`;
}

/**
 * Carrega os painéis laterais do perfil (destaques e sugestões).
 *
 * As duas rotas são consultadas em paralelo. Cada painel trata o seu próprio
 * estado de erro, para que a falha de uma não esconda a outra. Se o usuário
 * navegar para outra tela durante o carregamento, o resultado é descartado.
 *
 * @param {HTMLElement} viewElement Elemento da view do perfil.
 * @param {object} data Dados do perfil exibido.
 * @returns {Promise<void>} Resolve após a atualização dos painéis.
 */
async function loadProfileAside(viewElement, data) {
  const highlightsBody = $('#profile-highlights-body', viewElement);
  const suggestionsBody = $('#profile-suggestions-body', viewElement);
  if (!highlightsBody && !suggestionsBody) return;

  const [storiesResult, suggestionsResult] = await Promise.allSettled([
    api('/api/stories'),
    api('/api/suggestions'),
  ]);

  /* O usuário pode ter navegado para outra view durante o carregamento. */
  if (state.view !== 'profile' || !viewElement.isConnected) return;

  if (highlightsBody) {
    if (storiesResult.status === 'fulfilled') {
      const groups = storiesResult.value.groups || [];
      /* `openStories` usa o estado compartilhado para abrir o visualizador. */
      state.storyGroups = groups;
      highlightsBody.innerHTML = profileHighlightsList(groups, data);
    } else {
      highlightsBody.innerHTML = '<p class="side-panel-error">Não foi possível carregar os destaques.</p>';
    }
  }

  if (suggestionsBody) {
    if (suggestionsResult.status === 'fulfilled') {
      const users = (suggestionsResult.value.users || []).filter((user) => Number(user.id) !== Number(data.user.id));
      suggestionsBody.innerHTML = profileSuggestionsList(users);
    } else {
      suggestionsBody.innerHTML = '<p class="side-panel-error">Não foi possível carregar as sugestões.</p>';
    }
  }

  hydrateIcons(viewElement);
}

/**
 * Abre a visualização ampliada da foto de perfil.
 *
 * No próprio perfil a visualização abre diretamente o editor de imagem; nos
 * demais perfis apenas exibe a foto em tamanho maior.
 *
 * @param {object} data Objeto com `user` e `isMe`.
 * @param {object} [options] Opções da visualização.
 * @param {boolean} [options.autoEdit=false] Abre o seletor de arquivo em seguida.
 * @param {Function} [options.onSaved] Callback executado após salvar a foto.
 * @returns {void}
 */
export function openAvatarViewer(data, { autoEdit = false, onSaved = null } = {}) {
  if (!data || !data.user) return;
  if (data.isMe) {
    openAvatarEditor(data, { autoEdit, onSaved });
    return;
  }
  const user = data.user;
  const frame = user.avatar
    ? `<img src="${esc(user.avatar)}" alt="Foto de ${esc(user.name)}" />`
    : `<span class="avatar-viewer-fallback">${esc(initialsFor(user))}</span>`;
  openModal(`
    <div class="avatar-viewer">
      <h2 class="avatar-viewer-title">Foto de perfil</h2>
      <button type="button" class="icon-btn avatar-viewer-close" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
      <div class="avatar-viewer-media">
        <span class="avatar-viewer-frame" id="avatar-viewer-frame">${frame}</span>
      </div>
    </div>`, 'avatar-viewer-modal-wrap');
}

export async function renderProfile(viewElement, params = {}) {
  const username = params.username || state.me.username;
  viewElement.innerHTML = `
    <div class="profile">
      <div class="profile-layout">
        <div class="profile-main">
          <div class="profile-cover skeleton-cover"></div>
          <header class="profile-card">
            <div class="profile-avatar-wrap"><div class="skeleton-avatar"></div></div>
            <div class="profile-info">
              <div class="skeleton-line wide"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
            </div>
          </header>
        </div>
        <aside class="profile-aside" aria-label="Informações do perfil">
          <div class="side-panel skeleton-panel"><div class="skeleton-line wide"></div><div class="skeleton-line"></div></div>
        </aside>
      </div>
    </div>`;

  const data = await api(`/api/users/${encodeURIComponent(username)}`);
  if (state.view !== 'profile') return;
  state.profile = data;
  state.params.username = data.user.username;

  /* Ao trocar de perfil a aba volta para "Publicações", evitando herdar a aba
     de curtidas de um perfil anterior. */
  if (state.profileTabUser !== data.user.username) {
    state.profileTab = 'posts';
    state.profileTabUser = data.user.username;
  }

  const posts = Array.isArray(data.posts) ? data.posts : [];
  const stats = data.stats || { posts: posts.length, followers: 0, following: 0, verified: 0 };
  const cover = posts.find((post) => post.mediaType !== 'video') || posts[0];
  const bio = data.user.bio
    ? `<p>${captionHtml(data.user.bio)}</p>`
    : '<p class="muted">Sem bio ainda.</p>';

  /* A capa usa a imagem enviada pelo usuário; sem capa, cai na imagem da
     primeira publicação apenas como preenchimento visual. */
  const bannerMarkup = data.user.banner
    ? `<img class="profile-banner-image" src="${esc(data.user.banner)}" alt="Capa de ${esc(data.user.name)}" />`
    : cover
      ? (cover.mediaType === 'video'
        ? `<video src="${esc(cover.image)}" muted playsinline preload="metadata" aria-hidden="true"></video>`
        : `<img src="${esc(cover.image)}" alt="" aria-hidden="true" />`)
      : '';

  const verified = Number(stats.verified)
    ? `<span class="profile-verified" title="Conta verificada" aria-label="Conta verificada">${icon('shield', 16)}</span>`
    : '';

  const activeTab = PROFILE_TABS.some((tab) => tab.id === state.profileTab) ? state.profileTab : 'posts';
  const tabPosts = await loadProfileTabPosts(data, activeTab);

  viewElement.innerHTML = `
    <div class="profile">
      <div class="profile-layout">
        <div class="profile-main">
          <div class="profile-cover">
            ${bannerMarkup}
            <span class="profile-cover-shade"></span>
            ${data.isMe ? `
              <div class="profile-cover-actions">
                <button type="button" class="profile-media-btn profile-cover-edit" data-action="edit-profile-banner" aria-label="Editar capa do perfil">
                  ${icon('camera', 15)} <span>Editar capa</span>
                </button>
              </div>` : ''}
          </div>

          <header class="profile-card">
            <div class="profile-avatar-wrap">
              <button type="button" class="profile-avatar-btn" data-action="preview-avatar" aria-label="Ampliar foto de perfil">
                ${avatar(data.user, 128, 'profile-avatar')}
              </button>
              ${data.isMe ? `
                <button type="button" class="profile-avatar-pencil" data-action="edit-profile-avatar" aria-label="Editar foto de perfil">
                  ${icon('edit', 15)}
                </button>` : ''}
            </div>

            <div class="profile-info">
              <div class="profile-topline">
                <div class="profile-identity">
                  <h1>${esc(data.user.name)}${verified}</h1>
                  <p class="profile-handle">@${esc(data.user.username)}</p>
                </div>

                <div class="profile-actions">
                  ${data.isMe ? `
                    <button type="button" class="btn primary profile-edit-btn" data-action="settings">Editar perfil</button>
                    <button type="button" class="icon-btn profile-share-btn" data-action="share-profile" data-username="${esc(data.user.username)}" aria-label="Compartilhar perfil">
                      ${icon('share', 18)}
                    </button>
                    <button type="button" class="icon-btn profile-share-btn" data-action="profile-menu" data-username="${esc(data.user.username)}" aria-label="Mais opções">
                      ${icon('more', 18)}
                    </button>` : `
                    ${followButton({ ...data.user, isFollowing: data.isFollowing, followRequested: data.followRequested })}
                    ${data.canMessage ? `<button type="button" class="btn ghost" data-action="message-user" data-username="${esc(data.user.username)}">${icon('message', 16)} Mensagem</button>` : ''}
                    <button type="button" class="icon-btn profile-share-btn" data-action="share-profile" data-username="${esc(data.user.username)}" aria-label="Compartilhar perfil">
                      ${icon('share', 18)}
                    </button>
                    <button type="button" class="icon-btn profile-share-btn" data-action="profile-menu" data-username="${esc(data.user.username)}" aria-label="Mais opções">
                      ${icon('more', 18)}
                    </button>`}
                </div>
              </div>

              <div class="profile-bio">${bio}</div>

              <div class="profile-stats">
                <button type="button" class="profile-stat" data-action="profile-stat-posts" data-username="${esc(data.user.username)}">
                  <strong>${formatCount(stats.posts)}</strong>
                  <span>${plural(stats.posts, 'publicação', 'publicações')}</span>
                </button>
                <button type="button" class="profile-stat" data-action="followers-list" data-username="${esc(data.user.username)}">
                  <strong data-profile-followers>${formatCount(stats.followers)}</strong>
                  <span>${plural(stats.followers, 'seguidor', 'seguidores')}</span>
                </button>
                <button type="button" class="profile-stat" data-action="following-list" data-username="${esc(data.user.username)}">
                  <strong>${formatCount(stats.following)}</strong>
                  <span>seguindo</span>
                </button>
              </div>
            </div>
          </header>

          ${data.canViewContent ? `
            ${profileTabsMarkup(data, activeTab)}
            <div id="profile-tab-content" class="profile-tab-content">
              ${profileTabContent(tabPosts, activeTab, data)}
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
        </div>

        <aside class="profile-aside" aria-label="Informações do perfil">
          ${profileAboutPanel(data)}
          ${profileHighlightsPanel(data)}
          ${profileSuggestionsPanel()}
        </aside>
      </div>
    </div>`;
  hydrateIcons(viewElement);
  loadProfileAside(viewElement, data);
}

/* PART2 */

