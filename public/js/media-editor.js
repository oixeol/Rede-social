/* Vibra - editor de imagem (recorte, zoom e rotação) para avatar e capa. */
/*
 * @module media-editor
 *
 * Editor de mídia executado inteiramente no navegador, sem dependências:
 *
 *  - `Cropper`: componente de canvas que centraliza uma imagem dentro de uma
 *    moldura, aplica zoom, rotação de 90° e deslocamento por arraste.
 *  - `openAvatarEditor()`: modal de edição da foto de perfil (previews,
 *    controles de zoom, rotação, abas e faixa de thumbnails).
 *  - `openCoverEditor()`: modal de edição da capa do perfil.
 *
 * O recorte final é gerado em um canvas offscreen e convertido em data URL,
 * no mesmo formato aceito por `PATCH /api/me` (`data:image/jpeg;base64,...`).
 *
 * Dependências:
 *  - core.js: helpers de DOM, ícones, API, avisos e modais.
 */

import {
  $,
  $$,
  state,
  icon,
  esc,
  api,
  toast,
  setBusy,
  openModal,
  closeModal,
  fileToDataUrl,
  refreshNavAvatar,
} from './core.js';

/** Limite de tamanho aceito pelo backend para imagens de perfil. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Atualiza o estado local da sessão após salvar avatar ou capa.
 *
 * O DTO devolvido por `PATCH /api/me` não traz `pendingFollowRequests`; o valor
 * anterior é preservado para não zerar o contador de solicitações.
 *
 * @param {object} result Resposta da API.
 * @returns {void}
 */
function applyMeUpdate(result) {
  if (!result || !result.user) return;
  const pending = state.me ? state.me.pendingFollowRequests : 0;
  state.me = result.user;
  state.me.pendingFollowRequests = pending;
  state.me.badges = Array.isArray(result.badges) ? result.badges : [];
  refreshNavAvatar();
}

/**
 * Converte um valor entre 0 e 1 (escala relativa) em porcentagem.
 *
 * @param {number} value Valor relativo.
 * @returns {number} Porcentagem arredondada.
 */
function toPercent(value) {
  return Math.round(value * 100);
}

/**
 * Carrega uma imagem a partir de uma URL ou data URL.
 *
 * @param {string} src Endereço da imagem.
 * @returns {Promise<HTMLImageElement>} Imagem carregada.
 */
function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    image.src = src;
  });
}

/**
 * Editor de recorte baseado em `<canvas>`.
 *
 * A imagem é desenhada sempre "covering" a moldura: a escala base é calculada
 * para que o maior lado da imagem cubra a área visível. O zoom multiplica essa
 * escala e o deslocamento (`offset`) move a imagem dentro da moldura.
 *
 * @class Cropper
 */
export class Cropper {
  /**
   * @param {HTMLCanvasElement} canvas Canvas de destino.
   * @param {object} [options] Opções do editor.
   * @param {number} [options.width=512] Largura lógica do canvas.
   * @param {number} [options.height=512] Altura lógica do canvas.
   * @param {'circle'|'rect'} [options.shape='circle'] Formato da moldura.
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = options.width || 512;
    this.height = options.height || 512;
    this.shape = options.shape || 'circle';
    this.image = null;
    this.zoom = 1;
    this.rotation = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.dragging = false;
    this.lastPointer = null;
    this.onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this._bindPointer();
  }

  /**
   * Liga os eventos de arraste (mouse, toque e caneta) ao canvas.
   *
   * O deslocamento é convertido de pixels da tela para pixels do canvas, para
   * que o arraste tenha o mesmo comportamento independentemente do tamanho
   * exibido do preview.
   *
   * @returns {void}
   */
  _bindPointer() {
    const canvas = this.canvas;
    const start = (event) => {
      if (!this.image) return;
      this.dragging = true;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
      canvas.classList.add('is-dragging');
    };
    const move = (event) => {
      if (!this.dragging || !this.lastPointer) return;
      const rect = canvas.getBoundingClientRect();
      const ratioX = rect.width ? canvas.width / rect.width : 1;
      const ratioY = rect.height ? canvas.height / rect.height : 1;
      const dx = (event.clientX - this.lastPointer.x) * ratioX;
      const dy = (event.clientY - this.lastPointer.y) * ratioY;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.offsetX += dx;
      this.offsetY += dy;
      this.clampOffset();
      this.render();
    };
    const end = (event) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.lastPointer = null;
      canvas.releasePointerCapture?.(event.pointerId);
      canvas.classList.remove('is-dragging');
    };
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', end);
  }

  /**
   * Carrega uma imagem no editor e reinicia zoom, rotação e deslocamento.
   *
   * @param {string} src URL ou data URL da imagem.
   * @returns {Promise<void>} Resolve quando a imagem está pronta.
   */
  async load(src) {
    this.image = await loadImageElement(src);
    this.zoom = 1;
    this.rotation = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.render();
    this.onChange();
  }

  /**
   * Limpa a imagem atual do editor.
   *
   * @returns {void}
   */
  clear() {
    this.image = null;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.onChange();
  }

  /**
   * Define o zoom (multiplicador da escala base).
   *
   * @param {number} value Valor entre 1 e 4.
   * @returns {void}
   */
  setZoom(value) {
    const next = Math.min(4, Math.max(1, Number(value) || 1));
    if (next === this.zoom) return;
    this.zoom = next;
    this.clampOffset();
    this.render();
    this.onChange();
  }

  /**
   * Ajusta o zoom em um incremento.
   *
   * @param {number} delta Incremento aplicado ao zoom.
   * @returns {void}
   */
  zoomBy(delta) {
    this.setZoom(this.zoom + delta);
  }

  /**
   * Gira a imagem em 90° no sentido horário.
   *
   * @returns {void}
   */
  rotate() {
    this.rotation = (this.rotation + 90) % 360;
    this.offsetX = 0;
    this.offsetY = 0;
    this.render();
    this.onChange();
  }

  /**
   * Restaura zoom, rotação e deslocamento originais.
   *
   * @returns {void}
   */
  reset() {
    this.zoom = 1;
    this.rotation = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.render();
    this.onChange();
  }

  /**
   * Calcula a escala base que faz a imagem cobrir a moldura.
   *
   * @returns {number} Escala base.
   */
  baseScale() {
    if (!this.image) return 1;
    const naturalW = this.image.naturalWidth || this.image.width;
    const naturalH = this.image.naturalHeight || this.image.height;
    const rotated = this.rotation % 180 !== 0;
    const sourceW = rotated ? naturalH : naturalW;
    const sourceH = rotated ? naturalW : naturalH;
    return Math.max(this.width / sourceW, this.height / sourceH);
  }

  /**
   * Limita o deslocamento para que a imagem continue cobrindo a moldura.
   *
   * @returns {void}
   */
  clampOffset() {
    if (!this.image) return;
    const naturalW = this.image.naturalWidth || this.image.width;
    const naturalH = this.image.naturalHeight || this.image.height;
    const rotated = this.rotation % 180 !== 0;
    const sourceW = (rotated ? naturalH : naturalW) * this.baseScale() * this.zoom;
    const sourceH = (rotated ? naturalW : naturalH) * this.baseScale() * this.zoom;
    const maxX = Math.max(0, (sourceW - this.width) / 2);
    const maxY = Math.max(0, (sourceH - this.height) / 2);
    this.offsetX = Math.min(maxX, Math.max(-maxX, this.offsetX));
    this.offsetY = Math.min(maxY, Math.max(-maxY, this.offsetY));
  }

  /**
   * Desenha a imagem na moldura conforme zoom, rotação e deslocamento atuais.
   *
   * @param {CanvasRenderingContext2D} [target=this.ctx] Contexto de destino.
   * @param {boolean} [clip=true] Aplica o recorte da moldura (círculo ou retângulo).
   * @returns {void}
   */
  render(target = this.ctx, clip = true) {
    const ctx = target;
    const { width, height } = this;
    ctx.clearRect(0, 0, width, height);
    if (!this.image) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(0, 0, width, height);
      return;
    }
    const naturalW = this.image.naturalWidth || this.image.width;
    const naturalH = this.image.naturalHeight || this.image.height;
    const scale = this.baseScale() * this.zoom;
    const drawW = naturalW * scale;
    const drawH = naturalH * scale;

    ctx.save();
    if (clip) {
      ctx.beginPath();
      if (this.shape === 'circle') {
        ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
        ctx.clip();
      } else {
        ctx.rect(0, 0, width, height);
        ctx.clip();
      }
    }
    ctx.translate(width / 2 + this.offsetX, height / 2 + this.offsetY);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.drawImage(this.image, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  /**
   * Exporta o recorte atual como data URL.
   *
   * O avatar é exportado em PNG a partir de um canvas quadrado (sem o corte
   * circular da pré-visualização). Assim a imagem salva continua exibindo
   * corretamente em qualquer lugar do app, onde o arredondamento é aplicado
   * pelo CSS, e o conteúdo visível dentro do círculo do preview é preservado.
   *
   * @param {number} [quality=0.9] Qualidade da compressão JPEG.
   * @returns {string} Data URL pronta para `PATCH /api/me`.
   */
  exportDataUrl(quality = 0.9) {
    if (!this.image) return '';
    if (this.shape !== 'circle') return this.canvas.toDataURL('image/jpeg', quality);
    const offscreen = document.createElement('canvas');
    offscreen.width = this.width;
    offscreen.height = this.height;
    const ctx = offscreen.getContext('2d');
    this.render(ctx, false);
    return offscreen.toDataURL('image/jpeg', quality);
  }
}

/**
 * Cria o markup compartilhado pelos controles do editor.
 *
 * @param {string} idPrefix Prefixo único dos ids dentro do modal.
 * @param {boolean} withSlider Define se o slider de zoom é exibido.
 * @returns {string} Markup HTML dos controles.
 */
function controlsMarkup(idPrefix, withSlider) {
  return `
    <div class="media-editor-bar">
      <div class="media-editor-zoom">
        <button type="button" class="media-zoom-btn" data-action="media-zoom-out" data-target="${idPrefix}" aria-label="Diminuir zoom">${icon('minus', 16)}</button>
        <span class="media-zoom-value" data-zoom-value="${idPrefix}">100%</span>
        <button type="button" class="media-zoom-btn" data-action="media-zoom-in" data-target="${idPrefix}" aria-label="Aumentar zoom">${icon('plus', 16)}</button>
      </div>
      <button type="button" class="media-rotate-btn" data-action="media-rotate" data-target="${idPrefix}" aria-label="Rotacionar imagem">${icon('rotate', 18)}</button>
    </div>
    ${withSlider ? `
      <div class="media-editor-slider">
        <input type="range" class="media-zoom-slider" id="${idPrefix}-zoom-slider" min="100" max="400" step="5" value="100" aria-label="Zoom" />
      </div>` : ''}`;
}

/**
 * Aplica um estado visual às abas do editor.
 *
 * @param {HTMLElement} root Elemento que contém as abas.
 * @param {string} active Nome da aba ativa.
 * @returns {void}
 */
function activateTab(root, active) {
  $$('.media-editor-tab', root).forEach((tab) => {
    const isActive = tab.dataset.tab === active;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
}

/**
 * Atualiza o rótulo e o slider de zoom de um editor.
 *
 * @param {Cropper} cropper Instância do editor.
 * @param {string} idPrefix Prefixo dos ids dos controles.
 * @returns {void}
 */
function syncZoomControls(cropper, idPrefix) {
  const label = $(`[data-zoom-value="${idPrefix}"]`);
  const slider = $(`#${idPrefix}-zoom-slider`);
  const percent = toPercent(cropper.zoom);
  if (label) label.textContent = `${percent}%`;
  if (slider && Number(slider.value) !== percent) slider.value = String(percent);
}

/**
 * Liga os controles de zoom e rotação de um editor.
 *
 * @param {Cropper} cropper Instância do editor.
 * @param {string} idPrefix Prefijo dos ids dos controles.
 * @returns {void}
 */
function bindEditorControls(cropper, idPrefix) {
  const slider = $(`#${idPrefix}-zoom-slider`);
  $(`[data-action="media-zoom-out"][data-target="${idPrefix}"]`)?.addEventListener('click', () => cropper.zoomBy(-0.1));
  $(`[data-action="media-zoom-in"][data-target="${idPrefix}"]`)?.addEventListener('click', () => cropper.zoomBy(0.1));
  $(`[data-action="media-rotate"][data-target="${idPrefix}"]`)?.addEventListener('click', () => cropper.rotate());
  slider?.addEventListener('input', (event) => cropper.setZoom(Number(event.target.value) / 100));
  syncZoomControls(cropper, idPrefix);
}

/**
 * Abre o editor de foto de perfil.
 *
 * O modal traz preview circular, controles de zoom à esquerda, rotação à
 * direita, slider de zoom, abas "Trocar foto" / "Tirar foto" / "Remover foto",
 * faixa de thumbnails e rodapé com "Cancelar" e "Salvar alterações".
 *
 * @param {object} data Objeto com `user` e `isMe`.
 * @param {object} [options] Opções do editor.
 * @param {boolean} [options.autoEdit=false] Abre a aba "Trocar foto" já aberta.
 * @param {Function} [options.onSaved] Callback executado após salvar.
 * @returns {void}
 */
export function openAvatarEditor(data, { autoEdit = false, onSaved = null } = {}) {
  const user = data.user;
  const canEdit = !!data.isMe;

  const modal = openModal(`
    <div class="modal-head">
      <h2>Editar foto de perfil</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
    </div>
    <div class="media-editor" data-editor="avatar">
      <div class="media-editor-stage">
        <div class="media-editor-preview">
          <canvas id="avatar-cropper" class="media-canvas media-canvas--circle" width="512" height="512" aria-label="Pré-visualização da foto de perfil"></canvas>
        </div>
        ${controlsMarkup('avatar', true)}
      </div>

      <div class="media-editor-tabs" role="tablist" aria-label="Origem da foto">
        <button type="button" class="media-editor-tab is-active" role="tab" aria-selected="true" data-tab="change" data-action="media-editor-tab">Trocar foto</button>
        <button type="button" class="media-editor-tab" role="tab" aria-selected="false" data-tab="take" data-action="media-editor-tab">Tirar foto</button>
        <button type="button" class="media-editor-tab" role="tab" aria-selected="false" data-tab="remove" data-action="media-editor-tab">Remover foto</button>
      </div>

      <div class="media-editor-thumbs" id="avatar-thumbs" aria-label="Fotos recentes"></div>

      <div class="media-editor-footer">
        <button type="button" class="btn ghost" data-action="close-modal">Cancelar</button>
        <button type="button" class="btn primary" id="avatar-editor-save" disabled>Salvar alterações</button>
      </div>
    </div>`, 'media-editor-modal');

  const root = $('.media-editor', modal);
  const canvas = $('#avatar-cropper', modal);
  const thumbs = $('#avatar-thumbs', modal);
  const saveButton = $('#avatar-editor-save', modal);
  if (!root || !canvas || !saveButton) return;

  const cropper = new Cropper(canvas, {
    width: 512,
    height: 512,
    shape: 'circle',
    onChange: () => {
      syncZoomControls(cropper, 'avatar');
      if (cropper.image) saveButton.disabled = false;
    },
  });

  const history = [];
  let removing = false;

  /**
   * Adiciona uma imagem à faixa de thumbnails.
   *
   * @param {string} src Data URL da imagem.
   * @returns {void}
   */
  function pushThumb(src) {
    if (!thumbs) return;
    history.unshift(src);
    thumbs.innerHTML = history
      .slice(0, 6)
      .map((item, index) => `<button type="button" class="media-thumb${index === 0 ? ' is-active' : ''}" data-action="media-thumb-pick" data-index="${index}" aria-label="Usar esta foto"><img src="${esc(item)}" alt="" /></button>`)
      .join('');
  }

  /**
   * Aplica a imagem selecionada no editor.
   *
   * @param {string} src Data URL da imagem.
   * @param {boolean} [addToHistory=true] Define se a imagem entra na faixa de thumbnails.
   * @returns {Promise<void>} Resolve após o carregamento.
   */
  async function useImage(src, addToHistory = true) {
    removing = false;
    await cropper.load(src);
    if (addToHistory) pushThumb(src);
    saveButton.disabled = false;
  }

  if (user.avatar) {
    cropper.load(user.avatar).then(() => {
      pushThumb(user.avatar);
    }).catch(() => {});
  }

  bindEditorControls(cropper, 'avatar');

  $$('.media-editor-tab', root).forEach((tab) => {
    tab.addEventListener('click', async () => {
      if (!canEdit) return;
      const tabName = tab.dataset.tab;
      activateTab(root, tabName);
      if (tabName === 'change' || tabName === 'take') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/webp,image/gif';
        if (tabName === 'take') input.setAttribute('capture', 'user');
        input.addEventListener('change', async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          if (file.size > MAX_IMAGE_BYTES) {
            toast('A imagem precisa ter no máximo 8 MB.', 'error');
            return;
          }
          try {
            await useImage(await fileToDataUrl(file));
          } catch (error) {
            toast(error.message || 'Não foi possível carregar a imagem.', 'error');
          }
        });
        input.click();
      } else if (tabName === 'remove') {
        removing = true;
        cropper.clear();
        saveButton.disabled = false;
      }
    });
  });

  thumbs?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="media-thumb-pick"]');
    if (!button || !canEdit) return;
    const index = Number(button.dataset.index);
    const src = history[index];
    if (!src) return;
    try {
      await useImage(src, false);
      $$('.media-thumb', thumbs).forEach((thumb) => thumb.classList.toggle('is-active', thumb === button));
    } catch (error) {
      toast(error.message || 'Não foi possível carregar a imagem.', 'error');
    }
  });

  saveButton.addEventListener('click', async () => {
    if (!canEdit) return;
    setBusy(saveButton, true);
    try {
      const payload = removing ? { avatar: null } : { avatar: cropper.exportDataUrl() };
      const result = await api('/api/me', { method: 'PATCH', body: JSON.stringify(payload) });
      applyMeUpdate(result);
      toast(removing ? 'Foto de perfil removida.' : 'Foto de perfil atualizada.');
      closeModal();
      if (typeof onSaved === 'function') await onSaved();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar a foto.', 'error');
    } finally {
      setBusy(saveButton, false);
    }
  });

  if (autoEdit) {
    const changeTab = $('.media-editor-tab[data-tab="change"]', root);
    changeTab?.click();
  }
}

/**
 * Abre o editor de capa do perfil.
 *
 * O modal traz a moldura de recorte, slider de zoom, botão de rotação e um
 * rodapé com "Redefinir", "Cancelar" e "Aplicar".
 *
 * @param {object} data Objeto com `user` e `isMe`.
 * @param {object} [options] Opções do editor.
 * @param {Function} [options.onSaved] Callback executado após salvar.
 * @returns {void}
 */
export function openCoverEditor(data, { onSaved = null } = {}) {
  const user = data.user;
  const canEdit = !!data.isMe;

  const modal = openModal(`
    <div class="modal-head">
      <h2>Editar capa</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
    </div>
    <div class="media-editor media-editor--cover" data-editor="cover">
      <div class="media-editor-stage">
        <div class="media-editor-preview media-editor-preview--cover">
          <canvas id="cover-cropper" class="media-canvas" width="1200" height="420" aria-label="Pré-visualização da capa"></canvas>
        </div>
        ${controlsMarkup('cover', true)}
      </div>

      <div class="media-editor-footer">
        <button type="button" class="btn ghost" data-action="media-editor-reset" data-target="cover">Redefinir</button>
        <button type="button" class="btn ghost" data-action="close-modal">Cancelar</button>
        <button type="button" class="btn primary" id="cover-editor-save" disabled>Aplicar</button>
      </div>
    </div>`, 'media-editor-modal media-editor-modal--cover');

  const root = $('.media-editor', modal);
  const canvas = $('#cover-cropper', modal);
  const saveButton = $('#cover-editor-save', modal);
  if (!root || !canvas || !saveButton) return;

  const cropper = new Cropper(canvas, {
    width: 1200,
    height: 420,
    shape: 'rect',
    onChange: () => {
      syncZoomControls(cropper, 'cover');
      if (cropper.image) saveButton.disabled = false;
    },
  });

  bindEditorControls(cropper, 'cover');

  let source = user.banner || null;

  if (source) {
    cropper.load(source).catch(() => {});
  }

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = 'image/png,image/jpeg,image/webp,image/gif';
  picker.addEventListener('change', async () => {
    const file = picker.files && picker.files[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast('A imagem precisa ter no máximo 8 MB.', 'error');
      return;
    }
    try {
      source = await fileToDataUrl(file);
      await cropper.load(source);
      saveButton.disabled = false;
    } catch (error) {
      toast(error.message || 'Não foi possível carregar a imagem.', 'error');
    }
  });

  const changeButton = document.createElement('button');
  changeButton.type = 'button';
  changeButton.className = 'btn primary media-editor-change';
  changeButton.textContent = source ? 'Trocar imagem' : 'Escolher imagem';
  changeButton.addEventListener('click', () => picker.click());
  $('.media-editor-footer', root)?.prepend(changeButton);

  $('[data-action="media-editor-reset"]', root)?.addEventListener('click', () => {
    if (!source) {
      cropper.clear();
      saveButton.disabled = true;
      return;
    }
    cropper.reset();
    saveButton.disabled = false;
  });

  saveButton.addEventListener('click', async () => {
    if (!canEdit || !cropper.image) return;
    setBusy(saveButton, true);
    try {
      const result = await api('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ banner: cropper.exportDataUrl(0.86) }),
      });
      applyMeUpdate(result);
      toast('Capa atualizada.');
      closeModal();
      if (typeof onSaved === 'function') await onSaved();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar a capa.', 'error');
    } finally {
      setBusy(saveButton, false);
    }
  });
}
