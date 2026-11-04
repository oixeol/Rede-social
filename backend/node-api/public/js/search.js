/* Vibra - busca global da topbar. */

/**
 * Módulo search.js – implementa a pesquisa da barra superior.
 *
 * A busca consulta a rota real `GET /api/search`, que devolve usuários reais do
 * banco. Os resultados são exibidos em um painel suspenso; ao escolher um
 * resultado, a aplicação navega para o perfil correspondente.
 *
 * Exporta:
 *   * `initSearch`: liga o campo de busca ao painel de resultados.
 *   * `closeSearchResults`: fecha o painel de resultados.
 *   * `clearSearch`: limpa o campo e fecha o painel.
 */

import { $, api, avatar, esc, hydrateIcons } from './core.js';

const SEARCH_DEBOUNCE_MS = 260;
let debounceTimer = null;
let requestToken = 0;
let activeController = null;

/**
 * Retorna os elementos do campo de busca, ou `null` quando o markup não existe.
 *
 * @returns {{form: HTMLElement, input: HTMLInputElement, panel: HTMLElement, clear: HTMLElement}|null}
 */
function searchElements() {
  const form = $('#topbar-search');
  const input = $('#topbar-search-input');
  const panel = $('#search-panel');
  if (!form || !input || !panel) return null;
  return { form, input, panel, clear: form.querySelector('.topbar-search-clear') };
}

/**
 * Oculta o painel de resultados e cancela requisições em andamento.
 */
export function closeSearchResults() {
  const elements = searchElements();
  if (!elements) return;
  requestToken += 1;
  elements.panel.hidden = true;
  elements.panel.innerHTML = '';
}

/**
 * Limpa o campo de busca, fecha o painel e devolve o foco ao campo.
 */
export function clearSearch() {
  const elements = searchElements();
  if (!elements) return;
  elements.input.value = '';
  closeSearchResults();
  if (elements.clear) elements.clear.hidden = true;
  elements.input.focus();
}

/**
 * Desenha um estado simples dentro do painel (carregando, vazio ou erro).
 *
 * @param {HTMLElement} panel Painel de resultados.
 * @param {string} message Texto exibido ao usuário.
 */
function renderPanelMessage(panel, message) {
  panel.innerHTML = `<p class="search-empty">${esc(message)}</p>`;
  panel.hidden = false;
}

/**
 * Monta o painel com a lista de usuários retornada pela API.
 *
 * @param {HTMLElement} panel Painel de resultados.
 * @param {Array} users Usuários encontrados na busca.
 */
function renderResults(panel, users) {
  if (!users.length) {
    renderPanelMessage(panel, 'Nenhum perfil encontrado para essa busca.');
    return;
  }
  panel.innerHTML = users
    .map(
      (user) => `
      <button type="button" class="search-result" role="option" data-action="profile" data-username="${esc(user.username)}">
        ${avatar(user, 40)}
        <span class="search-result-meta">
          <strong>${esc(user.name)}</strong>
          <small>@${esc(user.username)}</small>
        </span>
      </button>`
    )
    .join('');
  panel.hidden = false;
  hydrateIcons(panel);
}

/**
 * Executa a consulta de busca e atualiza o painel de resultados.
 *
 * @param {string} query Texto digitado pela pessoa usuária.
 */
async function runSearch(query) {
  const elements = searchElements();
  if (!elements) return;
  const token = ++requestToken;
  if (activeController) activeController.abort();
  const controller = new AbortController();
  activeController = controller;
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
    if (token !== requestToken) return;
    const users = Array.isArray(data.users) ? data.users : [];
    renderResults(elements.panel, users);
  } catch (error) {
    if (token !== requestToken || error.name === 'AbortError') return;
    renderPanelMessage(elements.panel, error.message || 'Não foi possível buscar agora.');
  } finally {
    if (activeController === controller) activeController = null;
  }
}

/**
 * Liga o campo de busca: digitação com atraso, envio por Enter e limpeza.
 */
export function initSearch() {
  const elements = searchElements();
  if (!elements) return;
  const { form, input, panel, clear } = elements;

  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (clear) clear.hidden = !query;
    window.clearTimeout(debounceTimer);
    if (!query) {
      closeSearchResults();
      return;
    }
    debounceTimer = window.setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim() && !panel.innerHTML) runSearch(input.value.trim());
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const first = panel.querySelector('.search-result');
    if (first) first.click();
  });

  document.addEventListener('click', (event) => {
    if (!form.contains(event.target)) closeSearchResults();
  });

  /* Ao escolher um resultado o painel fecha e o campo é limpo, deixando a
     navegação para o perfil sem estado residual. */
  panel.addEventListener('click', (event) => {
    if (event.target.closest('.search-result')) {
      input.value = '';
      if (clear) clear.hidden = true;
      closeSearchResults();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!panel.hidden) {
      closeSearchResults();
      return;
    }
    if (input.value) clearSearch();
  });
}
