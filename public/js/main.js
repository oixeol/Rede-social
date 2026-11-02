/* Vibra - ponto de entrada do cliente. */

import {
  $,
  $$,
  state,
  icon,
  hydrateIcons,
  esc,
  api,
  toast,
  setBusy,
  initTheme,
  applyTheme,
  toggleTheme,
  setAuthTab,
  showAuth,
  refreshNavAvatar,
  refreshBadges,
  setUnread,
  loadConfig,
  enterApp,
  navigate,
  registerView,
  closeModal,
  openProfileMenu,
  closeProfileMenu,
  isProfileMenuOpen,
} from './core.js';
import { renderHome, renderExplore, renderProfile, closeStories } from './social.js';
import {
  handleAction as handleSocialAction,
  handleSubmit as handleSocialSubmit,
  openNotifications,
  openFollowRequests,
} from './social-actions.js';
import {
  renderMessages,
  handleAction as handleMessagesAction,
  handleSubmit as handleMessagesSubmit,
} from './messages.js';
import {
  renderDating,
  handleAction as handleDatingAction,
  handleSubmit as handleDatingSubmit,
} from './dating.js';
import {
  openProblemReportModal,
  handleSubmit as handleAccountSubmit,
} from './account-menu.js';
import { renderSettings, handleAction as handleSettingsAction, handleSubmit as handleSettingsSubmit } from './settings.js';

/* ------------------------------------------------------------------ */
/* Sessão                                                             */
/* ------------------------------------------------------------------ */

function hydrateSession(data) {
  state.me = data.user;
  state.me.pendingFollowRequests = Number(data.pendingFollowRequests) || 0;
  state.me.badges = Array.isArray(data.badges) ? data.badges : [];
  state.stats = data.stats || null;
  setUnread({
    messages: Number.isFinite(data.unreadMessages) ? data.unreadMessages : state.unreadMessages,
    notifications: Number.isFinite(data.unreadNotifications) ? data.unreadNotifications : state.unreadNotifications,
  });
  refreshNavAvatar();
  refreshBadges();
}

async function refreshSession() {
  try {
    const data = await api('/api/me');
    hydrateSession(data);
  } catch {
    /* a sessão continua válida para a navegação atual */
  }
}

async function completeLogin(data, { welcome = '' } = {}) {
  hydrateSession(data);
  await refreshSession();
  await enterApp();
  if (welcome) toast(welcome);
  await openInitialRoute();
}

async function performLogin(username, password, button, errorElement) {
  if (errorElement) errorElement.textContent = '';
  setBusy(button, true);
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    await completeLogin(data);
    return true;
  } catch (error) {
    if (errorElement) errorElement.textContent = error.message;
    else toast(error.message, 'error');
    return false;
  } finally {
    setBusy(button, false);
  }
}

async function openInitialRoute() {
  const params = new URLSearchParams(window.location.search);
  const conversation = Number(params.get('conversation'));
  const profile = params.get('profile');
  const followRequests = params.get('follow-requests');
  try {
    if (Number.isInteger(conversation) && conversation > 0) {
      await navigate('messages', { conversation });
      return;
    }
    if (profile) {
      await navigate('profile', { username: profile });
      return;
    }
    if (followRequests) {
      await navigate('home');
      await openFollowRequests();
    }
  } catch {
    /* permanece no início */
  }
}

async function logout() {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch {
    /* encerra a sessão local mesmo assim */
  }
  state.me = null;
  state.stats = null;
  state.conversations = [];
  state.activeConversation = null;
  setUnread({ messages: 0, notifications: 0 });
  closeStories();
  closeModal();
  showAuth('login');
}

/* ------------------------------------------------------------------ */
/* Autenticação                                                       */
/* ------------------------------------------------------------------ */

async function handleAuthSubmit(form, event) {
  if (form.id === 'login-form') {
    event.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector('button[type="submit"]');
    await performLogin(
      String(data.get('username') || '').trim().toLowerCase(),
      String(data.get('password') || ''),
      button,
      $('#auth-error')
    );
    return true;
  }

  if (form.id === 'register-form') {
    event.preventDefault();
    const formError = form.querySelector('.form-error');
    if (formError) formError.textContent = '';
    const data = new FormData(form);
    const birthDate = String(data.get('birthDate') || '');
    const age = ageFor(birthDate);
    if (age !== null && age < 13) {
      if (formError) formError.textContent = 'É necessário ter pelo menos 13 anos para criar uma conta.';
      return true;
    }
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true);
    try {
      const result = await api('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          name: String(data.get('name') || '').trim(),
          username: String(data.get('username') || '').trim().toLowerCase(),
          birthDate,
          password: String(data.get('password') || ''),
        }),
      });
      await completeLogin(result, { welcome: 'Conta criada. Bem-vindo ao Vibra.' });
    } catch (error) {
      if (formError) formError.textContent = error.message;
      else toast(error.message, 'error');
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  return false;
}

function ageFor(birthDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const date = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const month = now.getMonth() - date.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < date.getDate())) age -= 1;
  return age;
}

/* ------------------------------------------------------------------ */
/* Delegação de eventos                                               */
/* ------------------------------------------------------------------ */

async function handleClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  try {
    if (action === 'auth-tab') {
      setAuthTab(target.dataset.tab === 'register' ? 'register' : 'login');
      return;
    }
    if (action === 'theme') {
      toggleTheme();
      return;
    }
    if (action === 'nav') {
      const view = target.dataset.view || 'home';
      const params = view === 'dating' ? { tab: state.dating.tab || 'discover' } : {};
      await navigate(view, params);
      return;
    }
    if (action === 'nav-self') {
      if (!state.me) return;
      await navigate('profile', { username: state.me.username });
      return;
    }
    if (action === 'account-menu') {
      if (!state.me) return;
      openProfileMenu(state.me);
      return;
    }
    if (action === 'menu-my-profile') {
      closeProfileMenu();
      await navigate('profile', { username: state.me.username });
      return;
    }
    if (action === 'settings') {
      closeProfileMenu();
      await navigate('settings');
      return;
    }
    if (action === 'report-problem') {
      closeProfileMenu();
      openProblemReportModal();
      return;
    }
    if (action === 'close-profile-menu') {
      closeProfileMenu();
      return;
    }
    if (action === 'retry-view') {
      await navigate(state.view, state.params);
      return;
    }
    if (action === 'logout') {
      closeProfileMenu();
      await logout();
      return;
    }
    if (action === 'close-modal') {
      closeModal();
      return;
    }
    if (action === 'open-notifications') {
      await openNotifications();
      return;
    }

    if (await handleSettingsAction(action, target)) return;
    if (await handleSocialAction(action, target)) return;
    if (await handleMessagesAction(action, target)) return;
    if (await handleDatingAction(action, target)) return;
  } catch (error) {
    if (error.status === 401) {
      showAuth('login');
      return;
    }
    toast(error.message || 'Não foi possível concluir a ação.', 'error');
  }
}

async function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  try {
    if (await handleAuthSubmit(form, event)) return;
    if (await handleSocialSubmit(form, event)) return;
    if (await handleMessagesSubmit(form, event)) return;
    if (await handleDatingSubmit(form, event)) return;
    if (await handleSettingsSubmit(form, event)) return;
    if (await handleAccountSubmit(form, event)) return;
  } catch (error) {
    if (error.status === 401) {
      showAuth('login');
      return;
    }
    toast(error.message || 'Não foi possível salvar.', 'error');
  }
}

/* ------------------------------------------------------------------ */
/* Inicialização                                                      */
/* ------------------------------------------------------------------ */

async function boot() {
  initTheme();
  hydrateIcons();
  setAuthTab('login');

  document.addEventListener('click', (event) => {
    if (event.target.classList && event.target.classList.contains('modal-backdrop')) {
      closeModal();
    }
    /* Clique fora do menu lateral do perfil fecha o painel. */
    if (event.target.closest && event.target.closest('[data-profile-menu-close]')) {
      closeProfileMenu();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const modalRoot = $('#modal-root');
      if (modalRoot && modalRoot.innerHTML) closeModal();
      else if (isProfileMenuOpen()) closeProfileMenu();
      else closeStories();
    }
  });
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);

  await loadConfig();
  hydrateIcons();

  try {
    const me = await api('/api/me');
    hydrateSession(me);
    await enterApp();
    await openInitialRoute();
    window.setInterval(() => {
      if (state.me) refreshSession();
    }, 60000);
  } catch {
    showAuth('login');
  }
}

registerView('home', renderHome);
registerView('explore', renderExplore);
registerView('dating', renderDating);
registerView('messages', renderMessages);
registerView('profile', renderProfile);
registerView('settings', renderSettings);

boot();
