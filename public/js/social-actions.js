/* Vibra - rede social: modais, ações e formulários. */
/*
 * @module social-actions
 * Este arquivo concentra as ações e os modais da área social do Vibra.
 *
 * Ações e modais implementados:
 *  - Player de vídeo no feed: reproduzir, pausar, silenciar e sincronizar vídeos.
 *  - Publicação aberta: exibir mídia, legenda, comentários, curtidas e compartilhamento.
 *  - Criar publicação / story: selecionar, validar, pré-visualizar e enviar mídias.
 *  - Editar perfil: atualizar avatar, dados, interesses, privacidade e política de mensagens.
 *  - Menu de perfil, denúncia e bloqueio: denunciar, bloquear, desbloquear e listar bloqueados.
 *  - Solicitações de seguimento: consultar, aceitar e recusar pedidos.
 *  - Melhores amigos: buscar, adicionar e remover pessoas da lista exclusiva.
 *  - Seguidores e seguindo: abrir e navegar pelas duas listas.
 *  - Interações com stories: reagir e consultar visualizações.
 *  - Notificações: listar, agrupar, marcar como lidas e abrir destinos.
 *  - Compartilhamento: copiar links e enviar publicações em conversas.
 *
 * Contrato de `handleAction(action, target)`: recebe a ação declarada em `data-action` e o elemento DOM alvo, vindos da delegação de eventos em main.js.
 * Contrato de `handleSubmit(form, event)`: recebe o formulário identificado por `form.id` e o evento de submissão, também vindos da delegação em main.js.
 *
 * Dependências:
 *  - core.js: helper de API, estado global, modais, ícones, escape, upload e utilitários compartilhados.
 *  - social.js: renderers de feed, stories, comentários, curtidas e controles de carrossel.
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
  interestChips,
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
  uploadVideo,
} from './core.js';
import {
  commentRow,
  adjustCommentTotals,
  toggleLike,
  followButton,
  loadMoreFeed,
  storyNext,
  storyPrev,
  openStories,
  closeStories,
  fetchExplore,
  carouselMarkup,
  carouselStep,
} from './social.js';

/* ------------------------------------------------------------------ */
/* Player de vídeo no feed                                            */
/* ------------------------------------------------------------------ */

/* Seção: Player de vídeo no feed - sincroniza controles e estado do player inline */

/**
 * Sincroniza o estado visual do player de vídeo no feed.
 * Atualiza o ícone de play/pause e o estado do botão de mutar conforme o vídeo está reproduzindo.
 * @param {HTMLElement} player Contêiner do player contendo os botões de controle.
 * @param {HTMLVideoElement} video Elemento de vídeo sendo reproduzido.
 * @returns {void}
 */
function syncInlineVideo(player, video) {
  if (!player || !video) return;
  const playing = !video.paused && !video.ended;
  player.classList.toggle('is-playing', playing);
  const toggle = player.querySelector('[data-action="toggle-video"]');
  if (toggle) {
    toggle.setAttribute('aria-label', playing ? 'Pausar vídeo' : 'Reproduzir vídeo');
    const slot = toggle.querySelector('[data-video-icon]');
    if (slot) slot.innerHTML = icon(playing ? 'pause' : 'play', 28);
  }
  const mute = player.querySelector('[data-action="toggle-video-mute"]');
  if (mute) {
    mute.setAttribute('aria-label', video.muted ? 'Ativar som do vídeo' : 'Silenciar vídeo');
    mute.setAttribute('aria-pressed', video.muted ? 'true' : 'false');
    mute.innerHTML = icon(video.muted ? 'volumeOff' : 'volume', 18);
  }
}

/**
 * Pausa os vídeos inline do feed, preservando opcionalmente o vídeo em reprodução.
 * @param {HTMLVideoElement} [except] Vídeo que não deve ser pausado.
 * @returns {void}
 */
function pauseInlineVideos(except) {
  $$('[data-video-player] video').forEach((video) => {
    if (video !== except && !video.paused) video.pause();
  });
}

function inlineVideoFor(target) {
  const player = target.closest('[data-video-player]');
  const video = player?.querySelector('video');
  return player && video ? { player, video } : null;
}

for (const type of ['play', 'pause', 'ended', 'volumechange']) {
  document.addEventListener(type, (event) => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement)) return;
    const player = video.closest('[data-video-player]');
    if (!player) return;
    if (type === 'play') pauseInlineVideos(video);
    syncInlineVideo(player, video);
  }, true);
}

/* ------------------------------------------------------------------ */
/* Publicação aberta                                                  */
/* ------------------------------------------------------------------ */

export async function openPost(postId) { /* openPost: abre modal completo da publicação, carrega dados via API e monta interface*/
  pauseInlineVideos();
  const data = await api(`/api/posts/${postId}`);
  const post = data.post;
  const comments = data.comments || [];
  const canDeletePost = data.canDelete;
  const media = Array.isArray(post.media) && post.media.length
    ? post.media
    : [{ url: post.image, mediaType: post.mediaType || 'image' }];
  const markup = `
    <div class="moment-modal">
      <div class="moment-media ${post.mediaType === 'video' ? 'moment-media--video' : ''}">
        ${media.length > 1
          ? carouselMarkup(post, { modal: true })
          : post.mediaType === 'video'
            ? `<video src="${esc(post.image)}" controls playsinline autoplay muted aria-label="${esc(post.caption || 'Vídeo')}"></video>`
            : `<img src="${esc(post.image)}" alt="${esc(post.caption || 'Publicação')}" />`}
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
          <div class="moment-head-tools">
            <button type="button" class="icon-btn tiny" data-action="share-post" data-id="${post.id}" aria-label="Compartilhar">${icon('share', 17)}</button>
            <button type="button" class="icon-btn tiny" data-action="report-post" data-id="${post.id}" aria-label="Denunciar">${icon('flag', 17)}</button>
            ${canDeletePost ? `<button type="button" class="icon-btn tiny" data-action="delete-post" data-id="${post.id}" aria-label="Apagar publicação">${icon('trash', 17)}</button>` : ''}
          </div>
        </header>

        <div class="moment-scroll">
          ${post.caption ? `<p class="moment-caption">${esc(post.caption).replace(/\n/g, '<br />')}</p>` : ''}
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
            <span class="moment-share-count">${icon('share', 15)} <span data-share-count="${post.id}">${formatCount(post.shares || 0)}</span></span>
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

/* ------------------------------------------------------------------ */
/* Criar publicação / story                                           */
/* ------------------------------------------------------------------ */

let pendingMedia = null;
let pendingPostMedia = [];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
const MAX_VIDEO_DURATION = 60 * 60;
const MAX_MEDIA_PAYLOAD = 32 * 1024 * 1024;

function releasePendingMedia(items) { /* Revoga Object URLs criados por médias pendentes, liberando memória */
  for (const item of items || []) {
    if (item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
}

function formatDuration(seconds) { /* Converte segundos em string legível (ex: 5min 12s) */
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}min`;
  return `${minutes}min ${String(secs).padStart(2, '0')}s`;
}

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
    const timer = setTimeout(() => {
      finish(reject, new Error('Não foi possível verificar a duração do vídeo.'));
    }, 10000);
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0) finish(resolve, duration);
      else finish(reject, new Error('Não foi possível verificar a duração do vídeo.'));
    };
    video.onerror = () => finish(reject, new Error('Não foi possível ler o vídeo. Use MP4 ou WEBM.'));
    video.src = url;
  });
}

function mediaSrc(item) {
  return item.previewUrl || item.dataUrl || '';
}

function uploadPreviewMarkup(media) {
  if (!media) return '';
  const src = esc(mediaSrc(media));
  if (media.mediaType === 'video') {
    return `<video src="${src}" controls playsinline class="upload-video-preview"></video>`;
  }
  return `<img src="${src}" alt="Prévia da imagem" />`;
}

function postPreviewMarkup(items) {
  if (!items.length) return '';
  if (items.length === 1) {
    const item = items[0];
    const label = item.mediaType === 'video'
      ? `1 vídeo selecionado${item.duration ? ` · ${formatDuration(item.duration)}` : ''}`
      : '1 foto selecionada';
    return `<div class="upload-single">${uploadPreviewMarkup(item)}</div><p class="upload-note">${label} · clique para trocar</p>`;
  }
  return `<div class="upload-grid">
    ${items.map((item, index) => `<figure class="upload-thumb">
      ${item.mediaType === 'video'
        ? `<video src="${esc(mediaSrc(item))}" muted playsinline preload="metadata"></video>`
        : `<img src="${esc(mediaSrc(item))}" alt="Prévia da foto ${index + 1}" />`}
      <figcaption>${index + 1}</figcaption>
    </figure>`).join('')}
  </div>
  <p class="upload-note">${items.length} fotos selecionadas · clique para trocar</p>`;
}

function bindPostMediaInput(input, preview) {
  input.addEventListener('change', async () => {
    const files = [...(input.files || [])];
    if (!files.length) return;
    if (files.length > 10) {
      toast('Escolha no máximo 10 fotos por publicação.', 'error');
      input.value = '';
      return;
    }
    const hasVideo = files.some((file) => file.type.startsWith('video/'));
    if (hasVideo && files.length > 1) {
      toast('Para publicar vídeo, selecione apenas um arquivo.', 'error');
      input.value = '';
      return;
    }
    for (const file of files) {
      const isVideo = file.type.startsWith('video/');
      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        toast('O vídeo pode ter no máximo 1 GB.', 'error');
        input.value = '';
        return;
      }
      if (!isVideo && file.size > MAX_IMAGE_BYTES) {
        toast('A imagem pode ter no máximo 8 MB.', 'error');
        input.value = '';
        return;
      }
    }
    try {
      if (hasVideo) {
        const file = files[0];
        const duration = await readVideoDuration(file);
        if (duration > MAX_VIDEO_DURATION) {
          toast('O vídeo pode ter no máximo 60 minutos.', 'error');
          input.value = '';
          return;
        }
        const items = [{ file, previewUrl: URL.createObjectURL(file), mediaType: 'video', duration }];
        releasePendingMedia(pendingPostMedia);
        pendingPostMedia = items;
        preview.classList.add('has-image');
        preview.innerHTML = postPreviewMarkup(items);
        return;
      }
      const items = await Promise.all(files.map(async (file) => ({
        dataUrl: await fileToDataUrl(file),
        mediaType: 'image',
      })));
      const total = items.reduce((sum, item) => sum + item.dataUrl.length, 0);
      if (total > MAX_MEDIA_PAYLOAD) {
        toast('As fotos somam mais de 32 MB. Escolha arquivos menores.', 'error');
        input.value = '';
        return;
      }
      releasePendingMedia(pendingPostMedia);
      pendingPostMedia = items;
      preview.classList.add('has-image');
      preview.innerHTML = postPreviewMarkup(items);
    } catch (error) {
      toast(error.message, 'error');
      input.value = '';
    }
  });
}

function bindMediaInput(input, preview, { maxImage = MAX_IMAGE_BYTES, maxVideo = MAX_VIDEO_BYTES } = {}) {
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    if (isVideo && file.size > maxVideo) {
      toast('O vídeo pode ter no máximo 1 GB.', 'error');
      input.value = '';
      return;
    }
    if (!isVideo && file.size > maxImage) {
      toast('A imagem pode ter no máximo 8 MB.', 'error');
      input.value = '';
      return;
    }
    try {
      if (isVideo) {
        const duration = await readVideoDuration(file);
        if (duration > MAX_VIDEO_DURATION) {
          toast('O vídeo pode ter no máximo 60 minutos.', 'error');
          input.value = '';
          return;
        }
        releasePendingMedia([pendingMedia]);
        pendingMedia = { file, previewUrl: URL.createObjectURL(file), mediaType: 'video', duration };
      } else {
        const dataUrl = await fileToDataUrl(file);
        releasePendingMedia([pendingMedia]);
        pendingMedia = { dataUrl, mediaType: 'image' };
      }
      preview.classList.add('has-image');
      preview.innerHTML = uploadPreviewMarkup(pendingMedia);
      if (pendingMedia.mediaType === 'video') {
        preview.insertAdjacentHTML(
          'beforeend',
          `<p class="upload-note">${formatDuration(pendingMedia.duration)} · vídeo selecionado</p>`
        );
      }
    } catch (error) {
      toast(error.message, 'error');
      input.value = '';
    }
  });
}

export function openCreateModal() {
  releasePendingMedia(pendingPostMedia);
  releasePendingMedia([pendingMedia]);
  pendingMedia = null;
  pendingPostMedia = [];
  openModal(`
    <div class="modal-head">
      <h2>Nova publicação</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
    </div>
    <form id="create-form" class="modal-form">
      <label class="upload-area" for="post-media">
        <input id="post-media" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" multiple hidden />
        <span class="upload-preview" id="upload-preview">
          <span class="upload-icon">${icon('image', 30)}</span>
          <strong>Escolha até 10 fotos ou um vídeo</strong>
          <span class="muted">Fotos até 8 MB cada · vídeo MP4/WEBM até 60 min e 1 GB</span>
        </span>
      </label>
      <label class="field">
        <span>Legenda</span>
        <textarea name="caption" rows="3" maxlength="2200" placeholder="Escreva uma legenda..."></textarea>
      </label>
      <p class="muted small">As fotos viram um carrossel na ordem em que foram escolhidas. O arquivo fica salvo apenas neste computador.</p>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn primary">Publicar</button>
      </div>
    </form>`, 'create-modal');
  bindPostMediaInput($('#post-media'), $('#upload-preview'));
}

export function openStoryModal() {
  releasePendingMedia([pendingMedia]);
  releasePendingMedia(pendingPostMedia);
  pendingMedia = null;
  pendingPostMedia = [];
  openModal(`
    <div class="modal-head">
      <h2>Novo story</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
    </div>
    <form id="story-form" class="modal-form">
      <label class="upload-area" for="story-media">
        <input id="story-media" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" hidden />
        <span class="upload-preview" id="upload-preview">
          <span class="upload-icon">${icon('camera', 30)}</span>
          <strong>Escolha uma foto ou vídeo</strong>
          <span class="muted">O story desaparece em 24 horas · vídeo até 60 min e 1 GB</span>
        </span>
      </label>
      <div class="switch-list">
        <label class="switch-row">
          <span>
            <strong>Apenas melhores amigos</strong>
            <small>Só quem você adicionou como melhor amigo verá este story.</small>
          </span>
          <span class="switch">
            <input type="checkbox" name="closeFriends" />
            <i></i>
          </span>
        </label>
      </div>
      <label class="field">
        <span>Mencionar pessoas (opcional)</span>
        <input name="mentions" type="text" placeholder="@ana.souza, @bruno.dev" />
        <small class="field-hint">Use @usuario. As pessoas mencionadas recebem notificação e o nome vira link no story.</small>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn primary">Publicar story</button>
      </div>
    </form>`, 'create-modal');
  bindMediaInput($('#story-media'), $('#upload-preview'));
}

/* ------------------------------------------------------------------ */
/* Editar perfil                                                      */
/* ------------------------------------------------------------------ */

let pendingAvatar = null;

export function openEditProfileModal() {
  pendingAvatar = null;
  const interests = state.me.interests || [];
  const policy = state.me.messagePolicy || 'connections';
  openModal(`
    <div class="modal-head">
      <h2>Editar perfil</h2>
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
      <fieldset class="field interests-field">
        <legend>Interesses <small>(até 12)</small></legend>
        <div class="interest-options">
          ${state.config.interests.map((interest) => `
            <label class="check-chip">
              <input type="checkbox" name="interests" value="${esc(interest.id)}" ${interests.includes(interest.id) ? 'checked' : ''} />
              <span>${esc(interest.label)}</span>
            </label>`).join('')}
        </div>
      </fieldset>
      <label class="field">
        <span>Quem pode enviar mensagens</span>
        <select name="messagePolicy">
          <option value="connections" ${policy === 'connections' ? 'selected' : ''}>Pessoas que eu sigo de volta</option>
          <option value="everyone" ${policy === 'everyone' ? 'selected' : ''}>Qualquer pessoa</option>
          <option value="nobody" ${policy === 'nobody' ? 'selected' : ''}>Ninguém</option>
        </select>
      </label>
      <div class="switch-list profile-private-switch">
        <label class="switch-row">
          <span>
            <strong>Perfil privado</strong>
            <small>Quem quiser seguir você precisa enviar uma solicitação. Você aceita ou recusa, e só seguidores aprovados veem suas publicações e stories.</small>
          </span>
          <span class="switch">
            <input type="checkbox" name="isPrivate" ${state.me.isPrivate ? 'checked' : ''} />
            <i></i>
          </span>
        </label>
      </div>
      ${!state.me.birthDate ? `
        <label class="field">
          <span>Data de nascimento</span>
          <input name="birthDate" type="date" required />
          <small class="field-hint">Necessária para idade mínima da plataforma.</small>
        </label>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn primary">Salvar</button>
      </div>
    </form>`, 'create-modal');

  const input = $('#avatar-image');
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast('A imagem precisa ter no máximo 8 MB.', 'error');
      input.value = '';
      return;
    }
    try {
      pendingAvatar = await fileToDataUrl(file);
      $('#edit-avatar-preview').innerHTML = `<img class="avatar" src="${pendingAvatar}" alt="Nova foto de perfil" style="width:84px;height:84px" />`;
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}

/* ------------------------------------------------------------------ */
/* Menu de perfil, denúncia e bloqueio                                */
/* ------------------------------------------------------------------ */

function openProfileMenu(user) {
  openModal(`
    <div class="modal-head"><h2>@${esc(user.username)}</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button></div>
    <div class="menu-list">
      <button type="button" class="menu-item" data-action="report-user" data-id="${user.id}" data-username="${esc(user.username)}">
        ${icon('flag', 19)} <span><strong>Denunciar perfil</strong><small>Enviar para revisão de moderação.</small></span>
      </button>
      <button type="button" class="menu-item danger" data-action="block-user" data-username="${esc(user.username)}">
        ${icon('ban', 19)} <span><strong>Bloquear pessoa</strong><small>Ocultar perfil, conversas e match.</small></span>
      </button>
    </div>`, 'menu-modal');
}

export function openReportModal({ targetType, targetId, label }) {
  openModal(`
    <div class="modal-head"><h2>Denunciar ${esc(label || 'conteúdo')}</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button></div>
    <form id="report-form" class="modal-form" data-target-type="${esc(targetType)}" data-target-id="${Number(targetId)}">
      <p class="muted small">A denúncia é privada. O conteúdo não é removido automaticamente; a moderação revisa o caso.</p>
      <label class="field">
        <span>Motivo</span>
        <select name="reason" required>
          <option value="spam">Spam ou conteúdo repetitivo</option>
          <option value="assedio">Assédio ou mensagem ofensiva</option>
          <option value="perfil_falso">Perfil falso ou identidade enganosa</option>
          <option value="conteudo_improprio">Conteúdo impróprio</option>
          <option value="menor">Suspeita de menor de idade</option>
          <option value="outro">Outro motivo</option>
        </select>
      </label>
      <label class="field">
        <span>Detalhes (opcional)</span>
        <textarea name="details" rows="3" maxlength="1000" placeholder="Conte o que aconteceu."></textarea>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn primary">Enviar denúncia</button>
      </div>
    </form>`, 'report-modal');
}

export async function blockUser(username) {
  const confirmed = await confirmDialog({
    title: 'Bloquear pessoa?',
    body: `@${username} deixa de aparecer no feed, nas buscas e nas conversas. Se houver match ativo, ele será encerrado. Para desbloquear depois, abra Perfil → Pessoas bloqueadas.`,
    confirmLabel: 'Bloquear',
    danger: true,
  });
  if (!confirmed) return false;
  const data = await api(`/api/users/${encodeURIComponent(username)}/block`, { method: 'POST' });
  toast(data.blocked ? `@${username} foi bloqueado.` : `@${username} foi desbloqueado.`);
  if (state.view === 'profile' && state.params.username && state.params.username.toLowerCase() === username.toLowerCase()) {
    await navigate('explore');
  }
  return data.blocked;
}

async function unblockUser(username) {
  const confirmed = await confirmDialog({
    title: 'Desbloquear pessoa?',
    body: `@${username} volta a poder aparecer no feed e nas buscas. Seguidores e matches anteriores não são restaurados automaticamente.`,
    confirmLabel: 'Desbloquear',
  });
  if (!confirmed) return false;
  await api(`/api/users/${encodeURIComponent(username)}/block`, { method: 'DELETE' });
  toast(`@${username} foi desbloqueado.`);
  return true;
}

export async function openBlockedUsersModal() {
  const data = await api('/api/blocks');
  const rows = data.blockedUsers || [];
  openModal(`
    <div class="modal-head">
      <h2>Pessoas bloqueadas</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
    </div>
    <div class="blocked-list" id="blocked-list">
      ${rows.length
        ? rows.map((item) => `
          <article class="blocked-person" data-blocked-username="${esc(item.user.username)}">
            ${avatar(item.user, 44)}
            <div class="blocked-person-main">
              <strong>${esc(item.user.name)}</strong>
              <small>@${esc(item.user.username)} · bloqueado ${relTime(item.blockedAt)}</small>
            </div>
            <button type="button" class="btn ghost small" data-action="unblock-user" data-username="${esc(item.user.username)}">Desbloquear</button>
          </article>`).join('')
        : '<div class="empty-state compact"><h3>Ninguém bloqueado</h3><p>Pessoas que você bloquear aparecem aqui para que possa desbloquear quando quiser.</p></div>'}
    </div>
    <p class="muted small">Desbloquear não restaura seguidores, curtidas ou matches anteriores. O bloqueio é sempre silencioso para a outra pessoa.</p>`, 'blocked-modal');
}

/* ------------------------------------------------------------------ */
/* Solicitações de seguimento                                         */
/* ------------------------------------------------------------------ */

function syncPendingFollowRequests() {
  const count = Number(state.me && state.me.pendingFollowRequests) || 0;
  $$('[data-pending-follow-requests]').forEach((element) => {
    element.textContent = String(count);
    element.hidden = count <= 0;
  });
}

function followRequestRow(request) {
  const user = request.user;
  return `
    <article class="follow-request" data-request-id="${request.id}" data-username="${esc(user.username)}">
      <button type="button" class="user-link follow-request-user" data-action="profile" data-username="${esc(user.username)}">
        ${avatar(user, 44)}
        <span class="user-meta">
          <strong>${esc(user.name)}</strong>
          <small>@${esc(user.username)} · ${relTime(request.createdAt)}</small>
        </span>
      </button>
      <div class="follow-request-actions">
        <button type="button" class="btn primary small" data-action="accept-follow-request" data-id="${request.id}">${icon('check', 15)} Aceitar</button>
        <button type="button" class="btn ghost small" data-action="reject-follow-request" data-id="${request.id}">Recusar</button>
      </div>
    </article>`;
}

export async function openFollowRequests() {
  const data = await api('/api/follow-requests');
  if (state.me) state.me.pendingFollowRequests = data.pendingFollowRequests || 0;
  syncPendingFollowRequests();
  const requests = data.requests || [];
  openModal(`
    <div class="modal-head">
      <h2>Solicitações de seguimento</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
    </div>
    <p class="muted small">Aceite apenas quem você quer que veja suas publicações e stories.</p>
    <div class="follow-request-list" id="follow-request-list">
      ${requests.length
        ? requests.map(followRequestRow).join('')
        : '<div class="empty-state compact"><h3>Tudo em dia</h3><p>Não há solicitações pendentes.</p></div>'}
    </div>`, 'follow-requests-modal');
}

async function respondFollowRequest(id, action, button) {
  setBusy(button, true);
  try {
    const data = await api(`/api/follow-requests/${id}/${action}`, { method: 'POST' });
    if (state.me) state.me.pendingFollowRequests = data.pendingFollowRequests || 0;
    syncPendingFollowRequests();
    const row = $(`[data-request-id="${id}"]`);
    const username = row ? row.dataset.username : '';
    if (row) row.remove();
    if (state.profile && state.profile.isMe) {
      state.profile.stats = data.stats;
      state.profile.pendingFollowRequests = data.pendingFollowRequests;
      const followers = $('[data-profile-followers]');
      if (followers) followers.textContent = formatCount(data.stats.followers);
    }
    const list = $('#follow-request-list');
    if (list && !list.querySelector('[data-request-id]')) {
      list.innerHTML = '<div class="empty-state compact"><h3>Tudo em dia</h3><p>Não há solicitações pendentes.</p></div>';
    }
    toast(action === 'accept'
      ? `Solicitação de @${username} aceita.`
      : 'Solicitação recusada.');
  } finally {
    setBusy(button, false);
  }
}

/* ------------------------------------------------------------------ */
/* Melhores amigos                                                    */
/* ------------------------------------------------------------------ */

function closeFriendsRow(user) {
  return `
    <article class="follow-request" data-close-username="${esc(user.username)}">
      <button type="button" class="user-link follow-request-user" data-action="profile" data-username="${esc(user.username)}">
        ${avatar(user, 40)}
        <span class="user-meta">
          <strong>${esc(user.name)}</strong>
          <small>@${esc(user.username)}</small>
        </span>
      </button>
      <button type="button" class="btn ghost small" data-action="remove-close-friend" data-username="${esc(user.username)}">Remover</button>
    </article>`;
}

export async function openCloseFriendsModal() {
  const data = await api('/api/close-friends');
  const friends = data.closeFriends || data.friends || [];
  openModal(`
    <div class="modal-head">
      <h2>Melhores amigos</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
    </div>
    <p class="muted small">Stories marcados como "apenas melhores amigos" aparecem só para quem está nesta lista.</p>
    <div class="field">
      <span>Adicionar pessoa</span>
      <div class="close-friends-search">
        <input id="close-friends-query" type="text" placeholder="Buscar por nome ou usuário" />
        <button type="button" class="btn primary small" data-action="close-friends-search">Buscar</button>
      </div>
    </div>
    <div id="close-friends-results" class="close-friends-results"></div>
    <h3 class="close-friends-title">Seus melhores amigos</h3>
    <div class="follow-request-list" id="close-friends-list">
      ${friends.length
        ? friends.map(closeFriendsRow).join('')
        : '<div class="empty-state compact"><h3>Nenhum melhor amigo</h3><p>Adicione pessoas para compartilhar stories exclusivos.</p></div>'}
    </div>`, 'close-friends-modal');
}

async function renderCloseFriendsSearch() {
  const input = $('#close-friends-query');
  const query = String(input?.value || '').trim();
  if (!query) {
    toast('Digite um nome ou usuário.', 'error');
    return;
  }
  const [searchData, friendsData] = await Promise.all([
    api(`/api/search?q=${encodeURIComponent(query)}`),
    api('/api/close-friends'),
  ]);
  const friendSet = new Set((friendsData.closeFriends || friendsData.friends || []).map((user) => user.username.toLowerCase()));
  const results = $('#close-friends-results');
  const users = (searchData.users || []).filter((user) => !user.isMe);
  results.innerHTML = users.length
    ? users.map((user) => `
        <article class="follow-request" data-close-username="${esc(user.username)}">
          <button type="button" class="user-link follow-request-user" data-action="profile" data-username="${esc(user.username)}">
            ${avatar(user, 40)}
            <span class="user-meta">
              <strong>${esc(user.name)}</strong>
              <small>@${esc(user.username)}</small>
            </span>
          </button>
          ${friendSet.has(user.username.toLowerCase())
            ? '<span class="pill">Já é melhor amigo</span>'
            : `<button type="button" class="btn primary small" data-action="add-close-friend" data-username="${esc(user.username)}">${icon('plus', 14)} Adicionar</button>`}
        </article>`).join('')
    : '<p class="muted-note">Nenhuma pessoa encontrada.</p>';
}

async function addCloseFriend(username, button) {
  setBusy(button, true);
  try {
    await api(`/api/close-friends/${encodeURIComponent(username)}`, { method: 'POST' });
    toast(`@${username} adicionado aos melhores amigos.`);
    await openCloseFriendsModal();
  } finally {
    setBusy(button, false);
  }
}

async function removeCloseFriend(username, button) {
  setBusy(button, true);
  try {
    await api(`/api/close-friends/${encodeURIComponent(username)}`, { method: 'DELETE' });
    const row = document.querySelector(`[data-close-username="${window.CSS && CSS.escape ? CSS.escape(username) : username}"]`);
    if (row) row.remove();
    const list = $('#close-friends-list');
    if (list && !list.querySelector('[data-close-username]')) {
      list.innerHTML = '<div class="empty-state compact"><h3>Nenhum melhor amigo</h3><p>Adicione pessoas para compartilhar stories exclusivos.</p></div>';
    }
    toast(`@${username} removido.`);
  } finally {
    setBusy(button, false);
  }
}

/* ------------------------------------------------------------------ */
/* Seguidores e seguindo                                              */
/* ------------------------------------------------------------------ */

function followListItem(user) {
  return `
    <article class="follow-request" data-follow-username="${esc(user.username)}">
      <button type="button" class="user-link follow-request-user" data-action="profile" data-username="${esc(user.username)}">
        ${avatar(user, 40)}
        <span class="user-meta">
          <strong>${esc(user.name)}</strong>
          <small>@${esc(user.username)}</small>
        </span>
      </button>
      ${user.isMe
        ? '<span class="pill">Você</span>'
        : followButton(user, 'small')}
    </article>`;
}

export async function openFollowersModal(username) {
  const data = await api(`/api/users/${encodeURIComponent(username)}/followers`);
  openFollowListModal(`Seguidores de @${username}`, data.users || []);
}

export async function openFollowingModal(username) {
  const data = await api(`/api/users/${encodeURIComponent(username)}/following`);
  openFollowListModal(`Quem @${username} segue`, data.users || []);
}

function openFollowListModal(title, users) {
  openModal(`
    <div class="modal-head">
      <h2>${esc(title)}</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
    </div>
    <div class="follow-request-list" id="follow-list">
      ${users.length
        ? users.map(followListItem).join('')
        : '<div class="empty-state compact"><h3>Ninguém por aqui</h3><p>Esta lista está vazia.</p></div>'}
    </div>`, 'follow-list-modal');
}

/* ------------------------------------------------------------------ */
/* Interações com stories                                             */
/* ------------------------------------------------------------------ */

async function reactToStory(storyId, emoji) {
  try {
    await api(`/api/stories/${storyId}/react`, { method: 'POST', body: JSON.stringify({ emoji }) });
    toast(`Reação ${emoji} enviada.`);
  } catch (error) {
    toast(error.message, 'error');
  }
}

export async function openStoryViews(storyId) {
  const data = await api(`/api/stories/${storyId}/views`);
  const users = data.users || [];
  openModal(`
    <div class="modal-head">
      <h2>Visualizações</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
    </div>
    <div class="follow-request-list">
      ${users.length
        ? users.map((user) => `
            <article class="follow-request">
              <button type="button" class="user-link follow-request-user" data-action="profile" data-username="${esc(user.username)}">
                ${avatar(user, 40)}
                <span class="user-meta">
                  <strong>${esc(user.name)}</strong>
                  <small>@${esc(user.username)} · ${relTime(user.viewedAt)}</small>
                </span>
              </button>
            </article>`).join('')
        : '<div class="empty-state compact"><h3>Sem visualizações</h3><p>Ninguém viu este story ainda.</p></div>'}
    </div>`, 'story-views-modal');
}

/* ------------------------------------------------------------------ */
/* Notificações                                                       */
/* ------------------------------------------------------------------ */

export async function openNotifications() {
  const data = await api('/api/notifications');
  await api('/api/notifications/read', { method: 'POST' }).catch(() => {});
  state.unreadNotifications = 0;
  refreshBadges();
  const kindIcons = {
    like: 'heart',
    comment: 'comment',
    follow: 'user',
    follow_request: 'users',
    follow_accept: 'check',
    mention: 'at',
    story_reaction: 'heart',
    story_reply: 'message',
    message: 'message',
    match: 'spark',
    radar: 'radar',
    verification: 'shield',
  };
  openModal(`
    <div class="modal-head"><h2>Notificações</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button></div>
    <div class="notification-list">
      ${data.notifications.length
        ? data.notifications.map((notification) => `
          <button type="button" class="notification-item ${notification.read ? '' : 'unread'}" ${notification.link ? `data-action="open-notification" data-link="${esc(notification.link)}"` : 'data-action="noop"'}>
            <span class="notification-icon">${icon(kindIcons[notification.kind] || 'bell', 18)}</span>
            <span class="notification-body">
              <strong>${esc(notification.text)}</strong>
              <small>${relTime(notification.createdAt)}</small>
            </span>
          </button>`).join('')
        : '<p class="muted-note">Nenhuma notificação por aqui ainda.</p>'}
    </div>`, 'notifications-modal');
}

async function openNotification(link) {
  closeModal();
  if (!link) return;
  try {
    const url = new URL(link, window.location.origin);
    const conversation = url.searchParams.get('conversation');
    const post = url.searchParams.get('post');
    const profile = url.searchParams.get('profile');
    const followRequests = url.searchParams.get('follow-requests');
    if (conversation) {
      await navigate('messages', { conversation: Number(conversation) });
      return;
    }
    if (post) {
      await openPost(Number(post));
      return;
    }
    if (profile) {
      await navigate('profile', { username: profile });
      return;
    }
    if (followRequests) {
      await navigate('home');
      await openFollowRequests();
      return;
    }
  } catch {
    /* link inválido cai no início */
  }
  await navigate('home');
}

/* ------------------------------------------------------------------ */
/* Compartilhamento                                                   */
/* ------------------------------------------------------------------ */

export async function openShareModal(postId) {
  const data = await api(`/api/posts/${postId}/share`, { method: 'POST' });
  $$(`[data-share-count="${postId}"]`).forEach((element) => {
    element.textContent = formatCount(data.shares);
  });
  const conversations = await api('/api/conversations').catch(() => ({ conversations: [] }));
  const link = `${window.location.origin}${data.link}`;
  openModal(`
    <div class="modal-head"><h2>Compartilhar publicação</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button></div>
    <div class="share-modal">
      <div class="share-link">
        <div><strong>Link da publicação</strong><span>${esc(link)}</span></div>
        <button type="button" class="btn ghost small" data-action="copy-share-link" data-link="${esc(link)}">${icon('link', 15)} Copiar</button>
      </div>
      <p class="eyebrow">Enviar em uma conversa</p>
      ${conversations.conversations.length
        ? `<div class="share-conversations">${conversations.conversations.slice(0, 10).map((conversation) => `
            <button type="button" class="share-conversation" data-action="send-share-to" data-conversation="${conversation.id}" data-post="${postId}">
              ${avatar(conversation.other, 36)}
              <span><strong>${esc(conversation.other.name)}</strong><small>${conversation.kind === 'dating' ? 'Match' : 'Conversa social'}</small></span>
              ${icon('send', 16)}
            </button>`).join('')}</div>`
        : '<p class="muted-note">Você ainda não tem conversas. Comece por uma mensagem no perfil de alguém.</p>'}
    </div>`, 'share-modal');
}

async function sendShareTo(conversationId, postId) {
  await api(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ sharedPostId: postId }),
  });
  closeModal();
  toast('Publicação enviada na conversa.');
}

async function copyShareLink(link) {
  try {
    await navigator.clipboard.writeText(link);
    toast('Link copiado.');
  } catch {
    const input = document.createElement('input');
    input.value = link;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    toast('Link copiado.');
  }
}

/* ------------------------------------------------------------------ */
/* Ações                                                              */
/* ------------------------------------------------------------------ */

export async function handleAction(action, target) {
  switch (action) {
    case 'new-post':
      pauseInlineVideos();
      openCreateModal();
      return true;
    case 'new-story':
      pauseInlineVideos();
      openStoryModal();
      return true;
    case 'edit-profile':
      openEditProfileModal();
      return true;
    case 'like':
      await toggleLike(Number(target.dataset.likeBtn));
      return true;
    case 'open-post':
      pauseInlineVideos();
      await openPost(Number(target.dataset.id));
      return true;
    case 'toggle-video': {
      const player = inlineVideoFor(target);
      if (!player) return true;
      if (player.video.paused) {
        player.video.play().catch(() => {
          toast('Não foi possível reproduzir o vídeo.', 'error');
          syncInlineVideo(player.player, player.video);
        });
      } else {
        player.video.pause();
      }
      return true;
    }
    case 'toggle-video-mute': {
      const player = inlineVideoFor(target);
      if (!player) return true;
      player.video.muted = !player.video.muted;
      syncInlineVideo(player.player, player.video);
      return true;
    }
    case 'focus-comment': {
      const input = $('#comment-form input');
      if (input) input.focus();
      return true;
    }
    case 'follow':
      await followUser(target.dataset.username);
      return true;
    case 'follow-requests':
      await openFollowRequests();
      return true;
    case 'followers-list':
      await openFollowersModal(target.dataset.username);
      return true;
    case 'following-list':
      await openFollowingModal(target.dataset.username);
      return true;
    case 'close-friends':
      await openCloseFriendsModal();
      return true;
    case 'close-friends-search':
      await renderCloseFriendsSearch();
      return true;
    case 'add-close-friend':
      await addCloseFriend(target.dataset.username, target);
      return true;
    case 'remove-close-friend':
      await removeCloseFriend(target.dataset.username, target);
      return true;
    case 'accept-follow-request':
      await respondFollowRequest(Number(target.dataset.id), 'accept', target);
      return true;
    case 'reject-follow-request':
      await respondFollowRequest(Number(target.dataset.id), 'reject', target);
      return true;
    case 'delete-post':
      await deletePost(Number(target.dataset.id));
      return true;
    case 'delete-comment':
      await deleteComment(Number(target.dataset.id), target);
      return true;
    case 'delete-story':
      await api(`/api/stories/${Number(target.dataset.id)}`, { method: 'DELETE' });
      closeStories();
      toast('Story apagado.');
      return true;
    case 'open-stories':
      pauseInlineVideos();
      openStories(Number(target.dataset.user));
      return true;
    case 'story-next':
      storyNext();
      return true;
    case 'story-prev':
      storyPrev();
      return true;
    case 'react-story':
      await reactToStory(Number(target.dataset.id), target.dataset.emoji);
      return true;
    case 'story-views':
      await openStoryViews(Number(target.dataset.id));
      return true;
    case 'story-profile': {
      const username = target.dataset.username;
      closeStories();
      await navigate('profile', { username });
      return true;
    }
    case 'close-stories':
      closeStories();
      return true;
    case 'feed-more':
      await loadMoreFeed(target);
      return true;
    case 'explore-more':
      await fetchExplore(false);
      return true;
    case 'carousel-prev':
      carouselStep(target, -1);
      return true;
    case 'carousel-next':
      carouselStep(target, 1);
      return true;
    case 'profile-menu': {
      const data = await api(`/api/users/${encodeURIComponent(target.dataset.username)}`);
      openProfileMenu(data.user);
      return true;
    }
    case 'message-user':
      await openMessageWith(target.dataset.username);
      return true;
    case 'block-user':
      await blockUser(target.dataset.username);
      return true;
    case 'blocked-users':
      await openBlockedUsersModal();
      return true;
    case 'unblock-user': {
      const username = target.dataset.username;
      if (!(await unblockUser(username))) return true;
      const row = target.closest('.blocked-person');
      if (row) row.remove();
      const list = $('#blocked-list');
      if (list && !list.querySelector('.blocked-person')) {
        list.innerHTML = '<div class="empty-state compact"><h3>Ninguém bloqueado</h3><p>Pessoas que você bloquear aparecem aqui para que possa desbloquear quando quiser.</p></div>';
      }
      return true;
    }
    case 'report-user':
      closeModal();
      openReportModal({ targetType: 'user', targetId: Number(target.dataset.id), label: 'perfil' });
      return true;
    case 'report-post':
      openReportModal({ targetType: 'post', targetId: Number(target.dataset.id), label: 'publicação' });
      return true;
    case 'share-post':
      await openShareModal(Number(target.dataset.id));
      return true;
    case 'copy-share-link':
      await copyShareLink(target.dataset.link);
      return true;
    case 'send-share-to':
      await sendShareTo(Number(target.dataset.conversation), Number(target.dataset.post));
      return true;
    case 'open-notifications':
      await openNotifications();
      return true;
    case 'open-notification':
      await openNotification(target.dataset.link);
      return true;
    case 'noop':
      return true;
    default:
      return false;
  }
}

async function followUser(username) {
  const data = await api(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'POST' });
  const selector = `[data-action="follow"][data-username="${window.CSS && CSS.escape ? CSS.escape(username) : username}"]`;
  $$(selector).forEach((button) => {
    button.dataset.following = String(data.isFollowing);
    button.dataset.requested = String(!!data.requested);
    button.dataset.private = String(!!data.isPrivate);
    button.textContent = data.isFollowing
      ? 'Seguindo'
      : data.requested
        ? 'Solicitação enviada'
        : data.isPrivate
          ? 'Solicitar para seguir'
          : 'Seguir';
    button.classList.toggle('primary', !data.isFollowing && !data.requested);
    button.classList.toggle('ghost', data.isFollowing || data.requested);
  });

  let visibilityChanged = false;
  if (state.profile && state.profile.user.username.toLowerCase() === username.toLowerCase()) {
    const wasVisible = !!state.profile.canViewContent;
    state.profile.isFollowing = data.isFollowing;
    state.profile.followRequested = !!data.requested;
    state.profile.stats = data.stats;
    state.profile.canViewContent = data.isFollowing || !state.profile.user.isPrivate;
    visibilityChanged = wasVisible !== state.profile.canViewContent;
    const followers = $('[data-profile-followers]');
    if (followers) followers.textContent = formatCount(data.stats.followers);
  }

  if (data.requested) {
    toast(`Solicitação enviada para @${username}.`);
  } else if (data.cancelled) {
    toast('Solicitação cancelada.');
  } else if (data.isFollowing) {
    toast(`Seguindo @${username}.`);
  } else {
    toast(`Deixou de seguir @${username}.`);
  }

  if (visibilityChanged) {
    await navigate('profile', { username });
  }
}

async function deletePost(postId) {
  const confirmed = await confirmDialog({
    title: 'Apagar publicação?',
    body: 'Essa ação não pode ser desfeita. Comentários e curtidas serão removidos com a publicação.',
    confirmLabel: 'Apagar',
    danger: true,
  });
  if (!confirmed) return;
  await api(`/api/posts/${postId}`, { method: 'DELETE' });
  closeModal();
  toast('Publicação apagada.');
  if (state.view === 'profile') await navigate('profile', { username: state.params.username });
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

export async function openMessageWith(username) {
  const data = await api('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
  closeModal();
  await navigate('messages', { conversation: data.conversation.id });
}

/* ------------------------------------------------------------------ */
/* Formulários                                                        */
/* ------------------------------------------------------------------ */

export async function handleSubmit(form, event) {
  if (form.id === 'create-form') {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (!pendingPostMedia.length) {
      toast('Escolha uma foto ou vídeo antes de publicar.', 'error');
      return true;
    }
    const data = new FormData(form);
    const caption = String(data.get('caption') || '');
    const first = pendingPostMedia[0];
    const mediaCount = pendingPostMedia.length;
    setBusy(button, true);
    try {
      const body = { caption };
      if (first.mediaType === 'video') {
        if (!first.uploadedUrl) {
          first.uploadedUrl = await uploadVideo(first.file, (ratio) => {
            button.textContent = `Enviando vídeo ${Math.round(ratio * 100)}%`;
          });
        }
        button.textContent = 'Publicando...';
        body.videoUrl = first.uploadedUrl;
      } else if (pendingPostMedia.length === 1) {
        body.image = first.dataUrl;
      } else {
        body.images = pendingPostMedia.map((item) => item.dataUrl);
      }
      await api('/api/posts', { method: 'POST', body: JSON.stringify(body) });
      releasePendingMedia(pendingPostMedia);
      pendingPostMedia = [];
      closeModal();
      toast(mediaCount > 1 ? 'Carrossel publicado.' : 'Publicação criada.');
      await navigate('home');
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  if (form.id === 'story-form') {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (!pendingMedia) {
      toast('Escolha uma foto ou vídeo antes de publicar.', 'error');
      return true;
    }
    const closeFriends = !!form.querySelector('input[name="closeFriends"]')?.checked;
    const mentions = String(new FormData(form).get('mentions') || '')
      .split(/[\\s,]+/)
      .map((value) => value.trim().replace(/^@/, ''))
      .filter(Boolean);
    setBusy(button, true);
    try {
      let body;
      if (pendingMedia.mediaType === 'video') {
        if (!pendingMedia.uploadedUrl) {
          pendingMedia.uploadedUrl = await uploadVideo(pendingMedia.file, (ratio) => {
            button.textContent = `Enviando vídeo ${Math.round(ratio * 100)}%`;
          });
        }
        button.textContent = 'Publicando...';
        body = { videoUrl: pendingMedia.uploadedUrl, closeFriends, mentions };
      } else {
        body = { image: pendingMedia.dataUrl, closeFriends, mentions };
      }
      await api('/api/stories', { method: 'POST', body: JSON.stringify(body) });
      releasePendingMedia([pendingMedia]);
      pendingMedia = null;
      closeModal();
      toast('Story publicado. Ele desaparece em 24 horas.');
      await navigate('home');
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  if (form.id === 'edit-form') {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const interests = data.getAll('interests').map(String);
    if (interests.length > 12) {
      toast('Selecione no máximo 12 interesses.', 'error');
      return true;
    }
    const payload = {
      name: String(data.get('name') || '').trim(),
      bio: String(data.get('bio') || '').trim(),
      interests,
      messagePolicy: String(data.get('messagePolicy') || 'connections'),
      isPrivate: data.get('isPrivate') === 'on',
    };
    if (!state.me.birthDate && data.get('birthDate')) payload.birthDate = String(data.get('birthDate'));
    if (pendingAvatar) payload.avatar = pendingAvatar;
    const wasPrivate = !!state.me.isPrivate;
    const pendingBefore = Number(state.me.pendingFollowRequests) || 0;
    setBusy(button, true);
    try {
      const result = await api('/api/me', { method: 'PATCH', body: JSON.stringify(payload) });
      state.me = result.user;
      state.me.pendingFollowRequests = Number.isFinite(result.pendingFollowRequests)
        ? result.pendingFollowRequests
        : 0;
      state.me.badges = Array.isArray(result.badges) ? result.badges : [];
      pendingAvatar = null;
      refreshNavAvatar();
      closeModal();
      if (wasPrivate && !state.me.isPrivate && pendingBefore > 0) {
        toast(`Perfil público. ${pendingBefore} ${plural(pendingBefore, 'solicitação foi aceita', 'solicitações foram aceitas')}.`);
      } else {
        toast('Perfil atualizado.');
      }
      await navigate('profile', { username: state.me.username });
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  if (form.id === 'story-reply-form') {
    event.preventDefault();
    const input = form.querySelector('input[name="text"]');
    const text = String(input?.value || '').trim();
    if (!text) return true;
    const storyId = Number(form.dataset.story);
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true);
    try {
      await api(`/api/stories/${storyId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      if (input) input.value = '';
      toast('Resposta enviada.');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  if (form.id === 'comment-form') {
    event.preventDefault();
    const postId = Number(form.dataset.post);
    const input = form.querySelector('input[name="text"]');
    const text = input.value.trim();
    if (!text) return true;
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
    return true;
  }

  if (form.id === 'report-form') {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    setBusy(button, true);
    try {
      await api('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: form.dataset.targetType,
          targetId: Number(form.dataset.targetId),
          reason: String(data.get('reason') || 'outro'),
          details: String(data.get('details') || '').trim(),
        }),
      });
      closeModal();
      toast('Denúncia enviada para revisão.');
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  return false;
}
