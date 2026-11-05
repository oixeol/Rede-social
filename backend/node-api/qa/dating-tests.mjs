/**
 * Testes de integração do Namoro verificado.
 *
 * Roda contra um servidor isolado iniciado por qa/run-tests.mjs.
 * Cobre: verificação 18+, webhook assinado, bloqueio de menores, data de
 * nascimento imutável, quiz, descoberta sem distância, match idempotente,
 * conversa de namoro, expiração de verificação, Radar consensual, bloqueio,
 * moderação, fotos e proteção de sessão.
 */
import crypto from 'node:crypto';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const WEBHOOK_SECRET = process.env.IDENTITY_WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z9ZkAAAAASUVORK5CYII=';
const SOCIAL_BIO = 'Bio social pública do teste automatizado.';
const DATING_BIO_A = 'Bio de namoro privada e exclusiva do QA Alfa.';
const DATING_BIO_B = 'Bio de namoro privada e exclusiva do QA Beta.';
const PASSWORD = 'QaSenha123!';

let failures = 0;

function ok(label, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

function makeClient() {
  let cookie = '';
  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    if (options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(BASE + path, { ...options, headers });
    for (const value of response.headers.getSetCookie?.() || []) {
      const pair = value.split(';')[0];
      if (pair.startsWith('vibra_session=')) cookie = pair.endsWith('=') ? '' : pair;
    }
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: response.status, data, headers: response.headers };
  }
  return api;
}

function webhookPayload(userId, status, extra = {}) {
  return JSON.stringify({
    userId,
    status,
    providerRef: `qa-${userId}-${status}`,
    ...extra,
  });
}

async function sendWebhook(userId, status, extra = {}, secret = WEBHOOK_SECRET) {
  const payload = webhookPayload(userId, status, extra);
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return fetch(`${BASE}/api/webhooks/identity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Vibra-Signature': signature,
    },
    body: payload,
  });
}

async function register(client, { username, name, birthDate, password = PASSWORD }) {
  const response = await client('/api/register', {
    method: 'POST',
    body: JSON.stringify({ username, name, birthDate, password }),
  });
  ok(`cadastro ${username}`, response.status === 201 && response.data.user?.username === username, String(response.data?.error || ''));
  return response.data?.user;
}

async function login(client, username) {
  const response = await client('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  ok(`login ${username}`, response.status === 200 && response.data.user?.username === username);
  return response.data?.user;
}

async function submitVerification(client, birthDate, fullName) {
  return client('/api/dating/verification', {
    method: 'POST',
    body: JSON.stringify({
      birthDate,
      fullName,
      consent: true,
      documentId: 'QA-0001',
    }),
  });
}

async function setupDating(client, user, birthDate, bio) {
  const verification = await submitVerification(client, birthDate, user.name);
  ok(
    `verificação aceita para ${user.username}`,
    verification.status === 200 && verification.data.verification.status === 'in_review',
    String(verification.data?.error || '')
  );

  const webhook = await sendWebhook(user.id, 'approved', {
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });
  ok(`webhook aprova ${user.username}`, webhook.status === 200);

  const profile = await client('/api/dating/profile', {
    method: 'PUT',
    body: JSON.stringify({
      bio,
      ageMin: 18,
      ageMax: 99,
      distanceKm: 50,
      radarEnabled: true,
      active: true,
    }),
  });
  ok(
    `perfil de namoro de ${user.username}`,
    profile.status === 200 && profile.data.profile?.radarEnabled === true && profile.data.profile?.distanceKm === 50,
    String(profile.data?.error || '')
  );

  const answers = await client('/api/dating/answers', {
    method: 'PUT',
    body: JSON.stringify({
      answers: {
        q_objetivos: ['relacionamento'],
        q_interesses: ['cafe', 'musica', 'viagens'],
        q_fim_de_semana: 'cultura',
        q_conversa: 4,
        q_planejamento: 4,
        q_grupos: 'intimo',
        q_pessoas_novas: 4,
        q_rotina: 'calma',
        q_atividade: 'leve',
        q_viagem: 'cidade',
      },
    }),
  });
  ok(
    `quiz de ${user.username}`,
    answers.status === 200 && answers.data.progress?.complete === true,
    String(answers.data?.error || '')
  );

  const status = await client('/api/dating/status');
  ok(
    `namoro liberado para ${user.username}`,
    status.status === 200 &&
      status.data.verification.allowed === true &&
      status.data.profileComplete === true &&
      status.data.discoveryReady === true,
    String(status.data?.error || '')
  );
  return status.data;
}

/* ------------------------------------------------------------------ */
/* Configuração e proteção básica                                     */
/* ------------------------------------------------------------------ */
const config = await fetch(`${BASE}/api/config`).then((response) => response.json());
ok('verificação em modo webhook no teste', config.identity?.mode === 'webhook' && config.identity?.simulation === false);

const anonymous = makeClient();
ok('API exige sessão', (await anonymous('/api/me')).status === 401);

const forged = makeClient();
const forgedResponse = await forged('/api/me', { headers: { Cookie: 'vibra_session=forjado' } });
ok('cookie inválido é rejeitado', forgedResponse.status === 401);

const crossOrigin = await fetch(`${BASE}/api/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://invasor.test' },
  body: JSON.stringify({ username: 'origem-cruzada', password: 'nao-autenticado' }),
});
ok('origem cruzada é rejeitada', crossOrigin.status === 403);

/* ------------------------------------------------------------------ */
/* Contas e uso social antes do namoro                                */
/* ------------------------------------------------------------------ */
const alfa = makeClient();
const beta = makeClient();
const menor = makeClient();

const alfaUser = await register(alfa, {
  username: 'qa.alfa',
  name: 'QA Alfa',
  birthDate: '1995-04-10',
});
const betaUser = await register(beta, {
  username: 'qa.beta',
  name: 'QA Beta',
  birthDate: '1996-07-19',
});
const menorUser = await register(menor, {
  username: 'qa.menor',
  name: 'QA Menor',
  birthDate: '2010-02-03',
});

ok('conta social funciona antes do namoro', (await alfa('/api/feed')).status === 200);
const post = await alfa('/api/posts', {
  method: 'POST',
  body: JSON.stringify({ image: PNG, caption: 'Publicação social do QA.' }),
});
ok('publicação social criada sem namoro', post.status === 201 && !!post.data.post?.id);

const datingLocked = await alfa('/api/dating/profile');
ok(
  'namoro bloqueado antes da verificação',
  datingLocked.status === 403 && datingLocked.data?.code === 'dating_locked'
);
const quizLocked = await alfa('/api/dating/answers', {
  method: 'PUT',
  body: JSON.stringify({ answers: { q_conversa: 3 } }),
});
ok('quiz bloqueado antes da verificação', quizLocked.status === 403 && quizLocked.data?.code === 'dating_locked');

const menorStatus = await menor('/api/dating/status');
ok(
  'menor não é considerado adulto',
  menorStatus.status === 200 && menorStatus.data.verification.age < 18 && menorStatus.data.verification.allowed === false
);
const menorAttempt = await submitVerification(menor, '2010-02-03', 'QA Menor Teste');
ok(
  'verificação rejeita menor de 18',
  menorAttempt.status === 403 && menorAttempt.data?.code === 'not_adult'
);
ok('dev-approve não existe no modo webhook', (await alfa('/api/dating/verification/dev-approve', { method: 'POST' })).status === 403);

const wrongDate = await submitVerification(alfa, '1994-04-10', 'QA Alfa Teste');
ok(
  'data de nascimento da conta é imutável',
  wrongDate.status === 409 && wrongDate.data?.code === 'birth_date_locked'
);

const webhookBad = await sendWebhook(alfaUser.id, 'approved', {}, 'segredo-errado');
ok('webhook rejeita assinatura inválida', webhookBad.status === 401);
const statusAfterBad = await alfa('/api/dating/status');
ok(
  'assinatura inválida não aprova ninguém',
  statusAfterBad.status === 200 && statusAfterBad.data.verification.status === 'not_started'
);

const alfaStatus = await setupDating(alfa, alfaUser, '1995-04-10', DATING_BIO_A);
ok(
  'verificação usa provedor real e não simulação',
  alfaStatus.verification.providerMode === 'webhook' && alfaStatus.verification.isSimulation === false
);

const betaStatus = await setupDating(beta, betaUser, '1996-07-19', DATING_BIO_B);
ok('Beta também está liberado', betaStatus.verification.allowed === true);

/* ------------------------------------------------------------------ */
/* Validações de perfil, quiz e privacidade                            */
/* ------------------------------------------------------------------ */
const invalidDistance = await alfa('/api/dating/profile', {
  method: 'PUT',
  body: JSON.stringify({ distanceKm: 5 }),
});
ok('distância abaixo de 10 km é rejeitada', invalidDistance.status === 400);

const invalidDistanceMax = await alfa('/api/dating/profile', {
  method: 'PUT',
  body: JSON.stringify({ distanceKm: 401 }),
});
ok('distância acima de 400 km é rejeitada', invalidDistanceMax.status === 400);

const invalidAnswer = await alfa('/api/dating/answers', {
  method: 'PUT',
  body: JSON.stringify({ answers: { q_conversa: 9 } }),
});
ok('resposta de escala inválida é rejeitada', invalidAnswer.status === 400);

const alfaPublic = await beta('/api/users/qa.alfa');
ok(
  'perfil social não expõe bio do namoro',
  alfaPublic.status === 200 &&
    !JSON.stringify(alfaPublic.data).includes(DATING_BIO_A) &&
    alfaPublic.data.user?.bio !== DATING_BIO_A
);
ok('perfil social expõe política de mensagens', typeof alfaPublic.data?.user?.messagePolicy === 'string');

await alfa('/api/me', {
  method: 'PATCH',
  body: JSON.stringify({ bio: SOCIAL_BIO }),
});

/* ------------------------------------------------------------------ */
/* Descoberta e match                                                  */
/* ------------------------------------------------------------------ */
const discover = await alfa('/api/dating/discover');
const betaCard = discover.data?.profiles?.find((item) => item.user.username === 'qa.beta');
ok(
  'descoberta encontra o Beta',
  discover.status === 200 && !!betaCard,
  String(discover.data?.error || '')
);
ok(
  'descoberta não revela distância antes do match',
  !!betaCard &&
    betaCard.distanceKnown === false &&
    betaCard.distanceLabel === 'Distância privada até o match' &&
    !JSON.stringify(betaCard).includes('distanceMeters')
);
ok(
  'compatibilidade tem pontuação e explicações',
  !!betaCard &&
    Number.isFinite(betaCard.score) &&
    betaCard.score >= 0 &&
    betaCard.score <= 99 &&
    betaCard.sharedInterests.length >= 1 &&
    betaCard.reasons.length >= 1
);
ok('descoberta não vaza coordenadas', !/"(lat|lng)"/.test(JSON.stringify(discover.data)));

const alfaLike = await alfa('/api/dating/likes/qa.beta', {
  method: 'POST',
  body: JSON.stringify({ action: 'like' }),
});
ok('curtida isolada não cria match', alfaLike.status === 200 && alfaLike.data.matched === false);

const bothBetaLikes = await Promise.all([
  beta('/api/dating/likes/qa.alfa', { method: 'POST', body: JSON.stringify({ action: 'like' }) }),
  beta('/api/dating/likes/qa.alfa', { method: 'POST', body: JSON.stringify({ action: 'like' }) }),
]);
const matchIds = bothBetaLikes.map((response) => response.data?.match?.id).filter(Boolean);
ok(
  'curtidas simultâneas criam um único match',
  bothBetaLikes.every((response) => response.status === 200 && response.data.matched === true) &&
    matchIds.length === 2 &&
    matchIds[0] === matchIds[1],
  JSON.stringify(matchIds)
);
const matchId = matchIds[0];
const conversationId = bothBetaLikes[0].data.match.conversationId;
ok('match abre conversa de namoro', Number.isInteger(matchId) && Number.isInteger(conversationId));

const alfaMatches = await alfa('/api/dating/matches');
const betaEntries = alfaMatches.data?.matches?.filter((item) => item.user.username === 'qa.beta') || [];
ok('match não é duplicado na listagem', alfaMatches.status === 200 && betaEntries.length === 1);
ok(
  'match não mostra distância sem consentimento no Radar',
  betaEntries[0]?.distanceKnown === false && betaEntries[0]?.radar?.available === false
);

const message = await alfa(`/api/conversations/${conversationId}/messages`, {
  method: 'POST',
  body: JSON.stringify({ text: 'Mensagem de namoro do QA.' }),
});
ok('mensagem de namoro permitida', message.status === 201 && message.data.message?.id > 0);

const betaThread = await beta(`/api/conversations/${conversationId}`);
ok(
  'conversa de namoro visível para o match',
  betaThread.status === 200 && betaThread.data.conversation?.canSend === true
);

/* ------------------------------------------------------------------ */
/* Expiração da verificação e bloqueio das conversas de namoro        */
/* ------------------------------------------------------------------ */
const expire = await sendWebhook(betaUser.id, 'expired');
ok('webhook expira verificação do Beta', expire.status === 200);

const betaLockedMatches = await beta('/api/dating/matches');
ok(
  'namoro bloqueado após expiração',
  betaLockedMatches.status === 403 && betaLockedMatches.data?.code === 'dating_locked'
);
const betaLockedList = await beta('/api/conversations');
ok(
  'conversa de namoro some da lista do verificador expirado',
  betaLockedList.status === 200 &&
    !betaLockedList.data.conversations.some((item) => item.id === conversationId)
);
const alfaLockedThread = await alfa(`/api/conversations/${conversationId}`);
ok(
  'match vê a conversa, mas não pode enviar',
  alfaLockedThread.status === 200 &&
    alfaLockedThread.data.conversation?.canSend === false &&
    alfaLockedThread.data.conversation?.reason === 'dating_locked'
);
const alfaLockedSend = await alfa(`/api/conversations/${conversationId}/messages`, {
  method: 'POST',
  body: JSON.stringify({ text: 'Não deveria passar.' }),
});
ok(
  'envio bloqueado quando o outro perdeu a verificação',
  alfaLockedSend.status === 403 && alfaLockedSend.data?.code === 'dating_locked'
);
const betaLockedRead = await beta(`/api/conversations/${conversationId}/read`, { method: 'POST' });
ok(
  'leitura bloqueada para verificação expirada',
  betaLockedRead.status === 403 && betaLockedRead.data?.code === 'dating_locked'
);

const reapprove = await sendWebhook(betaUser.id, 'approved', {
  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
});
ok('webhook reativa a verificação', reapprove.status === 200);
const afterApproveSend = await alfa(`/api/conversations/${conversationId}/messages`, {
  method: 'POST',
  body: JSON.stringify({ text: 'Conversa liberada de novo.' }),
});
ok('envio volta após nova aprovação', afterApproveSend.status === 201);

/* ------------------------------------------------------------------ */
/* Radar consensual                                                   */
/* ------------------------------------------------------------------ */
const radarPrefsA = await alfa('/api/dating/radar/prefs', {
  method: 'PUT',
  body: JSON.stringify({ enabled: true, alertsEnabled: true, thresholdM: 5000 }),
});
ok(
  'preferências de Radar do Alfa',
  radarPrefsA.status === 200 && radarPrefsA.data.enabled === true && radarPrefsA.data.alerts.enabled === true
);

const locationA = await alfa('/api/dating/location', {
  method: 'PUT',
  body: JSON.stringify({ lat: -23.5505, lng: -46.6333, accuracy: 25 }),
});
const locationB = await beta('/api/dating/location', {
  method: 'PUT',
  body: JSON.stringify({ lat: -23.5512, lng: -46.6341, accuracy: 30 }),
});
ok(
  'localização aproximada aceita',
  locationA.status === 200 && locationA.data.shared === true && locationB.status === 200
);
ok(
  'localização não devolve coordenadas',
  !JSON.stringify(locationA.data).includes('-23.5505') && !JSON.stringify(locationA.data).includes('lat')
);

const radarBefore = await alfa(`/api/dating/matches/${matchId}/radar`);
ok(
  'Radar exige consentimento do próprio usuário',
  radarBefore.status === 200 &&
    radarBefore.data.radar.available === false &&
    radarBefore.data.radar.reason === 'my_consent_missing'
);

const consentA = await alfa(`/api/dating/matches/${matchId}/radar`, {
  method: 'POST',
  body: JSON.stringify({ enabled: true }),
});
ok('consentimento do Alfa registrado', consentA.status === 200 && consentA.data.radar.myConsent === true);

const radarHalf = await alfa(`/api/dating/matches/${matchId}/radar`);
ok(
  'Radar exige consentimento bilateral',
  radarHalf.status === 200 &&
    radarHalf.data.radar.available === false &&
    radarHalf.data.radar.reason === 'their_consent_missing'
);

const consentB = await beta(`/api/dating/matches/${matchId}/radar`, {
  method: 'POST',
  body: JSON.stringify({ enabled: true }),
});
ok('consentimento do Beta registrado', consentB.status === 200 && consentB.data.radar.myConsent === true);

const radarReady = await alfa(`/api/dating/matches/${matchId}/radar`);
ok(
  'Radar liberado com consentimento dos dois',
  radarReady.status === 200 &&
    radarReady.data.radar.available === true &&
    radarReady.data.radar.bothConsent === true &&
    radarReady.data.radar.distanceLabel !== 'Distância indisponível',
  JSON.stringify(radarReady.data?.radar)
);
ok(
  'Radar não expõe coordenadas exatas',
  !/"(lat|lng)"/.test(JSON.stringify(radarReady.data)) &&
    !JSON.stringify(radarReady.data).includes('-23.55')
);

const matchesWithRadar = await alfa('/api/dating/matches');
const radarMatch = matchesWithRadar.data?.matches?.find((item) => item.id === matchId);
ok(
  'distância aparece apenas no match com Radar ativo',
  radarMatch?.distanceKnown === true && radarMatch?.radar?.available === true
);

const radarCheck = await alfa('/api/dating/radar/check', { method: 'POST' });
ok(
  'alerta de proximidade disparado',
  radarCheck.status === 200 &&
    radarCheck.data.enabled === true &&
    radarCheck.data.results.some((item) => item.matchId === matchId)
);
const radarCheckAgain = await alfa('/api/dating/radar/check', { method: 'POST' });
ok('alerta não repete dentro da janela de 6h', radarCheckAgain.status === 200 && radarCheckAgain.data.triggered === 0);

const revokeB = await beta(`/api/dating/matches/${matchId}/radar`, {
  method: 'POST',
  body: JSON.stringify({ enabled: false }),
});
ok('consentimento pode ser revogado', revokeB.status === 200 && revokeB.data.radar.myConsent === false);
const radarRevoked = await alfa(`/api/dating/matches/${matchId}/radar`);
ok(
  'revogação bloqueia o Radar',
  radarRevoked.status === 200 &&
    radarRevoked.data.radar.available === false &&
    radarRevoked.data.radar.reason === 'their_consent_missing'
);

const betaRadarOff = await beta('/api/dating/profile', {
  method: 'PUT',
  body: JSON.stringify({ radarEnabled: false }),
});
ok('Radar global pode ser desligado', betaRadarOff.status === 200 && betaRadarOff.data.profile.radarEnabled === false);
const radarOtherOff = await alfa(`/api/dating/matches/${matchId}/radar`);
ok(
  'Radar desligado do outro lado bloqueia a distância',
  radarOtherOff.status === 200 && radarOtherOff.data.radar.reason === 'their_radar_off'
);

const betaRadarOn = await beta('/api/dating/profile', {
  method: 'PUT',
  body: JSON.stringify({ radarEnabled: true }),
});
ok('Radar global pode ser religado', betaRadarOn.status === 200 && betaRadarOn.data.profile.radarEnabled === true);
await beta('/api/dating/location', {
  method: 'PUT',
  body: JSON.stringify({ lat: -23.5512, lng: -46.6341, accuracy: 30 }),
});
await beta(`/api/dating/matches/${matchId}/radar`, {
  method: 'POST',
  body: JSON.stringify({ enabled: true }),
});

const deleteLocation = await alfa('/api/dating/location', { method: 'DELETE' });
ok('localização pode ser apagada', deleteLocation.status === 200 && deleteLocation.data.shared === false);
const radarNoLocation = await alfa(`/api/dating/matches/${matchId}/radar`);
ok(
  'apagar localização revoga consentimento',
  radarNoLocation.status === 200 &&
    radarNoLocation.data.radar.myConsent === false &&
    radarNoLocation.data.radar.reason === 'my_consent_missing'
);

await alfa('/api/dating/location', {
  method: 'PUT',
  body: JSON.stringify({ lat: -23.5505, lng: -46.6333, accuracy: 25 }),
});
await alfa(`/api/dating/matches/${matchId}/radar`, {
  method: 'POST',
  body: JSON.stringify({ enabled: true }),
});
const radarRestored = await alfa(`/api/dating/matches/${matchId}/radar`);
ok('Radar volta após novo consentimento', radarRestored.status === 200 && radarRestored.data.radar.available === true);

const alfaRadarOff = await alfa('/api/dating/profile', {
  method: 'PUT',
  body: JSON.stringify({ radarEnabled: false }),
});
const radarSelfOff = await alfa(`/api/dating/matches/${matchId}/radar`);
ok(
  'desligar o próprio Radar encerra a distância',
  alfaRadarOff.status === 200 &&
    radarSelfOff.status === 200 &&
    radarSelfOff.data.radar.available === false &&
    radarSelfOff.data.radar.reason === 'radar_off'
);
const radarCheckOff = await alfa('/api/dating/radar/check', { method: 'POST' });
ok('Radar desligado não dispara alertas', radarCheckOff.status === 200 && radarCheckOff.data.triggered === 0);

/* ------------------------------------------------------------------ */
/* Conversa social, bloqueio e desbloqueio                            */
/* ------------------------------------------------------------------ */
const alfaFollows = await alfa('/api/users/qa.beta/follow', { method: 'POST' });
const betaFollows = await beta('/api/users/qa.alfa/follow', { method: 'POST' });
ok('seguimento mútuo para conversa social', alfaFollows.data.isFollowing === true && betaFollows.data.isFollowing === true);

const socialConversation = await alfa('/api/conversations', {
  method: 'POST',
  body: JSON.stringify({ username: 'qa.beta' }),
});
ok('conversa social criada', socialConversation.status === 200 && !!socialConversation.data.conversation?.id);
const socialId = socialConversation.data.conversation.id;
ok(
  'mensagem social permitida',
  (await alfa(`/api/conversations/${socialId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text: 'Oi pelo social.' }),
  })).status === 201
);

const reportUser = await alfa('/api/reports', {
  method: 'POST',
  body: JSON.stringify({
    targetType: 'user',
    targetId: betaUser.id,
    reason: 'Perfil de teste',
    details: 'Denúncia criada pelo teste automatizado.',
  }),
});
ok('denúncia de perfil criada', reportUser.status === 201 && reportUser.data.report?.id > 0);
const reportMessage = await beta('/api/reports', {
  method: 'POST',
  body: JSON.stringify({
    targetType: 'message',
    targetId: message.data.message.id,
    reason: 'Mensagem de teste',
  }),
});
ok('denúncia de mensagem criada', reportMessage.status === 201 && reportMessage.data.report?.id > 0);

const queueDenied = await alfa('/api/moderation/reports');
ok('fila de moderação exige token', queueDenied.status === 403);
const queue = await alfa('/api/moderation/reports', { headers: { 'X-Admin-Token': ADMIN_TOKEN } });
ok(
  'moderador vê as denúncias',
  queue.status === 200 &&
    queue.data.reports?.some((item) => item.id === reportUser.data.report.id) &&
    queue.data.reports?.some((item) => item.id === reportMessage.data.report.id)
);
const resolveReport = await alfa(`/api/moderation/reports/${reportUser.data.report.id}`, {
  method: 'PATCH',
  headers: { 'X-Admin-Token': ADMIN_TOKEN },
  body: JSON.stringify({ status: 'resolved' }),
});
ok('denúncia pode ser resolvida', resolveReport.status === 200);

const block = await alfa('/api/users/qa.beta/block', {
  method: 'PUT',
  body: JSON.stringify({ blocked: true }),
});
ok('bloqueio explícito', block.status === 200 && block.data.blocked === true);
const blockList = await alfa('/api/blocks');
ok(
  'lista de bloqueados',
  blockList.status === 200 && blockList.data.blockedUsers?.some((item) => item.user.username === 'qa.beta')
);

const blockedSocial = await alfa(`/api/conversations/${socialId}/messages`, {
  method: 'POST',
  body: JSON.stringify({ text: 'Bloqueado.' }),
});
ok('bloqueio impede mensagem social', blockedSocial.status === 403);
const blockedDating = await alfa(`/api/conversations/${conversationId}/messages`, {
  method: 'POST',
  body: JSON.stringify({ text: 'Bloqueado no namoro.' }),
});
ok('bloqueio impede mensagem de namoro', blockedDating.status === 403);
const blockedLike = await alfa('/api/dating/likes/qa.beta', {
  method: 'POST',
  body: JSON.stringify({ action: 'like' }),
});
ok('bloqueio impede curtida no namoro', blockedLike.status === 403);
const matchesAfterBlock = await alfa('/api/dating/matches');
ok(
  'bloqueio encerra o match',
  matchesAfterBlock.status === 200 && !matchesAfterBlock.data.matches.some((item) => item.id === matchId)
);

const unblock = await alfa('/api/users/qa.beta/block', { method: 'DELETE' });
ok('desbloqueio explícito', unblock.status === 200 && unblock.data.blocked === false);
ok('lista de bloqueados fica vazia', (await alfa('/api/blocks')).data.blockedUsers.length === 0);

await alfa('/api/users/qa.beta/follow', { method: 'POST' });
await beta('/api/users/qa.alfa/follow', { method: 'POST' });
ok(
  'conversa social volta após desbloqueio e novo seguimento',
  (await alfa(`/api/conversations/${socialId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text: 'Oi de novo.' }),
  })).status === 201
);

const relikeA = await alfa('/api/dating/likes/qa.beta', {
  method: 'POST',
  body: JSON.stringify({ action: 'like' }),
});
const relikeB = await beta('/api/dating/likes/qa.alfa', {
  method: 'POST',
  body: JSON.stringify({ action: 'like' }),
});
ok(
  'novo match após desbloqueio',
  relikeA.status === 200 && relikeB.status === 200 && relikeB.data.matched === true
);
const newMatchId = relikeB.data.match.id;
const newConversationId = relikeB.data.match.conversationId;

const unmatch = await alfa(`/api/dating/matches/${newMatchId}`, { method: 'DELETE' });
ok('desfazer match', unmatch.status === 200);
const sendAfterUnmatch = await alfa(`/api/conversations/${newConversationId}/messages`, {
  method: 'POST',
  body: JSON.stringify({ text: 'Depois do unmatch.' }),
});
ok('unmatch encerra a conversa', sendAfterUnmatch.status === 403);
const matchesAfterUnmatch = await alfa('/api/dating/matches');
ok(
  'match encerrado some da listagem',
  matchesAfterUnmatch.status === 200 && !matchesAfterUnmatch.data.matches.some((item) => item.id === newMatchId)
);

/* ------------------------------------------------------------------ */
/* Fotos do namoro                                                    */
/* ------------------------------------------------------------------ */
const photo = await alfa('/api/dating/photos', {
  method: 'POST',
  body: JSON.stringify({ image: PNG }),
});
ok(
  'upload validado de foto do namoro',
  photo.status === 201 && String(photo.data.photo).startsWith('/uploads/dating-'),
  String(photo.data?.error || '')
);
const invalidPhoto = await alfa('/api/dating/photos', {
  method: 'POST',
  body: JSON.stringify({ image: 'data:text/html;base64,PGgxPk9pPC9oMT4=' }),
});
ok('upload de tipo inválido é rejeitado', invalidPhoto.status === 400);
const foreignPhoto = await alfa('/api/dating/profile', {
  method: 'PUT',
  body: JSON.stringify({ photos: ['/uploads/seed-sunset.svg'] }),
});
ok(
  'foto de terceiro não pode ser usada',
  foreignPhoto.status === 400 && foreignPhoto.data?.code === 'invalid_photo'
);
const removePhoto = await alfa('/api/dating/photos', {
  method: 'DELETE',
  body: JSON.stringify({ url: photo.data.photo }),
});
ok('foto do namoro pode ser removida', removePhoto.status === 200 && !removePhoto.data.photos.includes(photo.data.photo));

await alfa(`/api/posts/${post.data.post.id}`, { method: 'DELETE' });

console.log(failures ? `\n${failures} FALHA(S) NO NAMORO` : '\nTESTES DE NAMORO PASSARAM');
process.exitCode = failures ? 1 : 0;
