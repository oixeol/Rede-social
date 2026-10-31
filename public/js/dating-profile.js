/* Vibra - Namoro: perfil próprio, questionário parcial e Radar. */

import {
  $,
  $$,
  state,
  icon,
  hydrateIcons,
  esc,
  relTime,
  avatar,
  interestLabel,
  emptyState,
  api,
  toast,
  setBusy,
  confirmDialog,
  navigate,
  fileToDataUrl,
} from './core.js';

const MAX_PHOTOS = 6;
const MIN_DISTANCE = 10;
const MAX_DISTANCE = 400;
const ACCURACY_LIMIT = 2000;

let quizAnswers = {};
let autosaveTimer = null;

/* ------------------------------------------------------------------ */
/* Auxiliares                                                         */
/* ------------------------------------------------------------------ */

function optionListFor(question) {
  if (question.id === 'q_interesses') {
    return state.config.interests.map((interest) => ({ id: interest.id, label: interest.label }));
  }
  return question.options || [];
}

function answeredValue(questionId) {
  return Object.prototype.hasOwnProperty.call(quizAnswers, questionId) ? quizAnswers[questionId] : undefined;
}

function isChecked(question, optionId) {
  const value = answeredValue(question.id);
  if (question.type === 'multi') return Array.isArray(value) && value.includes(optionId);
  return value === optionId;
}

function scaleChecked(question, number) {
  return Number(answeredValue(question.id)) === number;
}

function questionBlock(question) {
  const options = optionListFor(question);
  let control = '';
  if (question.type === 'scale') {
    control = `
      <div class="scale-row" role="radiogroup" aria-label="${esc(question.prompt)}">
        ${[1, 2, 3, 4, 5].map((number) => `
          <label class="scale-option ${scaleChecked(question, number) ? 'selected' : ''}">
            <input type="radio" name="${esc(question.id)}" value="${number}" ${scaleChecked(question, number) ? 'checked' : ''} />
            <span>${number}</span>
          </label>`).join('')}
      </div>
      <div class="scale-ends"><span>${esc(question.left || '')}</span><span>${esc(question.right || '')}</span></div>`;
  } else {
    control = `<div class="${question.type === 'multi' ? 'option-grid multi' : 'option-grid'}">
      ${options.map((option) => `
        <label class="option-chip ${isChecked(question, option.id) ? 'selected' : ''}">
          <input type="${question.type === 'multi' ? 'checkbox' : 'radio'}" name="${esc(question.id)}" value="${esc(option.id)}" ${isChecked(question, option.id) ? 'checked' : ''} />
          <span>${esc(option.label)}</span>
        </label>`).join('')}
    </div>`;
  }

  return `
    <section class="quiz-question" data-question="${esc(question.id)}" data-type="${esc(question.type)}">
      <div class="quiz-question-head">
        <div>
          <p class="eyebrow">${esc(question.category)}</p>
          <h3>${esc(question.prompt)}</h3>
        </div>
        ${question.required
          ? '<span class="quiz-required">Obrigatória</span>'
          : '<span class="quiz-optional">Opcional</span>'}
      </div>
      ${control}
    </section>`;
}

function progressWidth(progress) {
  const total = progress.total || 10;
  return Math.min(100, Math.round((progress.answered / total) * 100));
}

function quizProgressMarkup(progress) {
  return `
    <div class="dating-quiz-progress">
      <div class="progress-line" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressWidth(progress)}">
        <span style="width:${progressWidth(progress)}%"></span>
      </div>
      <p>
        <strong data-quiz-answered>${progress.answered}</strong> de ${progress.total} respondidas
        <span data-quiz-required>${progress.requiredAnswered}/${progress.requiredTotal} obrigatórias</span>
        <span class="quiz-save-state" id="quiz-save-state" aria-live="polite"></span>
      </p>
      ${progress.complete
        ? `<p class="quiz-complete">${icon('check', 14)} Questionário completo. Seu perfil pode aparecer nas recomendações.</p>`
        : `<p class="quiz-hint">${icon('info', 14)} Responda às 5 obrigatórias e a pelo menos 6 no total. Você pode salvar e continuar depois.</p>`}
    </div>`;
}

function radarReasonLabel(reason) {
  return {
    radar_off: 'Radar desativado no seu perfil',
    my_consent_missing: 'Você ainda não compartilha com este match',
    their_consent_missing: 'Aguardando o consentimento da outra pessoa',
    location_stale: 'Localização desatualizada',
  }[reason] || 'Distância indisponível';
}

/* ------------------------------------------------------------------ */
/* Perfil de namoro                                                   */
/* ------------------------------------------------------------------ */

export async function renderDatingProfileTab(container, status) {
  const [profileData, answersData, photoOptionsData] = await Promise.all([
    api('/api/dating/profile').catch(() => ({ profile: status.profile, questions: status.questions })),
    api('/api/dating/answers').catch(() => ({ answers: {}, progress: status.quiz })),
    api('/api/dating/photo-options').catch(() => ({ photos: [] })),
  ]);
  if (state.view !== 'dating') return;

  const profile = profileData.profile || status.profile;
  const questions = (profileData.questions && profileData.questions.length ? profileData.questions : status.questions) || [];
  const progress = answersData.progress || status.quiz;
  const goals = status.goals || [];
  quizAnswers = answersData.answers || {};
  state.dating.answers = quizAnswers;
  state.dating.quiz = progress;
  state.dating.profileData = profile;

  const photos = profile ? profile.photos || [] : [];
  const availablePhotos = Array.isArray(photoOptionsData.photos) ? photoOptionsData.photos : [];
  const ageMin = profile ? profile.ageMin : 24;
  const ageMax = profile ? profile.ageMax : 45;
  const distanceKm = profile ? profile.distanceKm : 50;
  const bio = profile ? profile.bio : '';
  const active = profile ? profile.active : true;
  const paused = profile ? profile.paused : false;

  container.innerHTML = `
    <div class="dating-panel-grid">
      <section class="dating-panel">
        <header class="panel-head">
          <div>
            <p class="eyebrow">Perfil de namoro</p>
            <h2>Um retrato só seu.</h2>
            <p>Este perfil é independente do social. Nada daqui aparece no seu perfil público.</p>
          </div>
          <span class="panel-icon">${icon('spark', 22)}</span>
        </header>

        <form id="dating-profile-form" class="dating-form" novalidate>
          <div class="dating-photos-block">
            <div class="field-label">Fotos <small>até ${MAX_PHOTOS}</small></div>
            <div class="dating-photo-grid dating-photo-select">
              ${availablePhotos.map((url) => `
                <label class="dating-photo-option ${photos.includes(url) ? 'selected' : ''}">
                  <input type="checkbox" name="datingPhoto" value="${esc(url)}" ${photos.includes(url) ? 'checked' : ''} />
                  <img src="${esc(url)}" alt="Foto do perfil social" loading="lazy" />
                  <span class="dating-photo-check">${icon('check', 14)}</span>
                </label>`).join('')}
              ${!availablePhotos.length ? '<p class="muted-note">Publique fotos no seu perfil social para usá-las aqui.</p>' : ''}
            </div>
            <p class="field-hint">Selecione até ${MAX_PHOTOS} fotos do seu perfil social. Novas fotos são adicionadas pelo Início.</p>
          </div>

          <label class="field">
            <span>Sua bio de namoro</span>
            <textarea name="bio" rows="3" maxlength="400" placeholder="Conte o que te move, sem copiar seu perfil social.">${esc(bio)}</textarea>
            <small class="field-hint">Mínimo de 10 caracteres para aparecer nas recomendações.</small>
          </label>

          <div class="dating-range-grid">
            <label class="field">
              <span>Idade mínima</span>
              <input name="ageMin" type="number" min="18" max="99" value="${ageMin}" inputmode="numeric" required />
            </label>
            <label class="field">
              <span>Idade máxima</span>
              <input name="ageMax" type="number" min="18" max="99" value="${ageMax}" inputmode="numeric" required />
            </label>
          </div>

          <label class="field distance-field">
            <span>Distância de descoberta <output id="distance-output">${distanceKm} km</output></span>
            <input name="distanceKm" type="range" min="${MIN_DISTANCE}" max="${MAX_DISTANCE}" step="10" value="${distanceKm}" />
            <small class="field-hint">De ${MIN_DISTANCE} km a ${MAX_DISTANCE} km. A distância só é calculada quando as duas pessoas ativam o Radar.</small>
          </label>

          <div class="switch-list">
            <label class="switch-row">
              <span><strong>Perfil ativo</strong><small>Permite que seu perfil participe da descoberta.</small></span>
              <span class="switch"><input type="checkbox" name="active" ${active ? 'checked' : ''} /><i aria-hidden="true"></i></span>
            </label>
            <label class="switch-row">
              <span><strong>Pausar temporariamente</strong><small>Some das recomendações sem apagar suas respostas.</small></span>
              <span class="switch"><input type="checkbox" name="paused" ${paused ? 'checked' : ''} /><i aria-hidden="true"></i></span>
            </label>
          </div>

          <div class="panel-actions">
            <button type="submit" class="btn primary">Salvar perfil</button>
            <button type="button" class="btn ghost" data-action="dating-tab" data-tab="radar">${icon('radar', 16)} Abrir Radar</button>
            <button type="button" class="btn ghost danger-text" data-action="dating-deactivate-profile">Desativar perfil de namoro</button>
          </div>
          <p class="field-hint">Desativar retira o perfil da descoberta, encerra o compartilhamento de localização e preserva suas respostas para quando quiser voltar.</p>
        </form>
      </section>

      <section class="dating-panel quiz-panel">
        <header class="panel-head">
          <div>
            <p class="eyebrow">Questionário de afinidade</p>
            <h2>${progress.complete ? 'Respostas completas.' : 'Vamos por partes.'}</h2>
            <p>As respostas são salvas automaticamente. O cálculo explica o que aproxima vocês.</p>
          </div>
          <span class="panel-icon">${icon('sliders', 22)}</span>
        </header>

        ${quizProgressMarkup(progress)}

        <form id="dating-quiz-form" class="dating-form quiz-form" novalidate>
          ${questions.map(questionBlock).join('')}
          <div class="panel-actions">
            <button type="submit" class="btn primary">Salvar respostas</button>
            <span class="muted small">Você pode voltar depois; nada é publicado automaticamente.</span>
          </div>
          <input type="hidden" name="goalsCount" value="${goals.length}" />
        </form>
      </section>
    </div>`;

  hydrateIcons(container);

  const distance = $('#dating-profile-form input[name="distanceKm"]');
  const output = $('#distance-output');
  if (distance && output) {
    distance.addEventListener('input', () => {
      output.textContent = `${distance.value} km`;
    });
  }

  bindQuizForm();
}

function bindQuizForm() {
  const form = $('#dating-quiz-form');
  if (!form) return;

  const schedule = () => {
    clearTimeout(autosaveTimer);
    const label = $('#quiz-save-state');
    if (label) label.textContent = 'Alterações não salvas…';
    autosaveTimer = setTimeout(() => {
      saveQuiz(form, { silent: true }).catch(() => {});
    }, 700);
  };

  form.addEventListener('change', (event) => {
    const input = event.target.closest('input[type="radio"], input[type="checkbox"]');
    if (!input) return;
    const question = input.closest('.quiz-question');
    if (question) {
      $$('label.option-chip, label.scale-option', question).forEach((label) => {
        const field = label.querySelector('input');
        label.classList.toggle('selected', !!field && field.checked);
      });
    }
    schedule();
  });

  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
      event.preventDefault();
      form.requestSubmit();
    }
  });
}

function collectQuizAnswers() {
  const form = $('#dating-quiz-form');
  if (!form) return {};
  const answers = {};
  $$('.quiz-question', form).forEach((block) => {
    const questionId = block.dataset.question;
    const type = block.dataset.type;
    const question = (state.dating.status?.questions || []).find((item) => item.id === questionId);
    const previous = answeredValue(questionId);
    if (type === 'multi') {
      const checked = $$('input[type="checkbox"]:checked', block).map((input) => input.value);
      if (checked.length) answers[questionId] = checked;
      else if (previous !== undefined) answers[questionId] = null;
    } else if (type === 'single') {
      const selected = block.querySelector('input[type="radio"]:checked');
      if (selected) answers[questionId] = selected.value;
      else if (previous !== undefined) answers[questionId] = null;
    } else if (type === 'scale') {
      const selected = block.querySelector('input[type="radio"]:checked');
      if (selected) answers[questionId] = Number(selected.value);
      else if (previous !== undefined) answers[questionId] = null;
    }
    if (!question && type === 'single') {
      // Sem metadados, mantém a resposta selecionada mesmo assim.
    }
  });
  return answers;
}

async function saveQuiz(form, { silent = false } = {}) {
  const answers = collectQuizAnswers();
  if (!Object.keys(answers).length) {
    if (!silent) toast('Responda pelo menos uma pergunta antes de salvar.', 'error');
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  if (!silent) setBusy(button, true);
  const label = $('#quiz-save-state');
  if (label) label.textContent = 'Salvando…';
  try {
    const data = await api('/api/dating/answers', {
      method: 'PUT',
      body: JSON.stringify({ answers }),
    });
    quizAnswers = data.answers || {};
    state.dating.answers = quizAnswers;
    state.dating.quiz = data.progress;
    if (state.dating.status) state.dating.status.quiz = data.progress;
    const answered = $('[data-quiz-answered]');
    if (answered) answered.textContent = String(data.progress.answered);
    const required = $('[data-quiz-required]');
    if (required) required.textContent = `${data.progress.requiredAnswered}/${data.progress.requiredTotal} obrigatórias`;
    const bar = $('.dating-quiz-progress .progress-line');
    if (bar) {
      bar.setAttribute('aria-valuenow', String(progressWidth(data.progress)));
      const fill = bar.querySelector('span');
      if (fill) fill.style.width = `${progressWidth(data.progress)}%`;
    }
    if (label) label.textContent = silent ? 'Salvo automaticamente.' : 'Respostas salvas.';
    if (!silent) {
      toast(data.progress.complete
        ? 'Questionário completo. Seu perfil já pode ser recomendado.'
        : 'Respostas salvas. Você pode continuar depois.');
    }
  } catch (error) {
    if (label) label.textContent = 'Não foi possível salvar.';
    if (!silent) throw error;
    toast(error.message, 'error');
  } finally {
    if (!silent) setBusy(button, false);
  }
}

/* ------------------------------------------------------------------ */
/* Radar                                                              */
/* ------------------------------------------------------------------ */

export async function renderRadarTab(container, status) {
  const data = await api('/api/dating/radar');
  if (state.view !== 'dating') return;
  state.dating.radar = data;
  const alerts = data.alerts || { enabled: false, thresholdM: 1000 };
  const hasLocation = data.hasLocation && !data.locationStale;
  const matches = data.matches || [];

  container.innerHTML = `
    <div class="dating-panel-grid radar-layout">
      <section class="dating-panel">
        <header class="panel-head">
          <div>
            <p class="eyebrow">Radar de proximidade</p>
            <h2>Encontros por perto, com consentimento.</h2>
            <p>O Radar nunca mostra coordenadas. Ele calcula uma distância aproximada apenas quando você e o match autorizam.</p>
          </div>
          <span class="panel-icon radar-icon">${icon('radar', 22)}</span>
        </header>

        <form id="dating-radar-form" class="dating-form" novalidate>
          <div class="switch-list">
            <label class="switch-row">
              <span><strong>Ativar meu Radar</strong><small>Permite calcular distância aproximada com matches que também autorizarem.</small></span>
              <span class="switch"><input type="checkbox" name="enabled" ${data.enabled ? 'checked' : ''} /><i aria-hidden="true"></i></span>
            </label>
            <label class="switch-row">
              <span><strong>Alertas de proximidade</strong><small>Avisar quando um match consentido estiver dentro do limite escolhido.</small></span>
              <span class="switch"><input type="checkbox" name="alertsEnabled" ${alerts.enabled ? 'checked' : ''} /><i aria-hidden="true"></i></span>
            </label>
          </div>

          <label class="field">
            <span>Limite do alerta</span>
            <select name="thresholdM">
              ${data.thresholds.map((threshold) => `
                <option value="${threshold}" ${threshold === alerts.thresholdM ? 'selected' : ''}>
                  ${threshold >= 1000 ? `${threshold / 1000} km` : `${threshold} m`}
                </option>`).join('')}
            </select>
            <small class="field-hint">O alerta é uma aproximação. Não representa encontro, presença exata ou disponibilidade.</small>
          </label>

          <div class="location-card ${hasLocation ? 'active' : ''}">
            <span class="location-icon">${icon('mapPin', 22)}</span>
            <div>
              <strong>${hasLocation ? 'Localização aproximada ativa' : data.hasLocation ? 'Localização desatualizada' : 'Localização não compartilhada'}</strong>
              <span>
                ${hasLocation
                  ? `Atualizada ${data.locationUpdatedAt ? relTime(data.locationUpdatedAt) : 'agora'}. Vale por 2 horas e é apagada em até 24 horas.`
                  : data.hasLocation
                    ? 'Atualize para o Radar voltar a calcular distâncias.'
                    : 'Sem localização, o Radar não calcula distância com ninguém.'}
              </span>
            </div>
          </div>

          <div class="panel-actions">
            <button type="submit" class="btn primary">Salvar preferências</button>
            <button type="button" class="btn ghost" data-action="dating-location-share">${icon('mapPin', 16)} ${data.hasLocation ? 'Atualizar localização' : 'Compartilhar localização'}</button>
            ${data.hasLocation ? `<button type="button" class="btn ghost danger-text" data-action="dating-location-remove">Remover localização</button>` : ''}
          </div>
        </form>

        <div class="radar-check-card">
          <div>
            <strong>Procurar proximidade agora</strong>
            <span>Verifica os matches com consentimento bilateral. Nenhuma coordenada aparece na tela.</span>
          </div>
          <button type="button" class="btn ghost small" data-action="dating-radar-check">${icon('radar', 15)} Verificar</button>
        </div>
      </section>

      <section class="dating-panel">
        <header class="panel-head compact">
          <div>
            <p class="eyebrow">Matches</p>
            <h2>Compartilhamento por match.</h2>
            <p>Cada match tem uma autorização própria. Desligar aqui não afeta os outros.</p>
          </div>
        </header>

        ${matches.length
          ? `<div class="radar-match-list">${matches.map(radarMatchCard).join('')}</div>`
          : emptyState({
              iconName: 'heart',
              title: 'Nenhum match para o Radar',
              text: 'O Radar só funciona entre matches ativos. Descubra pessoas e dê match primeiro.',
              action: '<button type="button" class="btn primary" data-action="dating-tab" data-tab="discover">Descobrir pessoas</button>',
            })}
      </section>
    </div>`;

  hydrateIcons(container);
}

function radarMatchCard(match) {
  const radar = match.radar || {};
  const available = !!radar.available;
  return `
    <article class="radar-match">
      ${avatar(match.user, 46)}
      <div class="radar-match-main">
        <div class="radar-match-head">
          <strong>${esc(match.user.name)}</strong>
          <span class="radar-status ${available ? 'on' : ''}">
            ${icon(available ? 'mapPin' : 'radar', 13)}
            ${available ? esc(radar.distanceLabel) : esc(radarReasonLabel(radar.reason))}
          </span>
        </div>
        <small>@${esc(match.user.username)}${match.age ? ` · ${match.age} anos` : ''}</small>
        <div class="radar-consents">
          <span class="${radar.myConsent ? 'on' : ''}">${icon(radar.myConsent ? 'check' : 'close', 12)} Você ${radar.myConsent ? 'autorizou' : 'não autorizou'}</span>
          <span class="${radar.theirConsent ? 'on' : ''}">${icon(radar.theirConsent ? 'check' : 'close', 12)} Outra pessoa ${radar.theirConsent ? 'autorizou' : 'não autorizou'}</span>
        </div>
      </div>
      <button type="button" class="btn ghost small" data-action="dating-radar-match" data-id="${match.id}" data-enabled="${radar.myConsent ? 'false' : 'true'}">
        ${radar.myConsent ? 'Parar de compartilhar' : 'Compartilhar'}
      </button>
    </article>`;
}

/* ------------------------------------------------------------------ */
/* Ações                                                              */
/* ------------------------------------------------------------------ */

export async function handleAction(action, target) {
  if (action === 'dating-photo-remove') {
    const confirmed = await confirmDialog({
      title: 'Remover esta foto?',
      body: 'A foto sai do seu perfil de namoro. Se ela também for usada em outro lugar, continua preservada lá.',
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!confirmed) return true;
    await api('/api/dating/photos', {
      method: 'DELETE',
      body: JSON.stringify({ url: target.dataset.url }),
    });
    toast('Foto removida.');
    await navigate('dating', { tab: 'profile' });
    return true;
  }

  if (action === 'dating-location-share') {
    await shareLocation(target);
    return true;
  }

  if (action === 'dating-location-remove') {
    await api('/api/dating/location', { method: 'DELETE' });
    toast('Localização removida e consentimentos do Radar revogados para todos os matches.');
    await navigate('dating', { tab: 'radar' });
    return true;
  }

  if (action === 'dating-deactivate-profile') {
    const confirmed = await confirmDialog({
      title: 'Desativar o perfil de namoro?',
      body: 'O perfil sai da descoberta, o compartilhamento de localização é apagado e os consentimentos de Radar são revogados. Suas respostas e matches continuam preservados para quando quiser voltar.',
      confirmLabel: 'Desativar perfil',
      danger: true,
    });
    if (!confirmed) return true;
    await api('/api/dating/profile', { method: 'DELETE' });
    toast('Perfil de namoro desativado. Você pode reativar em "Perfil de namoro".');
    await navigate('dating', { tab: 'profile' });
    return true;
  }

  if (action === 'dating-radar-match') {
    const enabled = target.dataset.enabled === 'true';
    setBusy(target, true);
    try {
      await api(`/api/dating/matches/${Number(target.dataset.id)}/radar`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
      toast(enabled
        ? 'Compartilhamento autorizado para este match.'
        : 'Compartilhamento encerrado para este match.');
      await navigate('dating', { tab: 'radar' });
    } finally {
      setBusy(target, false);
    }
    return true;
  }

  if (action === 'dating-radar-check') {
    setBusy(target, true);
    try {
      const data = await api('/api/dating/radar/check', { method: 'POST' });
      if (!data.enabled) {
        toast('Ative o Radar e os alertas para verificar proximidade.', 'error');
      } else if (data.triggered > 0) {
        toast(`${data.triggered} ${data.triggered === 1 ? 'match está' : 'matches estão'} dentro do limite configurado.`);
      } else {
        toast('Nenhum match consentido está dentro do limite agora.');
      }
    } finally {
      setBusy(target, false);
    }
    return true;
  }

  return false;
}

function shareLocation(button) {
  if (!navigator.geolocation) {
    toast('Este navegador não oferece localização.', 'error');
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setBusy(button, true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy } = position.coords;
          await api('/api/dating/location', {
            method: 'PUT',
            body: JSON.stringify({ lat: latitude, lng: longitude, accuracy: accuracy || 0 }),
          });
          toast(accuracy > ACCURACY_LIMIT
            ? 'Localização salva, mas a precisão do navegador está baixa. O Radar pode não calcular a distância.'
            : 'Localização aproximada atualizada. Ela expira em 2 horas.');
          await navigate('dating', { tab: 'radar' });
        } catch (error) {
          toast(error.message, 'error');
        } finally {
          setBusy(button, false);
          resolve();
        }
      },
      (error) => {
        setBusy(button, false);
        const message = error && error.code === 1
          ? 'Permissão de localização negada. Você pode continuar usando o Namoro sem o Radar.'
          : 'Não foi possível obter sua localização agora.';
        toast(message, 'error');
        resolve();
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

/* ------------------------------------------------------------------ */
/* Formulários                                                        */
/* ------------------------------------------------------------------ */

export async function handleSubmit(form, event) {
  if (form.id === 'dating-profile-form') {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const ageMin = Number(data.get('ageMin'));
    const ageMax = Number(data.get('ageMax'));
    const distanceKm = Number(data.get('distanceKm'));
    if (!Number.isInteger(ageMin) || !Number.isInteger(ageMax) || ageMin < 18 || ageMax > 99 || ageMin > ageMax) {
      toast('Use uma faixa etária válida entre 18 e 99 anos.', 'error');
      return true;
    }
    if (!Number.isInteger(distanceKm) || distanceKm < MIN_DISTANCE || distanceKm > MAX_DISTANCE) {
      toast('A distância deve ficar entre 10 km e 400 km.', 'error');
      return true;
    }
    const selectedPhotos = [...form.querySelectorAll('input[name="datingPhoto"]:checked')]
      .map((input) => input.value)
      .slice(0, MAX_PHOTOS);
    setBusy(button, true);
    try {
      await api('/api/dating/photos', {
        method: 'PUT',
        body: JSON.stringify({ urls: selectedPhotos }),
      });
      const result = await api('/api/dating/profile', {
        method: 'PUT',
        body: JSON.stringify({
          bio: String(data.get('bio') || '').trim(),
          ageMin,
          ageMax,
          distanceKm,
          active: data.get('active') === 'on',
          paused: data.get('paused') === 'on',
        }),
      });
      state.dating.profileData = result.profile;
      if (state.dating.status) state.dating.status.profile = result.profile;
      toast('Perfil de namoro salvo.');
      await navigate('dating', { tab: 'profile' });
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  if (form.id === 'dating-quiz-form') {
    event.preventDefault();
    await saveQuiz(form);
    return true;
  }

  if (form.id === 'dating-radar-form') {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    setBusy(button, true);
    try {
      await api('/api/dating/radar/prefs', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: data.get('enabled') === 'on',
          alertsEnabled: data.get('alertsEnabled') === 'on',
          thresholdM: Number(data.get('thresholdM')),
        }),
      });
      toast('Preferências do Radar salvas.');
      await navigate('dating', { tab: 'radar' });
    } finally {
      setBusy(button, false);
    }
    return true;
  }

  return false;
}
