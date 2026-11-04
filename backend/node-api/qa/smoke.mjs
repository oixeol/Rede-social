import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const DEMO_PASSWORD = process.env.VIBRA_DEMO_PASSWORD || '';
if (!DEMO_PASSWORD) {
  console.error('Defina VIBRA_DEMO_PASSWORD para testar contra um servidor com dados de demonstração.');
  process.exit(1);
}
let cookie = '';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z9ZkAAAAASUVORK5CYII=';

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { ...options, headers });
  const setCookie = res.headers.getSetCookie?.() || [];
  for (const value of setCookie) {
    const pair = value.split(';')[0];
    if (pair.startsWith('vibra_session=')) {
      cookie = pair.endsWith('=') ? '' : pair;
    }
  }
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data, headers: res.headers };
}

function ok(label, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) process.exitCode = 1;
}

const login = await api('/api/login', {
  method: 'POST',
  body: JSON.stringify({ username: 'vibra', password: DEMO_PASSWORD }),
});
ok('login demo', login.status === 200 && login.data.user.username === 'vibra');
ok('cookie de sessão', cookie.startsWith('vibra_session='));

const me = await api('/api/me');
ok('sessão /api/me', me.status === 200 && me.data.user.id === 1);

/* --- entitlement de paleta de tema ---------------------------------- */
ok(
  'usuário free recebe capability explícita e paleta padrão',
  me.data.user.canCustomizeTheme === false &&
    me.data.user.themePalette === 'orange' &&
    me.data.canCustomizeTheme === false &&
    me.data.themePalette === 'orange'
);

const invalidPalette = await api('/api/me/theme-palette', {
  method: 'PATCH',
  body: JSON.stringify({ palette: '#ff8800' }),
});
ok('paleta arbitrária é rejeitada', invalidPalette.status === 400, `status ${invalidPalette.status}`);

const freePaletteAttempt = await api('/api/me/theme-palette', {
  method: 'PATCH',
  body: JSON.stringify({ palette: 'blue' }),
});
ok('usuário free não altera a paleta', freePaletteAttempt.status === 403, `status ${freePaletteAttempt.status}`);

const subscriptionAttempt = await api('/api/me', {
  method: 'PATCH',
  body: JSON.stringify({ subscriptionStatus: 'active', subscriptionEndsAt: Date.now() + 60_000 }),
});
ok(
  'PATCH /api/me rejeita campos de assinatura do cliente',
  subscriptionAttempt.status === 400,
  `status ${subscriptionAttempt.status}`
);

/*
 * O runner usa um banco temporário isolado. Só alteramos a assinatura nesse
 * ambiente; smoke.mjs pode ser executado contra dev/produção sem mutá-los.
 */
const isolatedDataDir = process.env.VIBRA_DATA_DIR ? path.resolve(process.env.VIBRA_DATA_DIR) : '';
const isolatedDbPath = isolatedDataDir ? path.join(isolatedDataDir, 'vibra.db') : '';
const canMutateIsolatedUser =
  process.env.NODE_ENV === 'test' &&
  Boolean(isolatedDbPath) &&
  existsSync(isolatedDbPath) &&
  path.dirname(isolatedDataDir) === path.resolve(os.tmpdir());

if (canMutateIsolatedUser) {
  const testDb = new DatabaseSync(isolatedDbPath);
  testDb.exec('PRAGMA busy_timeout = 5000');
  const userId = me.data.user.id;
  try {
    testDb
      .prepare("UPDATE users SET subscription_status = 'active', subscription_ends_at = ?, theme_palette = 'orange' WHERE id = ?")
      .run(Date.now() + 60 * 60 * 1000, userId);

    const subscriberMe = await api('/api/me');
    ok(
      'assinatura ativa recebe capability de personalização',
      subscriberMe.status === 200 &&
        subscriberMe.data.user.canCustomizeTheme === true &&
        subscriberMe.data.user.themePalette === 'orange'
    );

    const subscriberPalette = await api('/api/me/theme-palette', {
      method: 'PATCH',
      body: JSON.stringify({ palette: 'blue' }),
    });
    ok(
      'assinatura ativa persiste paleta allow-listed',
      subscriberPalette.status === 200 &&
        subscriberPalette.data.user.themePalette === 'blue' &&
        subscriberPalette.data.themePalette === 'blue'
    );

    testDb
      .prepare("UPDATE users SET subscription_status = 'active', subscription_ends_at = ?, theme_palette = 'blue' WHERE id = ?")
      .run(Date.now() - 1000, userId);

    const expiredMe = await api('/api/me');
    ok(
      'assinatura expirada perde capability e volta ao orange',
      expiredMe.status === 200 &&
        expiredMe.data.user.canCustomizeTheme === false &&
        expiredMe.data.user.themePalette === 'orange' &&
        expiredMe.data.themePalette === 'orange'
    );

    const expiredPalette = await api('/api/me/theme-palette', {
      method: 'PATCH',
      body: JSON.stringify({ palette: 'green' }),
    });
    ok('assinatura expirada não altera a paleta', expiredPalette.status === 403, `status ${expiredPalette.status}`);

    const storedExpiredPalette = testDb.prepare('SELECT theme_palette FROM users WHERE id = ?').get(userId);
    ok('paleta expirada é removida no banco', storedExpiredPalette.theme_palette === 'orange');
  } finally {
    testDb
      .prepare("UPDATE users SET subscription_status = 'free', subscription_ends_at = NULL, theme_palette = 'orange' WHERE id = ?")
      .run(me.data.user.id);
    testDb.close();
  }
} else {
  console.log('SKIP  cobertura de assinante exige banco temporário isolado');
}

/* --- edição de conta: username imutável e persistência de nome/bio --- */
const originalUsername = me.data.user.username;
const originalAvatar = me.data.user.avatar;
const originalInterests = me.data.user.interests;

const usernameAttempt = await api('/api/me', {
  method: 'PATCH',
  body: JSON.stringify({ username: 'vibra-editado' }),
});
ok(
  'PATCH /api/me rejeita alteração de username',
  usernameAttempt.status === 400 || usernameAttempt.status === 422,
  `status ${usernameAttempt.status}`
);

const userIdAttempt = await api('/api/me', {
  method: 'PATCH',
  body: JSON.stringify({ user_id: 99 }),
});
ok(
  'PATCH /api/me rejeita user_id do cliente',
  userIdAttempt.status === 400 || userIdAttempt.status === 422,
  `status ${userIdAttempt.status}`
);

const usernameAfter = await api('/api/me');
ok(
  'username permanece inalterado no banco',
  usernameAfter.status === 200 && usernameAfter.data.user.username === originalUsername
);

const otherProfileAttempt = await api('/api/users/ana.souza', {
  method: 'PATCH',
  body: JSON.stringify({ name: 'Invadido' }),
});
ok(
  'não é possível editar perfil de outra pessoa',
  otherProfileAttempt.status === 403 || otherProfileAttempt.status === 404,
  `status ${otherProfileAttempt.status}`
);

const otherProfileIntact = await api('/api/users/ana.souza');
ok(
  'perfil de outra pessoa permanece intacto',
  otherProfileIntact.status === 200 && otherProfileIntact.data.user.name !== 'Invadido'
);

const nameBioUpdate = await api('/api/me', {
  method: 'PATCH',
  body: JSON.stringify({ name: '  Vibra   Teste  ', bio: 'Bio de teste automatizado.' }),
});
ok(
  'nome e bio são salvos e normalizados',
  nameBioUpdate.status === 200 &&
    nameBioUpdate.data.user.name === 'Vibra Teste' &&
    nameBioUpdate.data.user.bio === 'Bio de teste automatizado.'
);

const meAfterEdit = await api('/api/me');
ok(
  'nome e bio persistem no banco',
  meAfterEdit.status === 200 &&
    meAfterEdit.data.user.name === 'Vibra Teste' &&
    meAfterEdit.data.user.bio === 'Bio de teste automatizado.'
);

ok(
  'salvar conta não apaga foto nem interesses',
  meAfterEdit.data.user.avatar === originalAvatar &&
    JSON.stringify(meAfterEdit.data.user.interests) === JSON.stringify(originalInterests)
);

const bioTooLong = await api('/api/me', {
  method: 'PATCH',
  body: JSON.stringify({ bio: 'x'.repeat(151) }),
});
ok('bio acima do limite é rejeitada', bioTooLong.status === 400, `status ${bioTooLong.status}`);

const bioWithControl = await api('/api/me', {
  method: 'PATCH',
  body: JSON.stringify({ bio: 'texto\u0007invalido' }),
});
ok('bio com caractere de controle é rejeitada', bioWithControl.status === 400, `status ${bioWithControl.status}`);

const nameWithControl = await api('/api/me', {
  method: 'PATCH',
  body: JSON.stringify({ name: 'Vibra\u0007z' }),
});
ok('nome com caractere de controle é rejeitado', nameWithControl.status === 400, `status ${nameWithControl.status}`);

const emptyName = await api('/api/me', {
  method: 'PATCH',
  body: JSON.stringify({ name: '   ' }),
});
ok('nome vazio é rejeitado', emptyName.status === 400, `status ${emptyName.status}`);

await api('/api/me', {
  method: 'PATCH',
  body: JSON.stringify({ name: originalUsername === 'vibra' ? 'Vibra' : originalUsername, bio: 'Seu cantinho visual. Compartilhe o que te inspira.' }),
});

const feed = await api('/api/feed');
ok('feed carregado', feed.status === 200 && feed.data.posts.length >= 7, `${feed.data.posts.length} posts`);
ok('feed com autor e contagem', feed.data.posts.every((post) => post.user && typeof post.likes === 'number'));

const explore = await api('/api/explore');
ok('descobrir carregado', explore.status === 200 && explore.data.posts.length >= 9);

const stories = await api('/api/stories');
ok('stories carregados', stories.status === 200 && stories.data.groups.length >= 3);

const searchAll = await api('/api/search?q=');
ok('busca vazia lista pessoas', searchAll.status === 200 && searchAll.data.users.length >= 5);

const searchAna = await api('/api/search?q=ana');
ok('busca por nome', searchAna.status === 200 && searchAna.data.users.some((u) => u.username === 'ana.souza'));

const ana = await api('/api/users/ana.souza');
ok('perfil de terceiro', ana.status === 200 && ana.data.user.username === 'ana.souza');
const followBefore = ana.data.isFollowing;
const followed = await api('/api/users/ana.souza/follow', { method: 'POST' });
ok('seguir/deixar de seguir', followed.status === 200 && followed.data.isFollowing === !followBefore);
await api('/api/users/ana.souza/follow', { method: 'POST' });

const postId = feed.data.posts.find((post) => post.user.id !== 1)?.id || feed.data.posts[0].id;
const postBefore = await api(`/api/posts/${postId}`);
const like = await api(`/api/posts/${postId}/like`, { method: 'POST' });
ok('curtir publicação', like.status === 200 && like.data.liked !== postBefore.data.post.liked);

/* --- aba de curtidas do perfil ------------------------------------- */
/* A curtida é alternada, então o estado final é normalizado para "curtida"
   antes de consultar a lista, e restaurado ao final do teste. */
if (!like.data.liked) {
  await api(`/api/posts/${postId}/like`, { method: 'POST' });
}
const myLikes = await api(`/api/users/${me.data.user.username}/likes`);
ok(
  'lista de curtidas do próprio perfil',
  myLikes.status === 200 && Array.isArray(myLikes.data.posts) && myLikes.data.posts.some((p) => p.id === postId),
  `${myLikes.data?.posts?.length ?? 0} curtidas`
);
ok(
  'curtidas trazem dados da publicação',
  myLikes.data.posts.every((p) => p.id && p.user && typeof p.likes === 'number')
);
const otherLikes = await api('/api/users/ana.souza/likes');
ok('curtidas de terceiro são privadas', otherLikes.status === 403);
const missingLikes = await api('/api/users/usuario-inexistente/likes');
ok('curtidas de perfil inexistente', missingLikes.status === 404);

if (!like.data.liked) {
  await api(`/api/posts/${postId}/like`, { method: 'POST' });
}

const comment = await api(`/api/posts/${postId}/comments`, {
  method: 'POST',
  body: JSON.stringify({ text: 'Comentário do teste automatizado.' }),
});
ok('comentar', comment.status === 201 && comment.data.comment.text === 'Comentário do teste automatizado.');
const removedComment = await api(`/api/comments/${comment.data.comment.id}`, { method: 'DELETE' });
ok('apagar comentário', removedComment.status === 200);

const created = await api('/api/posts', {
  method: 'POST',
  body: JSON.stringify({ image: PNG, caption: 'Post do teste automatizado.' }),
});
ok('criar publicação', created.status === 201 && created.data.post.caption === 'Post do teste automatizado.');
const createdPostId = created.data.post.id;
const deleted = await api(`/api/posts/${createdPostId}`, { method: 'DELETE' });
ok('apagar publicação', deleted.status === 200);

const carousel = await api('/api/posts', {
  method: 'POST',
  body: JSON.stringify({ images: [PNG, PNG, PNG], caption: 'Carrossel do teste automatizado.' }),
});
ok(
  'criar carrossel',
  carousel.status === 201 && carousel.data.post.media.length === 3 && String(carousel.data.post.image).startsWith('/uploads/'),
  `${carousel.data?.post?.media?.length ?? 0} mídias`
);
const carouselPostId = carousel.data.post.id;
const carouselDetail = await api(`/api/posts/${carouselPostId}`);
ok('carrossel persiste no detalhe', carouselDetail.status === 200 && carouselDetail.data.post.media.length === 3);
const tooMany = await api('/api/posts', {
  method: 'POST',
  body: JSON.stringify({ images: Array(11).fill(PNG), caption: 'Acima do limite.' }),
});
ok('limite de 10 fotos', tooMany.status === 400);
const deletedCarousel = await api(`/api/posts/${carouselPostId}`, { method: 'DELETE' });
ok('apagar carrossel', deletedCarousel.status === 200);

const videoUpload = await fetch(BASE + '/api/uploads/video', {
  method: 'POST',
  headers: { Cookie: cookie, 'Content-Type': 'video/mp4' },
  body: Buffer.from('fake-mp4-data-for-upload-test'),
});
const videoData = await videoUpload.json();
ok(
  'upload de vídeo em fluxo',
  videoUpload.status === 201 && String(videoData.url).startsWith('/uploads/video-'),
  videoData.url
);
const videoPost = await api('/api/posts', {
  method: 'POST',
  body: JSON.stringify({ videoUrl: videoData.url, caption: 'Vídeo do teste automatizado.' }),
});
ok(
  'criar publicação com vídeo',
  videoPost.status === 201 &&
    videoPost.data.post.mediaType === 'video' &&
    videoPost.data.post.media[0].url === videoData.url
);
const deletedVideoPost = await api(`/api/posts/${videoPost.data.post.id}`, { method: 'DELETE' });
ok('apagar publicação com vídeo', deletedVideoPost.status === 200);
await new Promise((resolve) => setTimeout(resolve, 150));
const videoFile = await fetch(BASE + videoData.url);
ok('remover arquivo do vídeo', videoFile.status === 404);

const story = await api('/api/stories', {
  method: 'POST',
  body: JSON.stringify({ image: PNG }),
});
ok('criar story', story.status === 201 && !!story.data.story.id);
const storyId = story.data.story.id;
const storiesAfter = await api('/api/stories');
const ownStory = storiesAfter.data.groups.find((group) => group.user.id === 1);
ok('story aparece no feed', !!ownStory && ownStory.stories.some((item) => item.id === storyId));
const deletedStory = await api(`/api/stories/${storyId}`, { method: 'DELETE' });
ok('apagar story', deletedStory.status === 200);

const dating = await api('/api/dating/status');
ok('namoro elegível', dating.status === 200 && dating.data.verification.allowed === true && !!dating.data.profile);

const discover = await api('/api/dating/discover');
ok('namoro com descobertas', discover.status === 200 && discover.data.profiles.length >= 3);

const matches = await api('/api/dating/matches');
ok('matches do namoro', matches.status === 200 && matches.data.matches.length >= 1);

const radar = await api('/api/dating/radar');
ok('radar do namoro', radar.status === 200 && Array.isArray(radar.data.matches));

const conversations = await api('/api/conversations');
ok('conversas carregadas', conversations.status === 200 && conversations.data.conversations.length >= 2);
const thread = await api(`/api/conversations/${conversations.data.conversations[0].id}`);
ok('thread carregada', thread.status === 200 && thread.data.messages.length >= 1);

const notifications = await api('/api/notifications');
ok('notificações carregadas', notifications.status === 200 && notifications.data.notifications.length >= 1);

/* ------------------------------------------------------------------ */
/* Perfil privado e solicitações de seguimento                        */
/* ------------------------------------------------------------------ */
function makeClient() {
  let cookie = '';
  return async function clientApi(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    if (options.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(BASE + path, { ...options, headers });
    for (const value of res.headers.getSetCookie?.() || []) {
      const pair = value.split(';')[0];
      if (pair.startsWith('vibra_session=')) cookie = pair.endsWith('=') ? '' : pair;
    }
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: res.status, data };
  };
}

const anaClient = makeClient();
const brunoClient = makeClient();
const anaLogin = await anaClient('/api/login', {
  method: 'POST',
  body: JSON.stringify({ username: 'ana.souza', password: DEMO_PASSWORD }),
});
ok('login ana para privacidade', anaLogin.status === 200 && anaLogin.data.user.username === 'ana.souza');

const brunoLogin = await brunoClient('/api/login', {
  method: 'POST',
  body: JSON.stringify({ username: 'bruno.dev', password: DEMO_PASSWORD }),
});
ok('login bruno para privacidade', brunoLogin.status === 200 && brunoLogin.data.user.username === 'bruno.dev');

const brunoInitialProfile = await brunoClient('/api/users/ana.souza');
if (brunoInitialProfile.data.isFollowing) {
  await brunoClient('/api/users/ana.souza/follow', { method: 'POST' });
}

const anaPrivate = await anaClient('/api/me', {
  method: 'PATCH',
  body: JSON.stringify({ isPrivate: true }),
});
ok('ativar perfil privado da ana', anaPrivate.status === 200 && anaPrivate.data.user.isPrivate === true);

const anaPrivatePost = await anaClient('/api/posts', {
  method: 'POST',
  body: JSON.stringify({ image: PNG, caption: 'Post privado do smoke.' }),
});
ok('criar post privado', anaPrivatePost.status === 201);
const anaPrivatePostId = anaPrivatePost.data.post.id;

const anaPrivateStory = await anaClient('/api/stories', {
  method: 'POST',
  body: JSON.stringify({ image: PNG }),
});
ok('criar story privado', anaPrivateStory.status === 201);
const anaPrivateStoryId = anaPrivateStory.data.story.id;

const anaProfileAsBruno = await brunoClient('/api/users/ana.souza');
ok(
  'perfil privado oculta publicações',
  anaProfileAsBruno.status === 200 &&
    anaProfileAsBruno.data.user.isPrivate === true &&
    anaProfileAsBruno.data.canViewContent === false &&
    anaProfileAsBruno.data.posts.length === 0
);

const exploreBeforePrivacy = await brunoClient('/api/explore');
ok(
  'post privado fora do explorar',
  exploreBeforePrivacy.status === 200 &&
    !exploreBeforePrivacy.data.posts.some((post) => post.id === anaPrivatePostId)
);

const storiesBeforePrivacy = await brunoClient('/api/stories');
ok(
  'story privado oculto',
  storiesBeforePrivacy.status === 200 &&
    !storiesBeforePrivacy.data.groups.some((group) => group.user.id === anaLogin.data.user.id)
);

const directBeforePrivacy = await brunoClient(`/api/posts/${anaPrivatePostId}`);
ok('acesso direto ao post privado bloqueado', directBeforePrivacy.status === 403);

const anaProfileBeforeFollow = await brunoClient('/api/users/ana.souza');
if (anaProfileBeforeFollow.data.isFollowing) {
  await brunoClient('/api/users/ana.souza/follow', { method: 'POST' });
}
const followRequest = await brunoClient('/api/users/ana.souza/follow', { method: 'POST' });
ok('enviar solicitação para perfil privado', followRequest.status === 200 && followRequest.data.requested === true);

const cancelRequest = await brunoClient('/api/users/ana.souza/follow', { method: 'POST' });
ok('cancelar solicitação pendente', cancelRequest.status === 200 && cancelRequest.data.cancelled === true);

await brunoClient('/api/users/ana.souza/follow', { method: 'POST' });
const inbox = await anaClient('/api/follow-requests');
ok('listar solicitações pendentes', inbox.status === 200 && inbox.data.requests.some((request) => request.user.username === 'bruno.dev'));
const requestId = inbox.data.requests.find((request) => request.user.username === 'bruno.dev')?.id;
ok('contador pendente no /api/me', (await anaClient('/api/me')).data.pendingFollowRequests >= 1);

const acceptedRequest = await anaClient(`/api/follow-requests/${requestId}/accept`, { method: 'POST' });
ok('aceitar solicitação', acceptedRequest.status === 200 && acceptedRequest.data.accepted === true);

const afterAccept = await brunoClient('/api/users/ana.souza');
ok(
  'seguidor aprovado vê conteúdo privado',
  afterAccept.status === 200 &&
    afterAccept.data.isFollowing === true &&
    afterAccept.data.canViewContent === true &&
    afterAccept.data.posts.some((post) => post.id === anaPrivatePostId)
);

const directAfterPrivacy = await brunoClient(`/api/posts/${anaPrivatePostId}`);
ok('acesso direto liberado após aceite', directAfterPrivacy.status === 200);

const exploreAfterPrivacy = await brunoClient('/api/explore');
ok(
  'post privado aparece no explorar após aceite',
  exploreAfterPrivacy.status === 200 && exploreAfterPrivacy.data.posts.some((post) => post.id === anaPrivatePostId)
);

const storiesAfterPrivacy = await brunoClient('/api/stories');
ok(
  'story privado aparece após aceite',
  storiesAfterPrivacy.status === 200 && storiesAfterPrivacy.data.groups.some((group) => group.user.id === anaLogin.data.user.id)
);

const rejectSetup = await brunoClient('/api/users/ana.souza/follow', { method: 'POST' });
ok('deixar de seguir para testar recusa', rejectSetup.status === 200 && rejectSetup.data.isFollowing === false);

await anaClient('/api/me', { method: 'PATCH', body: JSON.stringify({ isPrivate: true }) });
await brunoClient('/api/users/ana.souza/follow', { method: 'POST' });
const inbox2 = await anaClient('/api/follow-requests');
const requestId2 = inbox2.data.requests.find((request) => request.user.username === 'bruno.dev')?.id;
const rejectedRequest = await anaClient(`/api/follow-requests/${requestId2}/reject`, { method: 'POST' });
ok('recusar solicitação', rejectedRequest.status === 200 && rejectedRequest.data.accepted === false);

const afterReject = await brunoClient('/api/users/ana.souza');
ok(
  'recusado não segue e não vê conteúdo',
  afterReject.status === 200 &&
    afterReject.data.isFollowing === false &&
    afterReject.data.canViewContent === false &&
    afterReject.data.posts.length === 0
);

await brunoClient('/api/users/ana.souza/follow', { method: 'POST' });
const autoAccept = await anaClient('/api/me', { method: 'PATCH', body: JSON.stringify({ isPrivate: false }) });
ok('voltar a público auto-aceita pendentes', autoAccept.status === 200 && autoAccept.data.pendingFollowRequests === 0);

const autoAccepted = await brunoClient('/api/users/ana.souza');
ok('auto-aceite mantém seguidor', autoAccepted.status === 200 && autoAccepted.data.isFollowing === true && autoAccepted.data.canViewContent === true);

const deletedPrivatePost = await anaClient(`/api/posts/${anaPrivatePostId}`, { method: 'DELETE' });
ok('apagar post privado de teste', deletedPrivatePost.status === 200);

const deletedPrivateStory = await anaClient(`/api/stories/${anaPrivateStoryId}`, { method: 'DELETE' });
ok('apagar story privado de teste', deletedPrivateStory.status === 200);

/* --- segurança: dispositivos conectados e sessões abertas --- */
const sessions = await api('/api/sessions');
const sessionList = Array.isArray(sessions.data?.sessions) ? sessions.data.sessions : [];
const currentSession = sessionList.find((session) => session.current);
ok('lista de sessões abertas', sessions.status === 200 && sessionList.length > 0);
ok('sessão atual destacada', Boolean(currentSession));
ok(
  'sessão informa o dispositivo',
  Boolean(currentSession && typeof currentSession.device === 'string' && currentSession.device.trim().length > 0),
  currentSession?.device || '',
);
ok(
  'sessão informa a data de início',
  Boolean(currentSession && Number.isFinite(currentSession.createdAt)),
);

const revokeCurrent = await api(`/api/sessions/${encodeURIComponent(currentSession?.id || '')}`, { method: 'DELETE' });
ok('sessão atual não é encerrada pelo atalho', revokeCurrent.status === 400);

const logout = await api('/api/logout', { method: 'POST' });
ok('logout', logout.status === 200);
const meAfter = await api('/api/me');
ok('sessão encerrada', meAfter.status === 401);

console.log(process.exitCode ? '\nFALHAS ENCONTRADAS' : '\nTODOS OS TESTES PASSARAM');
