/* Vibra - página de configurações. */
/*
 * @module settings
 *
 * Página `/settings` com as categorias de administração da conta:
 *
 *  - Conta: nome, usuário (somente leitura), bio, data de nascimento e tema.
 *  - Privacidade: perfil público/privado, política de mensagens, pessoas
 *    bloqueadas e melhores amigos.
 *  - Notificações: ajuste de leitura e acesso à central de notificações.
 *  - Segurança: dispositivos conectados, solicitações de seguimento e troca
 *    de senha.
 *  - Suporte: relato de problema, versão do aplicativo e ajuda.
 *
 * Contrato de `handleSubmit(form, event)`: recebe o formulário identificado
 * por `form.id` e o evento de submissão, vindos da delegação em main.js.
 *
 * Dependências:
 *  - core.js: estado global, API, ícones, escape, tema e avisos.
 */

import {
  $,
  state,
  icon,
  hydrateIcons,
  esc,
  api,
  toast,
  setBusy,
  applyTheme,
  refreshNavAvatar,
} from './core.js';

/**
 * Carrega a lista de dispositivos conectados e monta a linha de cada um.
 *
 * @returns {Promise<void>}
 */
async function paintSessions() {
  const container = $('#settings-sessions');
  const title = $('#settings-sessions-title');
  if (!container) return;
  container.innerHTML = '<p class="muted-note">Carregando dispositivos…</p>';
  try {
    const data = await api('/api/sessions');
    const sessions = data.sessions || [];
    if (title) {
      title.textContent = sessions.length
        ? `Dispositivos conectados (${sessions.length})`
        : 'Dispositivos conectados';
    }
    if (!sessions.length) {
      container.innerHTML = '<p class="muted-note">Nenhum dispositivo conectado encontrado.</p>';
      return;
    }
    container.innerHTML = sessions.map((session) => {
      const startedAt = session.createdAt
        ? new Date(session.createdAt).toLocaleString('pt-BR')
        : '';
      const detail = session.current
        ? `Esta sessão${startedAt ? ` · iniciada em ${startedAt}` : ''}`
        : `${startedAt ? `Iniciada em ${startedAt}` : 'Sessão ativa em outro dispositivo'}`;
      return `
      <article class="settings-row settings-row--session">
        <span class="settings-session-icon" aria-hidden="true">${icon('device', 18)}</span>
        <div>
          <strong>${esc(session.device)}</strong>
          <small>${esc(detail)}</small>
        </div>
        ${session.current
          ? '<span class="settings-tag">Atual</span>'
          : `<button type="button" class="btn ghost small" data-action="revoke-session" data-id="${esc(session.id)}">Encerrar</button>`}
      </article>`;
    }).join('');
    hydrateIcons(container);
  } catch (error) {
    container.innerHTML = `<p class="muted-note">${esc(error.message || 'Não foi possível carregar os dispositivos.')}</p>`;
  }
}

/**
 * Monta a página de configurações.
 *
 * @param {HTMLElement} viewElement Elemento onde a view é renderizada.
 * @returns {Promise<void>}
 */
export async function renderSettings(viewElement) {
  const me = state.me;
  if (!me) return;
  const policy = me.messagePolicy || 'connections';
  const isPrivate = !!me.isPrivate;
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const version = state.config.app.version || '';
  const pendingRequests = Number(me.pendingFollowRequests) || 0;

  viewElement.innerHTML = `
    <div class="page page-narrow settings-page">
      <header class="page-head">
        <h1>Configurações</h1>
        <p>Ajuste sua conta, sua privacidade e como o Vibra funciona para você.</p>
      </header>

      <section class="settings-section" aria-labelledby="settings-account-title">
        <div class="settings-section-head">
          <span class="settings-section-icon">${icon('user', 20)}</span>
          <div>
            <h2 id="settings-account-title">Conta</h2>
            <p>Seus dados e a aparência do aplicativo.</p>
          </div>
        </div>
        <form id="settings-account-form" class="settings-form">
          <label class="field">
            <span>Nome</span>
            <input name="name" type="text" value="${esc(me.name)}" maxlength="40" required />
          </label>
          <label class="field">
            <span>Usuário</span>
            <input type="text" value="@${esc(me.username)}" disabled aria-describedby="settings-username-hint" />
            <small class="field-hint" id="settings-username-hint">O usuário não pode ser alterado.</small>
          </label>
          <label class="field">
            <span>Bio</span>
            <textarea name="bio" rows="3" maxlength="150" placeholder="Conte um pouco sobre você">${esc(me.bio)}</textarea>
            <small class="field-hint">${(me.bio || '').length}/150 caracteres.</small>
          </label>
          ${!me.birthDate ? `
            <label class="field">
              <span>Data de nascimento</span>
              <input name="birthDate" type="date" required />
              <small class="field-hint">Necessária para a idade mínima da plataforma.</small>
            </label>` : ''}
          <label class="field">
            <span>Aparência</span>
            <select name="theme">
              <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Tema escuro</option>
              <option value="light" ${theme === 'light' ? 'selected' : ''}>Tema claro</option>
            </select>
          </label>
          <div class="modal-actions">
            <button type="submit" class="btn primary">Salvar conta</button>
          </div>
        </form>
      </section>

      <section class="settings-section" aria-labelledby="settings-privacy-title">
        <div class="settings-section-head">
          <span class="settings-section-icon">${icon('shield', 20)}</span>
          <div>
            <h2 id="settings-privacy-title">Privacidade</h2>
            <p>Controle quem vê seu conteúdo e com quem você conversa.</p>
          </div>
        </div>
        <form id="settings-privacy-form" class="settings-form">
          <div class="switch-list profile-private-switch">
            <label class="switch-row">
              <span>
                <strong>Perfil privado</strong>
                <small>Quem quiser seguir você precisa enviar uma solicitação. Você aceita ou recusa, e só seguidores aprovados veem suas publicações e stories.</small>
              </span>
              <span class="switch">
                <input type="checkbox" name="isPrivate" ${isPrivate ? 'checked' : ''} />
                <i></i>
              </span>
            </label>
          </div>
          <label class="field">
            <span>Quem pode enviar mensagens</span>
            <select name="messagePolicy">
              <option value="connections" ${policy === 'connections' ? 'selected' : ''}>Pessoas que eu sigo de volta</option>
              <option value="everyone" ${policy === 'everyone' ? 'selected' : ''}>Qualquer pessoa</option>
              <option value="nobody" ${policy === 'nobody' ? 'selected' : ''}>Ninguém</option>
            </select>
          </label>
          <div class="modal-actions">
            <button type="submit" class="btn primary">Salvar privacidade</button>
          </div>
        </form>
        <div class="settings-list">
          <article class="settings-row">
            <div>
              <strong>Melhores amigos</strong>
              <small>Escolha quem vê seus stories exclusivos.</small>
            </div>
            <button type="button" class="btn ghost small" data-action="close-friends">${icon('users', 15)} Gerenciar</button>
          </article>
          <article class="settings-row">
            <div>
              <strong>Pessoas bloqueadas</strong>
              <small>Bloqueie ou desbloqueie quem você não quer ver por perto.</small>
            </div>
            <button type="button" class="btn ghost small" data-action="blocked-users">${icon('ban', 15)} Gerenciar</button>
          </article>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="settings-notifications-title">
        <div class="settings-section-head">
          <span class="settings-section-icon">${icon('bell', 20)}</span>
          <div>
            <h2 id="settings-notifications-title">Notificações</h2>
            <p>Acompanhe likes, comentários, seguidores, stories e matches.</p>
          </div>
        </div>
        <div class="settings-list">
          <article class="settings-row">
            <div>
              <strong>Central de notificações</strong>
              <small>${state.unreadNotifications > 0 ? `${state.unreadNotifications} ${state.unreadNotifications === 1 ? 'notificação não lida' : 'notificações não lidas'}.` : 'Tudo lido por aqui.'}</small>
            </div>
            <button type="button" class="btn ghost small" data-action="open-notifications">${icon('bell', 15)} Abrir</button>
          </article>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="settings-security-title">
        <div class="settings-section-head">
          <span class="settings-section-icon">${icon('lock', 20)}</span>
          <div>
            <h2 id="settings-security-title">Segurança</h2>
            <p>Sessões abertas e a sua senha de acesso.</p>
          </div>
        </div>
        <h3 class="settings-subtitle" id="settings-sessions-title">Dispositivos conectados</h3>
        <div class="settings-list" id="settings-sessions" aria-live="polite">
          <p class="muted-note">Carregando dispositivos…</p>
        </div>
        <div class="settings-list">
          <article class="settings-row">
            <div>
              <strong>Solicitações</strong>
              <small>${pendingRequests > 0 ? `${pendingRequests} ${pendingRequests === 1 ? 'pedido aguardando' : 'pedidos aguardando'}.` : 'Nenhum pedido aguardando resposta.'}</small>
            </div>
            <button type="button" class="btn ghost small" data-action="follow-requests">${icon('users', 15)} Abrir</button>
          </article>
        </div>
        <form id="settings-password-form" class="settings-form settings-form--block">
          <h3 class="settings-subtitle">Trocar senha</h3>
          <label class="field">
            <span>Senha atual</span>
            <input name="currentPassword" type="password" autocomplete="current-password" minlength="6" required />
          </label>
          <label class="field">
            <span>Nova senha</span>
            <input name="newPassword" type="password" autocomplete="new-password" minlength="6" required />
            <small class="field-hint">Ao trocar a senha, as outras sessões são encerradas.</small>
          </label>
          <div class="modal-actions">
            <button type="submit" class="btn primary">Atualizar senha</button>
          </div>
        </form>
      </section>

      <section class="settings-section" aria-labelledby="settings-support-title">
        <div class="settings-section-head">
          <span class="settings-section-icon">${icon('alert', 20)}</span>
          <div>
            <h2 id="settings-support-title">Suporte</h2>
            <p>Encontre ajuda ou avise a equipe sobre algum problema.</p>
          </div>
        </div>
        <div class="settings-list">
          <article class="settings-row">
            <div>
              <strong>Relatar um problema</strong>
              <small>Envie um relato privado para a equipe investigar.</small>
            </div>
            <button type="button" class="btn ghost small" data-action="report-problem">${icon('alert', 15)} Relatar</button>
          </article>
          <article class="settings-row">
            <div>
              <strong>Versão do aplicativo</strong>
              <small>${version ? `Vibra ${esc(version)}` : 'Vibra'}</small>
            </div>
            <span class="settings-tag">${esc(version || '—')}</span>
          </article>
        </div>
      </section>
    </div>`;

  hydrateIcons(viewElement);

  /* Contador de caracteres da bio. */
  // Bio character counter – updates the existing <small> element.
  const bioInput = $('textarea[name="bio"]', viewElement);
  if (bioInput) {
    const updateBioCounter = () => {
      const counter = bioInput.parentNode.querySelector('.field-hint');
      if (counter) counter.textContent = `${bioInput.value.length}/150 caracteres.`;
    };
    bioInput.addEventListener('input', updateBioCounter);
    updateBioCounter();
  }

  await paintSessions();
}

/**
 * Processa os formulários da página de configurações.
 *
 * @param {HTMLFormElement} form Formulário submetido.
 * @param {Event} event Evento de submissão.
 * @returns {Promise<boolean>} `true` quando o formulário foi tratado aqui.
 */
export async function handleSubmit(form, event) {
  if (form.id === 'settings-account-form') {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    /* O formulário edita apenas nome e bio: foto, capa e interesses nunca
       são enviados, portanto não são sobrescritos no banco. */
    const payload = {
      name: String(data.get('name') || '').trim(),
      bio: String(data.get('bio') || '').trim(),
    };
    if (!state.me.birthDate && data.get('birthDate')) {
      payload.birthDate = String(data.get('birthDate'));
    }
    setBusy(button, true);
    try {
      const result = await api('/api/me', { method: 'PATCH', body: JSON.stringify(payload) });
      state.me = result.user;
      state.stats = result.stats;
      state.me.pendingFollowRequests = Number.isFinite(result.pendingFollowRequests)
        ? result.pendingFollowRequests
        : 0;
      state.me.badges = Array.isArray(result.badges) ? result.badges : [];
      refreshNavAvatar();
      applyTheme(String(data.get('theme') || 'light'));
      toast('Conta atualizada.');
    } catch (error) {
      toast(error.message || 'Não foi possível salvar a conta.', 'error');
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  if (form.id === 'settings-privacy-form') {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const wasPrivate = !!state.me.isPrivate;
    const pendingBefore = Number(state.me.pendingFollowRequests) || 0;
    setBusy(button, true);
    try {
      const result = await api('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({
          messagePolicy: String(data.get('messagePolicy') || 'connections'),
          isPrivate: data.get('isPrivate') !== null,
        }),
      });
      state.me = result.user;
      state.stats = result.stats;
      state.me.pendingFollowRequests = Number.isFinite(result.pendingFollowRequests)
        ? result.pendingFollowRequests
        : 0;
      state.me.badges = Array.isArray(result.badges) ? result.badges : [];
      refreshNavAvatar();
      if (wasPrivate && !state.me.isPrivate && pendingBefore > 0) {
        toast(`Perfil público. ${pendingBefore} ${pendingBefore === 1 ? 'solicitação foi aceita' : 'solicitações foram aceitas'}.`);
      } else {
        toast('Privacidade atualizada.');
      }
    } catch (error) {
      toast(error.message || 'Não foi possível salvar a privacidade.', 'error');
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  if (form.id === 'settings-password-form') {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    setBusy(button, true);
    try {
      await api('/api/me/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: String(data.get('currentPassword') || ''),
          newPassword: String(data.get('newPassword') || ''),
        }),
      });
      form.reset();
      toast('Senha atualizada. As outras sessões foram encerradas.');
      await paintSessions();
    } catch (error) {
      toast(error.message || 'Não foi possível atualizar a senha.', 'error');
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  return false;
}

/**
 * Ações exclusivas da página de configurações.
 *
 * As demais ações da página (`blocked-users`, `close-friends`,
 * `follow-requests`, `report-problem` e `open-notifications`) são tratadas
 * pelos módulos já existentes, mantendo o fluxo único.
 *
 * @param {string} action Nome da ação.
 * @param {HTMLElement} target Elemento que originou a ação.
 * @returns {Promise<boolean>} `true` quando a ação foi tratada aqui.
 */
export async function handleAction(action, target) {
  if (action === 'revoke-session') {
    const id = target.dataset.id;
    if (!id) return true;
    const button = target;
    setBusy(button, true);
    try {
      await api(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast('Sessão encerrada.');
      await paintSessions();
    } catch (error) {
      toast(error.message || 'Não foi possível encerrar a sessão.', 'error');
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  return false;
}
