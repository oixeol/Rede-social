/* Vibra - menu lateral do perfil: relato de problemas. */
/*
 * @module account-menu
 * Este arquivo implementa o modal acionado pelo menu lateral do ícone
 * de perfil da navbar:
 *
 *  - Relatar um problema: envio de um relato técnico para a equipe, com
 *    categoria, descrição e dados de contexto (navegador, página, versão).
 *
 * As configurações da conta foram movidas para a página `settings.js`.
 *
 * Contrato de `handleSubmit(form, event)`: recebe o formulário identificado
 * por `form.id` e o evento de submissão, vindos da delegação em main.js.
 *
 * Dependências:
 *  - core.js: helper de API, modais, escape e avisos.
 */

import {
  esc,
  icon,
  openModal,
  closeModal,
  api,
  toast,
  setBusy,
} from './core.js';

/**
 * Lista das categorias aceitas pelo relato de problema.
 * O backend valida o mesmo conjunto (`PROBLEM_CATEGORIES`).
 */
const PROBLEM_CATEGORIES = [
  { id: 'bug', label: 'Erro ou comportamento inesperado' },
  { id: 'layout', label: 'Problema de visualização ou layout' },
  { id: 'login', label: 'Entrar ou criar conta' },
  { id: 'performance', label: 'Lentidão ou travamento' },
  { id: 'moderation', label: 'Moderação ou segurança' },
  { id: 'other', label: 'Outro assunto' },
];

/**
 * Monta a versão curta da aplicação exibida no contexto do relato.
 *
 * @returns {string} Texto com navegador, plataforma e URL atual.
 */
function contextSummary() {
  const parts = [];
  const agent = navigator.userAgent || 'desconhecido';
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /OPR\//.test(agent)
      ? 'Opera'
      : /Chrome\//.test(agent)
        ? 'Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : /Firefox\//.test(agent)
            ? 'Firefox'
            : 'Outro navegador';
  parts.push(browser);
  if (navigator.platform) parts.push(navigator.platform);
  parts.push(window.location.pathname);
  return parts.join(' · ');
}

/**
 * Abre o modal de relato de problema.
 *
 * @returns {void}
 */
export function openProblemReportModal() {
  openModal(`
    <div class="modal-head">
      <h2>Relatar um problema</h2>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>
    </div>
    <form id="problem-form" class="modal-form">
      <p class="muted small">O relato é privado e chega à equipe. Não é uma denúncia de conteúdo.</p>
      <label class="field">
        <span>Categoria</span>
        <select name="category" required>
          ${PROBLEM_CATEGORIES.map((category) => `
            <option value="${esc(category.id)}">${esc(category.label)}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>O que aconteceu?</span>
        <input name="title" type="text" maxlength="120" required placeholder="Resumo curto do problema" />
      </label>
      <label class="field">
        <span>Detalhes</span>
        <textarea name="details" rows="4" maxlength="2000" placeholder="Descreva o que você fez e o que aconteceu."></textarea>
      </label>
      <p class="field-hint">Contexto enviado: ${esc(contextSummary())}</p>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn primary">Enviar relato</button>
      </div>
    </form>`, 'problem-modal');
}

/**
 * Processa os formulários do menu da conta.
 *
 * @param {HTMLFormElement} form Formulário submetido.
 * @param {Event} event Evento de submissão.
 * @returns {Promise<boolean>} `true` quando o formulário foi tratado aqui.
 */
export async function handleSubmit(form, event) {
  if (form.id === 'problem-form') {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    if (!title) {
      toast('Descreva o problema em uma linha.', 'error');
      return true;
    }
    setBusy(button, true);
    try {
      await api('/api/problem-reports', {
        method: 'POST',
        body: JSON.stringify({
          category: String(data.get('category') || 'other'),
          title,
          details: String(data.get('details') || '').trim(),
          context: contextSummary(),
        }),
      });
      closeModal();
      toast('Relato enviado. Obrigado por avisar.');
    } catch (error) {
      toast(error.message || 'Não foi possível enviar o relato.', 'error');
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  return false;
}
