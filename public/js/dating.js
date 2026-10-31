/* Vibra - Namoro: verificação, descoberta, curtidas e matches. */
/**
 * Sistema de Namoro do Vibra.
 *
 * Propósito: orchestrar a experiência de encontros verificados, incluindo o gate
 * obrigatório de verificação de identidade e idade 18+, a descoberta de candidatos,
 * as curtidas, os matches confirmados e as ações de perfil.
 *
 * Abas disponíveis: Descobrir, Matches, Perfil e Radar. A renderização de Perfil e
 * Radar é delegada a `dating-profile.js`, que também controla o questionário parcial
 * e o compartilhamento bilateral de localização.
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
  longDate,
  avatar,
  interestChips,
  emptyState,
  api,
  toast,
  setBusy,
  openModal,
  closeModal,
  confirmDialog,
  navigate,
} from './core.js';
import { openReportModal, blockUser } from './social-actions.js';
import {
  renderRadarTab,
  renderDatingProfileTab,
  handleAction as handleProfileAction,
  handleSubmit as handleProfileSubmit,
} from './dating-profile.js';

/* Textos de exibição para cada status de verificação. */
const STATUS_COPY = {
  not_started: {
    label: 'Não verificado',
    text: 'Você ainda não iniciou a verificação de identidade e idade.',
  },
  in_review: {
    label: 'Em análise',
    text: 'Sua verificação foi registrada e está aguardando o resultado.',
  },
  approved: { label: 'Verificado', text: 'Identidade e idade aprovadas.' },
  rejected: {
    label: 'Recusado',
    text: 'A verificação não foi aprovada. Você pode tentar novamente.',
  },
  needs_review: {
    label: 'Revisão necessária',
    text: 'O provedor pediu uma revisão. Envie os dados novamente ou aguarde o contato.',
  },
  expired: {
    label: 'Verificação expirada',
    text: 'Sua verificação venceu. É necessário renovar para voltar ao Namoro.',
  },
};

/**
 * Obtém textos amigáveis para um status de verificação.
 *
 * @param {string} status Código do status.
 * @returns {{label: string, text: string}} Rótulo e descrição.
 */
function statusInfo(status) {
  return STATUS_COPY[status] || STATUS_COPY.not_started;
}

/**
 * Exibe aviso quando a verificação está em modo de simulação.
 *
 * @returns {string} Markup do badge ou string vazia.
 */
function simulationBadge() {
  if (!state.config.identity.simulation && state.config.identity.mode !== 'dev') return '';
  return `<span class="dating-sim-badge">${icon('alert', 13)} Simulação de desenvolvimento</span>`;
}

/* ------------------------------------------------------------------ */
/* Entrada da área                                                    */
/* ------------------------------------------------------------------ */

/**
 * Renderiza a área de Namoro.
 *
 * Aplica o gate de verificação 18+/identidade antes de exibir as abas.
 * Delega Perfil e Radar para `dating-profile.js`.
 *
 * @param {HTMLElement} viewElement Elemento da página.
 * @param {Object} params Parâmetros de navegação, incluindo `tab`.
 */
export async function renderDating(viewElement, params = {}) {
  if (params.tab) state.dating.tab = params.tab;
  const status = await api('/api/dating/status');
  state.dating.status = status;
  if (state.view !== 'dating') return;

  if (!status.verification.allowed) {
    renderGate(viewElement, status);
    hydrateIcons(viewElement);
    return;
  }

  const tab = state.dating.tab || 'discover';
  viewElement.innerHTML = `
    <div class="dating-page">
      <header class="dating-head">
        <div class="dating-title">
          <span class="dating-mark" aria-hidden="true">${icon('spark', 24)}</span>
          <div>
            <p class="eyebrow">Namoro</p>
            <h1>Encontre afinidades com contexto.</h1>
            <p>Uma experiência separada do perfil social. Você controla o que aparece, para quem e quando.</p>
          </div>
        </div>
        <div class="dating-head-badges">
          <span class="verified-pill">${icon('shield', 14)} Verificado</span>
          ${status.verification.isSimulation ? `<span class="simulation-pill">${icon('alert', 13)} Aprovação simulada</span>` : ''}
        </div>
      </header>
      <nav class="dating-tabs" aria-label="Áreas do Namoro">
        <button type="button" class="dating-tab ${tab === 'discover' ? 'active' : ''}" data-action="dating-tab" data-tab="discover">
          ${icon('compass', 17)} Descobrir
        </button>
        <button type="button" class="dating-tab ${tab === 'matches' ? 'active' : ''}" data-action="dating-tab" data-tab="matches">
          ${icon('heart', 17)} Matches <span class="tab-count">${formatCount(status.matchCount)}</span>
        </button>
        <button type="button" class="dating-tab ${tab === 'radar' ? 'active' : ''}" data-action="dating-tab" data-tab="radar">
          ${icon('radar', 17)} Radar
        </button>
        <button type="button" class="dating-tab ${tab === 'profile' ? 'active' : ''}" data-action="dating-tab" data-tab="profile">
          ${icon('sliders', 17)} Meu perfil
        </button>
      </nav>
      <div id="dating-tab-content">
        <div class="dating-loading">${icon('spark', 24)}<span>Carregando...</span></div>
      </div>
    </div>`;
  hydrateIcons(viewElement);

  const container = $('#dating-tab-content');
  try {
    if (tab === 'discover') await renderDiscover(container, status);
    else if (tab === 'matches') await renderMatchesTab(container);
    else if (tab === 'radar') await renderRadarTab(container, status);
    else await renderDatingProfileTab(container, status);
    hydrateIcons(container);
  } catch (error) {
    if (state.view !== 'dating') return;
    container.innerHTML = emptyState({
      iconName: 'alert',
      title: 'Não foi possível carregar esta área',
      text: error.message,
      action: '<button type="button" class="btn ghost" data-action="dating-reload">Tentar de novo</button>',
    });
    hydrateIcons(container);
  }
}

/* ------------------------------------------------------------------ */
/* Verificação                                                        */
/* ------------------------------------------------------------------ */

/**
 * Renderiza o gate obrigatório de verificação de identidade e idade 18+.
 *
 * `not_started`, `rejected`, `needs_review` e `expired` permitem reenvio;
 * `in_review` mostra aguardo; `approved` libera o acesso normal.
 *
 * @param {HTMLElement} viewElement Elemento da página.
 * @param {object} status Estado de verificação devolvido pelo backend.
 */
function renderGate(viewElement, status) {
  const verification = status.verification;
  const info = statusInfo(verification.status);
  const isMinor = status.age !== null && status.age < 18;
  const providerDisabled = verification.providerMode === 'disabled';
  const canSubmit = !isMinor && !providerDisabled && ['not_started', 'rejected', 'needs_review', 'expired'].includes(verification.status);
  const waiting = verification.status === 'in_review';
  const devApprove = waiting && verification.providerMode === 'dev';

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);
  const prefillBirth = state.me && state.me.birthDate ? state.me.birthDate : '';

  viewElement.innerHTML = `
    <div class="page page-narrow dating-gate">
      <header class="dating-gate-hero">
        <span class="dating-mark large" aria-hidden="true">${icon('spark', 30)}</span>
        <p class="eyebrow">Namoro · 18+</p>
        <h1>Um espaço separado para adultos verificados.</h1>
        <p>O Namoro só é liberado depois da aprovação da verificação de identidade e idade. O perfil social continua funcionando normalmente, sem depender desta etapa.</p>
        ${simulationBadge()}
      </header>

      <section class="gate-status-card ${verification.status}">
        <div class="gate-status-head">
          <span class="gate-status-icon">${icon(verification.status === 'approved' ? 'shield' : 'lock', 22)}</span>
          <div>
            <p class="eyebrow">Seu estado</p>
            <h2>${esc(info.label)}</h2>
            <p>${esc(info.text)}</p>
          </div>
          <span class="status-dot ${esc(verification.status)}" aria-hidden="true"></span>
        </div>
        ${verification.note ? `<p class="gate-reason">${icon('info', 15)} ${esc(verification.note)}</p>` : ''}
        ${verification.status === 'in_review' ? `
          <div class="gate-progress">
            <span class="done"></span><span class="done"></span><span class="active"></span><span></span>
          </div>` : ''}
      </section>

      ${isMinor ? `
        <section class="gate-notice danger">
          ${icon('shield', 20)}
          <div>
            <h3>O Namoro é exclusivo para maiores de 18 anos</h3>
            <p>Sua data de nascimento indica ${status.age === null ? 'idade não confirmada' : `${status.age} anos`}. O acesso a perfis românticos, matches e Radar permanece bloqueado.</p>
          </div>
        </section>` : ''}

      ${providerDisabled ? `
        <section class="gate-notice">
          ${icon('settings', 20)}
          <div>
            <h3>Verificação não configurada</h3>
            <p>Este ambiente não tem um provedor de verificação ativo nem o modo de desenvolvimento. Configure <code>IDENTITY_PROVIDER</code> e <code>IDENTITY_WEBHOOK_SECRET</code> para produção.</p>
          </div>
        </section>` : ''}

      ${waiting && !devApprove ? `
        <section class="gate-notice">
          ${icon('info', 20)}
          <div>
            <h3>Aguardando o resultado</h3>
            <p>A verificação foi enviada ao provedor. Esta tela será atualizada quando o resultado chegar por webhook assinado. Nenhuma aprovação é automática em produção.</p>
          </div>
        </section>` : ''}

      ${devApprove ? `
        <section class="dev-simulation">
          <div class="dev-simulation-head">${icon('alert', 18)} <strong>Modo de desenvolvimento — simulação explícita</strong></div>
          <p>Nenhum documento foi analisado e nenhuma verificação real aconteceu. Este botão aprova a simulação local para permitir testar o Namoro. Ele não existe quando o provedor real está configurado.</p>
          <button type="button" class="btn primary" data-action="dating-dev-approve">Aprovar verificação simulada</button>
        </section>` : ''}

      ${canSubmit ? `
        <form id="dating-verify-form" class="gate-form">
          <div class="gate-form-head">
            <h2>${verification.status === 'not_started' ? 'Iniciar verificação' : 'Enviar novamente'}</h2>
            <p>Em produção, estes dados seriam enviados ao provedor de identidade por um canal seguro. Não armazenamos documentos ou selfies neste projeto local.</p>
          </div>
          <label class="field">
            <span>Nome completo</span>
            <input name="fullName" type="text" value="${esc(state.me.name)}" minlength="5" maxlength="120" autocomplete="name" placeholder="Nome e sobrenome" required />
          </label>
          <label class="field">
            <span>Data de nascimento</span>
            <input name="birthDate" type="date" value="${esc(prefillBirth)}" max="${maxDate.toISOString().slice(0, 10)}" ${state.me.birthDate ? 'readonly' : ''} required />
            <small class="field-hint">${state.me.birthDate
              ? 'A data já registrada na conta não pode ser alterada pela verificação. Fale com o suporte se estiver incorreta.'
              : 'Usada para confirmar que você tem 18 anos ou mais. A idade não aparece no perfil social.'}</small>
          </label>
          <label class="consent-check">
            <input type="checkbox" name="consent" required />
            <span>Autorizo a verificação de idade e identidade para liberar o Namoro. Entendo que a verificação não garante a confiabilidade de outras pessoas.</span>
          </label>
          <div class="gate-form-actions">
            <button type="submit" class="btn primary">${icon('shield', 16)} Iniciar verificação</button>
            <button type="button" class="btn ghost" data-action="nav" data-view="home">Voltar ao início</button>
          </div>
          <p class="muted small">${verification.providerMode === 'dev'
            ? 'Ambiente local: o resultado será tratado como simulação e ficará identificado como tal em todo o aplicativo.'
            : 'O resultado chega por webhook assinado. A aprovação depende do provedor e da idade mínima.'}</p>
        </form>` : ''}
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Descobrir                                                          */
/* ------------------------------------------------------------------ */

function onboardingCard(status, reason = '') {
  const quiz = status.quiz || { answered: 0, total: 10, requiredAnswered: 0, requiredTotal: 5, complete: false };
  const hasProfile = !!status.profile;
  return `<section class="dating-onboarding">
    <div class="onboarding-icon">${icon('spark', 30)}</div>
    <p class="eyebrow">Antes de descobrir</p>
    <h2>${reason === 'quiz' ? 'Conclua seu questionário' : 'Prepare seu perfil de namoro'}</h2>
    <p>O Namoro usa um perfil separado do social. Escolha suas fotos, escreva uma bio curta e responda ao questionário de afinidade. Você pode salvar parcialmente e voltar depois.</p>
    <div class="onboarding-progress">
      <div class="onboarding-step ${hasProfile ? 'done' : ''}">
        <span>${icon(hasProfile ? 'check' : 'user', 17)}</span>
        <strong>Perfil de namoro</strong>
        <small>${hasProfile ? 'Criado' : 'Bio, fotos e preferências'}</small>
      </div>
      <div class="onboarding-step ${quiz.complete ? 'done' : ''}">
        <span>${icon(quiz.complete ? 'check' : 'sliders', 17)}</span>
        <strong>Questionário</strong>
        <small>${quiz.answered} de ${quiz.total} respondidas</small>
      </div>
    </div>
    <div class="onboarding-actions">
      <button type="button" class="btn primary" data-action="dating-tab" data-tab="profile">${hasProfile ? 'Continuar configuração' : 'Criar perfil de namoro'}</button>
      <button type="button" class="btn ghost" data-action="dating-tab" data-tab="matches">Ver matches</button>
    </div>
    ${reason === 'paused' ? `<p class="onboarding-note">${icon('pause', 15)} Seu perfil está pausado. Reative em "Meu perfil" para voltar a aparecer nas recomendações.</p>` : ''}
  </section>`;
}

/**
 * Renderiza a aba "Descobrir" com perfis recomendados.
 *
 * Exibe o onboarding se o perfil não estiver completo ou o questionário requerido.
 * Caso contrário, faz a chamada API `/api/dating/discover` e monta a grade de cards.
 *
 * @param {HTMLElement} container Elemento onde a lista será montada.
 * @param {object} status Estado atual de namoro.
 */
export async function renderDiscover(container, status) {
  if (!status.profileComplete) {
    container.innerHTML = onboardingCard(status, status.profile && status.profile.paused ? 'paused' : '');
    return;
  }
  container.innerHTML = `<div class="dating-loading">${icon('compass', 24)}<span>Buscando afinidades...</span></div>`;
  let data;
  try {
    data = await api('/api/dating/discover?limit=18');
  } catch (error) {
    if (error.code === 'quiz_required') {
      container.innerHTML = onboardingCard(status, 'quiz');
      return;
    }
    if (error.code === 'profile_paused') {
      container.innerHTML = onboardingCard(status, 'paused');
      return;
    }
    if (error.code === 'profile_required') {
      container.innerHTML = onboardingCard(status);
      return;
    }
    throw error;
  }
  state.dating.discover = data;
  const filters = data.filters;
  container.innerHTML = `
    <section class="dating-filterbar">
      <div class="dating-filter-summary">
        <span>${icon('sliders', 15)} Idade ${filters.ageMin}–${filters.ageMax}</span>
        <span>${icon('mapPin', 15)} até ${filters.distanceKm} km</span>
        <span>${icon('users', 15)} ${data.total} ${data.total === 1 ? 'perfil encontrado' : 'perfis encontrados'}</span>
      </div>
      <div class="dating-filter-actions">
        <button type="button" class="btn ghost small" data-action="dating-tab" data-tab="profile">Ajustar preferências</button>
        <button type="button" class="btn ghost small" data-action="dating-reload" aria-label="Atualizar recomendações">${icon('compass', 15)} Atualizar</button>
      </div>
    </section>
    ${data.profiles.length
      ? `<div class="dating-grid">${data.profiles.map((profile) => datingCard(profile)).join('')}</div>`
      : `<div class="dating-empty">
          <div class="empty-icon">${icon('compass', 30)}</div>
          <h3>Sem novas recomendações agora</h3>
          <p>Você já viu os perfis dentro das suas preferências. Ampliar a distância ou a faixa etária pode ajudar, sem quebrar seus limites de privacidade.</p>
          <div class="dating-empty-actions">
            <button type="button" class="btn primary" data-action="dating-tab" data-tab="profile">Ajustar preferências</button>
            <button type="button" class="btn ghost" data-action="dating-reload">Atualizar</button>
          </div>
        </div>`}
    <p class="dating-score-note">${icon('info', 14)} ${esc(data.scoring.note)} O percentual é uma estimativa declarada, não uma medida científica.</p>`;
  hydrateIcons(container);
}

/**
 * Renderiza um card de candidato em Descobrir.
 *
 * Mostra foto, idade, interesses em comum e barra de afinidade estimada.
 * Não representa um match confirmado; a reciprocidade só existe após o like.
 *
 * @param {object} profile Candidato retornado por `/api/dating/discover`.
 * @returns {string} Markup HTML do card.
 */
function datingCard(profile) {
  const photo = profile.photos && profile.photos.length ? profile.photos[0] : null;
  const age = profile.age ? `${profile.age} anos` : '';
  const score = Number(profile.score) || 0;
  return `
    <article class="dating-card" data-dating-card="${esc(profile.user.username)}">
      <div class="dating-photo">
        ${photo
          ? `<img src="${esc(photo)}" alt="Foto de ${esc(profile.user.name)}" loading="lazy" />`
          : avatar(profile.user, 220, 'dating-photo-fallback')}
        <span class="dating-score"><strong>${score}%</strong><small>afinidade estimada</small></span>
        ${profile.distanceKnown
          ? `<span class="dating-distance">${icon('mapPin', 13)} ${esc(profile.distanceLabel)}</span>`
          : `<span class="dating-distance muted" title="A distância só é compartilhada entre matches com consentimento no Radar.">${icon('lock', 13)} distância privada até o match</span>`}
      </div>
      <div class="dating-card-body">
        <div class="dating-card-title">
          <h2>${esc(profile.user.name)}${age ? `, ${esc(String(profile.age))}` : ''}</h2>
          <button type="button" class="inline-user" data-action="dating-open-profile" data-username="${esc(profile.user.username)}">@${esc(profile.user.username)}</button>
        </div>
        <p class="dating-bio">${esc(profile.bio || 'Sem bio por aqui.')}</p>
        ${profile.sharedInterests && profile.sharedInterests.length ? `
          <div class="dating-shared">
            <p class="eyebrow">Em comum</p>
            <div class="chips">${profile.sharedInterests.map((label) => `<span class="chip chip-shared">${esc(label)}</span>`).join('')}</div>
          </div>` : ''}
        <div class="dating-reasons">
          ${(profile.reasons || []).slice(0, 4).map((reason) => `<p>${icon('check', 13)} ${esc(reason)}</p>`).join('')}
        </div>
        <div class="dating-card-actions">
          <button type="button" class="btn ghost dating-pass" data-action="dating-pass" data-username="${esc(profile.user.username)}" aria-label="Passar">
            ${icon('close', 19)} Passar
          </button>
          <button type="button" class="btn primary dating-like" data-action="dating-like" data-username="${esc(profile.user.username)}" aria-label="Curtir">
            ${icon('heart', 19)} Curtir
          </button>
        </div>
      </div>
    </article>`;
}

/* ------------------------------------------------------------------ */
/* Matches                                                            */
/* ------------------------------------------------------------------ */

/**
 * Exibe a aba "Matches" mostrando os matches confirmados.
 *
 * @param {HTMLElement} container Elemento onde os cards serão montados.
 */
export async function renderMatchesTab(container) {
  container.innerHTML = `<div class="dating-loading">${icon('heart', 24)}<span>Carregando matches...</span></div>`;
  const data = await api('/api/dating/matches');
  state.dating.matches = data;
  container.innerHTML = data.matches.length
    ? `<div class="match-list">${data.matches.map(matchCard).join('')}</div>`
    : `<div class="dating-empty">
        <div class="empty-icon">${icon('heart', 30)}</div>
        <h3>Nenhum match ainda</h3>
        <p>Um match só aparece quando existe interesse mútuo. Continue explorando com calma; ninguém vê quem você curtiu antes de haver reciprocidade.</p>
        <button type="button" class="btn primary" data-action="dating-tab" data-tab="discover">Descobrir pessoas</button>
      </div>`;
  hydrateIcons(container);
}

/**
 * Renderiza um card de match confirmado.
 *
 * Diferente de `datingCard`, exibe ações de conversa, Radar, denúncia, bloqueio e
 * desfazimento porque existe reciprocidade entre as duas pessoas.
 *
 * @param {object} match Match confirmado.
 * @returns {string} Markup HTML do card.
 */
function matchCard(match) {
  const photo = match.profile && match.profile.photos && match.profile.photos.length
    ? match.profile.photos[0]
    : null;
  const radar = match.radar || {};
  const radarLabel = radar.available
    ? radar.distanceLabel
    : radar.bothConsent
      ? 'Distância indisponível'
      : 'Radar não compartilhado';
  return `
    <article class="match-card" data-match-card="${match.id}">
      <div class="match-photo">
        ${photo
          ? `<img src="${esc(photo)}" alt="Foto de ${esc(match.user.name)}" loading="lazy" />`
          : avatar(match.user, 150, 'match-photo-fallback')}
      </div>
      <div class="match-body">
        <div class="match-head">
          <div>
            <h2>${esc(match.user.name)}${match.age ? `, ${match.age}` : ''}</h2>
            <button type="button" class="inline-user" data-action="dating-open-profile" data-username="${esc(match.user.username)}">@${esc(match.user.username)}</button>
          </div>
          <span class="match-date">${longDate(match.createdAt)}</span>
        </div>
        ${interestChips(match.profile ? match.profile.interests : [])}
        <p class="match-radar ${radar.available ? 'on' : ''}">${icon('radar', 15)} ${esc(radarLabel)}</p>
        <div class="match-actions">
          ${match.conversationId ? `<button type="button" class="btn primary small" data-action="dating-chat" data-conversation="${match.conversationId}">${icon('message', 15)} Conversar</button>` : ''}
          <button type="button" class="btn ghost small" data-action="dating-tab" data-tab="radar">${icon('radar', 15)} Radar</button>
          <button type="button" class="btn ghost small" data-action="dating-report" data-id="${match.user.id}" data-username="${esc(match.user.username)}">${icon('flag', 15)} Denunciar</button>
          <button type="button" class="btn ghost small danger-text" data-action="dating-block" data-username="${esc(match.user.username)}">${icon('ban', 15)} Bloquear</button>
          <button type="button" class="btn ghost small danger-text" data-action="dating-unmatch" data-id="${match.id}">${icon('close', 15)} Desfazer match</button>
        </div>
      </div>
    </article>`;
}

/* ------------------------------------------------------------------ */
/* Ações                                                              */
/* ------------------------------------------------------------------ */

/**
 * Remove um card de candidato da grade após uma ação.
 *
 * @param {string} username Usuário do candidato.
 */
function removeDatingCard(username) {
  const card = $(`[data-dating-card="${window.CSS && CSS.escape ? CSS.escape(username) : username}"]`);
  if (card) card.remove();
  const grid = $('.dating-grid');
  if (grid && !grid.querySelector('.dating-card')) {
    const content = $('#dating-tab-content');
    if (content) {
      content.insertAdjacentHTML('beforeend', `<div class="dating-empty compact">
        <div class="empty-icon">${icon('spark', 28)}</div>
        <h3>Você viu todas as recomendações deste ciclo</h3>
        <p>Volte mais tarde ou ajuste suas preferências.</p>
        <div class="dating-empty-actions">
          <button type="button" class="btn ghost" data-action="dating-reload">Atualizar</button>
          <button type="button" class="btn ghost" data-action="dating-tab" data-tab="profile">Ajustar preferências</button>
        </div>
      </div>`);
      hydrateIcons(content);
    }
  }
}

/**
 * Localiza um candidato na lista de descoberta carregada no estado.
 *
 * @param {string} username Nome de usuário do candidato.
 * @returns {object|undefined} Perfil encontrado, se houver.
 */
function findProfile(username) {
  return (state.dating.discover?.profiles || []).find(
    (profile) => profile.user.username.toLowerCase() === username.toLowerCase()
  );
}

/**
 * Registra like ou pass em um candidato.
 *
 * Um like pode gerar match implícito quando a outra pessoa também demonstrou
 * interesse; nesse caso a modal de match é exibida.
 *
 * @param {string} username Nome de usuário do candidato.
 * @param {'like'|'pass'} action Ação escolhida.
 */
async function datingInterest(username, action) {
  const profile = findProfile(username);
  const card = $(`[data-dating-card="${window.CSS && CSS.escape ? CSS.escape(username) : username}"]`);
  if (card) {
    $$('button', card).forEach((button) => {
      button.disabled = true;
    });
  }
  try {
    const data = await api(`/api/dating/likes/${encodeURIComponent(username)}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    removeDatingCard(username);
    if (data.matched) {
      openMatchModal(data.match, profile);
    } else {
      toast(action === 'like' ? 'Interesse registrado. Só aparece se houver reciprocidade.' : 'Perfil passado.', action === 'like' ? '' : '');
    }
  } catch (error) {
    if (card) {
      $$('button', card).forEach((button) => {
        button.disabled = false;
      });
    }
    throw error;
  }
}

/**
 * Exibe a modal quando o match é confirmado.
 *
 * @param {object} match Dados do match.
 * @param {object} profile Dados do perfil do match.
 */
function openMatchModal(match, profile) {
  const name = profile ? profile.user.name : 'Você';
  const photo = profile ? (profile.photos[0] || profile.user.avatar) : null;
  const modal = openModal(`
    <div class="match-modal">
      <span class="match-modal-mark">${icon('spark', 30)}</span>
      <p class="eyebrow">Interesse mútuo</p>
      <h2>Vocês deram match.</h2>
      <p>${esc(name === 'Você' ? 'O interesse foi mútuo.' : `${esc(name)} também demonstrou interesse.`)} A conversa de match está disponível. O Radar continua desligado até cada pessoa autorizar separadamente.</p>
      <div class="match-modal-avatar">
        ${photo ? `<img src="${esc(photo)}" alt="" />` : avatar(profile ? profile.user : state.me, 74)}
      </div>
      <div class="match-modal-actions">
        <button type="button" class="btn primary" data-match-chat="${match.conversationId}">${icon('message', 16)} Conversar</button>
        <button type="button" class="btn ghost" data-action="close-modal">Continuar explorando</button>
      </div>
      <small>A conversa é exclusiva do match. Se o match for desfeito ou houver bloqueio, o envio é interrompido.</small>
    </div>`, 'match-modal-wrap');
  modal.querySelector('[data-match-chat]').addEventListener('click', () => {
    closeModal();
    navigate('messages', { conversation: Number(match.conversationId) });
  });
}

/**
 * Desfaz um match após confirmação explícita.
 *
 * Encerrar o match impede novas mensagens na conversa e cancela o compartilhamento
 * de Radar; o histórico da conversa é preservado.
 *
 * @param {number} matchId ID do match.
 */
async function unmatch(matchId) {
  const confirmed = await confirmDialog({
    title: 'Desfazer este match?',
    body: 'A conversa deixa de aceitar novas mensagens e o compartilhamento de Radar deste match é encerrado. O histórico não é apagado automaticamente.',
    confirmLabel: 'Desfazer match',
    danger: true,
  });
  if (!confirmed) return;
  await api(`/api/dating/matches/${matchId}`, { method: 'DELETE' });
  toast('Match desfeito.');
  await navigate('dating', { tab: 'matches' });
}

export async function handleAction(action, target) {
  if (await handleProfileAction(action, target)) return true;

  if (action === 'dating-tab') {
    state.dating.tab = target.dataset.tab || 'discover';
    await navigate('dating', { tab: state.dating.tab });
    return true;
  }
  if (action === 'dating-reload') {
    await navigate('dating', { tab: state.dating.tab });
    return true;
  }
  if (action === 'dating-dev-approve') {
    setBusy(target, true);
    try {
      const data = await api('/api/dating/verification/dev-approve', { method: 'POST' });
      toast(data.warning || 'Aprovação simulada registrada.');
      await navigate('dating', { tab: 'discover' });
    } finally {
      setBusy(target, false);
    }
    return true;
  }
  if (action === 'dating-like') {
    await datingInterest(target.dataset.username, 'like');
    return true;
  }
  if (action === 'dating-pass') {
    await datingInterest(target.dataset.username, 'pass');
    return true;
  }
  if (action === 'dating-open-profile') {
    await navigate('profile', { username: target.dataset.username });
    return true;
  }
  if (action === 'dating-chat') {
    await navigate('messages', { conversation: Number(target.dataset.conversation) });
    return true;
  }
  if (action === 'dating-unmatch') {
    await unmatch(Number(target.dataset.id));
    return true;
  }
  if (action === 'dating-report') {
    openReportModal({ targetType: 'user', targetId: Number(target.dataset.id), label: 'perfil' });
    return true;
  }
  if (action === 'dating-block') {
    const blocked = await blockUser(target.dataset.username);
    if (blocked) await navigate('dating', { tab: state.dating.tab });
    return true;
  }
  return false;
}

export async function handleSubmit(form, event) {
  if (await handleProfileSubmit(form, event)) return true;
  if (form.id !== 'dating-verify-form') return false;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const birthDate = String(data.get('birthDate') || '');
  const consent = data.get('consent') === 'on';
  if (!consent) {
    toast('É necessário autorizar a verificação.', 'error');
    return true;
  }
  setBusy(button, true);
  try {
    const result = await api('/api/dating/verification', {
      method: 'POST',
      body: JSON.stringify({
        fullName: String(data.get('fullName') || '').trim(),
        birthDate,
        consent: true,
      }),
    });
    state.me.birthDate = birthDate;
    toast(result.simulation
      ? 'Verificação registrada em modo de simulação. Nenhum dado real foi analisado.'
      : 'Verificação enviada. Aguarde o resultado do provedor.');
    await navigate('dating', { tab: 'discover' });
  } finally {
    setBusy(button, false);
  }
  return true;
}
