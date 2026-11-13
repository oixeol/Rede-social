/**
 * QA: Espaços, Canais e Mensagens de Chat.
 * Cobre: CRUD de espaços, canais públicos/privados, membros, mensagens, anexos,
 * paginação estável, SSE e permissões.
 */
import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { pngDataUrl, pdfDataUrl } from './fixtures/message-attachments.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const DEMO_PASSWORD = process.env.VIBRA_DEMO_PASSWORD || '';
const cookies = new Map();
let failures = 0;

function ok(label, condition, detail = '') {
  if (!condition) {
    failures += 1;
    console.error(`  [FAIL] ${label}${detail ? ': ' + detail : ''}`);
  } else {
    console.log(`  [OK]   ${label}`);
  }
}

function cookieHeader(user) {
  return cookies.get(user) || '';
}

async function api(path, options = {}) {
  const user = options.user || 'vibra';
  const headers = { ...(options.headers || {}) };
  const cookie = cookieHeader(user);
  if (cookie) headers.Cookie = cookie;
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(BASE + path, { ...options, headers });
  const setCookie = res.headers.getSetCookie?.() || [];
  for (const value of setCookie) {
    const pair = value.split(';')[0];
    if (pair.startsWith('vibra_session=')) {
      cookies.set(user, pair.endsWith('=') ? '' : pair);
    }
  }
  let body = null;
  const text = await res.text();
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body, headers: res.headers };
}

async function login(username) {
  cookies.delete(username);
  const { status } = await api('/api/login', {
    user: username,
    method: 'POST',
    body: { username, password: DEMO_PASSWORD }
  });
  return status === 200;
}

function parseSseBlock(block) {
  const event = /^event:\s*(.+)$/m.exec(block)?.[1]?.trim() || 'message';
  const data = /^data:\s*(.+)$/m.exec(block)?.[1]?.trim() || '';
  if (!data) return null;
  try {
    const envelope = JSON.parse(data);
    return { event, envelope };
  } catch {
    return null;
  }
}

async function openSse(user) {
  const controller = new AbortController();
  const response = await fetch(BASE + '/api/events', {
    headers: { Cookie: cookieHeader(user) },
    signal: controller.signal
  });
  const reader = response.body?.getReader();
  const events = [];
  const pending = [];
  let buffer = '';
  let ended = false;

  const pump = (async () => {
    if (!reader) return;
    try {
      while (!ended) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += Buffer.from(value).toString('utf8');
        let split;
        while ((split = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const parsed = parseSseBlock(block);
          if (!parsed) continue;
          events.push(parsed);
          const waiter = pending.shift();
          if (waiter) waiter.resolve(parsed);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    }
  })();

  const nextEvent = async (timeoutMs = 2000) => {
    if (events.length) return events.shift();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = pending.findIndex((entry) => entry.timer === timer);
        if (index >= 0) pending.splice(index, 1);
        reject(new Error('Timeout aguardando evento SSE.'));
      }, timeoutMs);
      pending.push({ timer, resolve });
    });
  };

  return {
    response,
    events,
    nextEvent,
    async close() {
      ended = true;
      controller.abort();
      try { await reader?.cancel(); } catch { /* stream já encerrada */ }
      await pump.catch(() => {});
    },
  };
}

async function waitForStatus(responsePromise, expected, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await responsePromise;
    if (response.status === expected) return response;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return responsePromise;
}

async function run() {
  console.log('--- Chat Spaces QA ---');

  const users = ['vibra', 'bruno.dev', 'ana.souza'];
  for (const user of users) {
    if (!await login(user)) throw new Error(`Falha login ${user}`);
  }

  // 1. Espaços CRUD
  await login('vibra');
  const createSpace = await api('/api/spaces', {
    user: 'vibra',
    method: 'POST',
    body: { name: 'Espaço Alpha', description: 'Teste de QA' }
  });
  ok('Cria espaço', createSpace.status === 201 && createSpace.body.space.name === 'Espaço Alpha');
  const spaceId = createSpace.body.space.id;

  const listSpaces = await api('/api/spaces', { user: 'vibra' });
  ok('Lista espaços inclui novo', listSpaces.body.spaces.some((space) => space.id === spaceId));

  const updateSpace = await api(`/api/spaces/${spaceId}`, {
    user: 'vibra',
    method: 'PATCH',
    body: { description: 'Descrição Alpha' }
  });
  ok('Edita espaço', updateSpace.status === 200 && updateSpace.body.space.description === 'Descrição Alpha');

  const invalidSpace = await api('/api/spaces', {
    user: 'vibra',
    method: 'POST',
    body: { name: 'x' }
  });
  ok('Rejeita nome de espaço inválido', invalidSpace.status === 400);

  // 2. Membros do Espaço
  const addMember = await api(`/api/spaces/${spaceId}/members`, {
    user: 'vibra',
    method: 'POST',
    body: { username: 'bruno.dev' }
  });
  ok('Adiciona membro ao espaço', addMember.status === 201);

  const addCrossMember = await api(`/api/spaces/${spaceId}/members`, {
    user: 'bruno.dev',
    method: 'POST',
    body: { username: 'ana.souza' }
  });
  ok('Membro comum não adiciona outro membro', addCrossMember.status === 403);

  // 3. Canais (Público/Privado)
  const createPublic = await api(`/api/spaces/${spaceId}/channels`, {
    user: 'vibra',
    method: 'POST',
    body: { name: 'Geral', visibility: 'public' }
  });
  ok('Cria canal público', createPublic.status === 201);
  const publicId = createPublic.body.channel.id;

  const createPrivate = await api(`/api/spaces/${spaceId}/channels`, {
    user: 'vibra',
    method: 'POST',
    body: { name: 'Segredo', visibility: 'private' }
  });
  ok('Cria canal privado', createPrivate.status === 201);
  const privateId = createPrivate.body.channel.id;

  const crossSpaceCreate = await api(`/api/spaces/${spaceId}/channels`, {
    user: 'ana.souza',
    method: 'POST',
    body: { name: 'Invadido' }
  });
  ok('Usuário fora do espaço não cria canal', crossSpaceCreate.status === 404);

  // 4. Mensagens e Anexos (Bruno no Geral)
  await login('bruno.dev');
  const postMsg = await api(`/api/channels/${publicId}/messages`, {
    user: 'bruno.dev',
    method: 'POST',
    body: {
      text: 'Olá mundo!',
      media: [{ fileName: 'doc.pdf', dataUrl: pdfDataUrl() }]
    }
  });
  ok('Posta mensagem com anexo no canal', postMsg.status === 201 && postMsg.body.message.media.length === 1);
  const msgId = postMsg.body.message.id;
  const attachmentUrl = postMsg.body.message.media[0]?.url;

  const outsiderMessage = await api(`/api/channels/${publicId}/messages`, {
    user: 'ana.souza',
    method: 'POST',
    body: { text: 'Invadido' }
  });
  ok('Usuário fora do espaço não posta em canal', outsiderMessage.status === 404);

  // 5. Permissões e canal privado
  const privateAccess = await api(`/api/channels/${privateId}/messages`, {
    user: 'bruno.dev'
  });
  ok('Bloqueia acesso a canal privado alheio', privateAccess.status === 404);

  await login('vibra');
  const invitePrivate = await api(`/api/channels/${privateId}/members`, {
    user: 'vibra',
    method: 'POST',
    body: { username: 'bruno.dev' }
  });
  ok('Convida membro para canal privado', invitePrivate.status === 201);

  await login('bruno.dev');
  const privateAccessOk = await api(`/api/channels/${privateId}/messages`, {
    user: 'bruno.dev'
  });
  ok('Permite acesso após convite', privateAccessOk.status === 200);

  // 6. Edição/Exclusão: somente autor
  const editOther = await api(`/api/channel-messages/${msgId}`, {
    user: 'vibra',
    method: 'PATCH',
    body: { text: 'Invadido' }
  });
  ok('Outro usuário não edita mensagem', editOther.status === 404);

  const editMsg = await api(`/api/channel-messages/${msgId}`, {
    user: 'bruno.dev',
    method: 'PATCH',
    body: { text: 'Editado' }
  });
  ok('Edita própria mensagem', editMsg.status === 200 && editMsg.body.message.editedAt !== null);

  const wrongParent = await api(`/api/channels/${privateId}/messages/${msgId}`, {
    user: 'bruno.dev',
    method: 'PATCH',
    body: { text: 'Invadido' }
  });
  ok('Rejeita parent de canal inconsistente', wrongParent.status === 404);

  const deleteOther = await api(`/api/channel-messages/${msgId}`, {
    user: 'vibra',
    method: 'DELETE'
  });
  ok('Outro usuário não apaga mensagem', deleteOther.status === 404);

  const deleteMsg = await api(`/api/channel-messages/${msgId}`, {
    user: 'bruno.dev',
    method: 'DELETE'
  });
  ok('Apaga própria mensagem (soft delete)', deleteMsg.status === 200 && deleteMsg.body.message.deletedAt !== null);
  ok('Mensagem apagada não expõe corpo', deleteMsg.body.message.body === '' && deleteMsg.body.message.media.length === 0);

  // 7. Paginação e stable cursor
  for (let index = 0; index < 5; index += 1) {
    await api(`/api/channels/${publicId}/messages`, {
      user: 'bruno.dev',
      method: 'POST',
      body: { text: `Msg ${index}` }
    });
  }
  const page1 = await api(`/api/channels/${publicId}/messages?limit=2`, { user: 'bruno.dev' });
  ok('Paginação: primeira página', page1.body.messages.length === 2 && page1.body.nextCursor !== null);
  const page2 = await api(`/api/channels/${publicId}/messages?limit=2&before=${page1.body.nextCursor}`, {
    user: 'bruno.dev'
  });
  ok('Paginação: segunda página com cursor', page2.body.messages.length === 2);
  const firstIds = page1.body.messages.map((message) => message.id);
  const secondIds = page2.body.messages.map((message) => message.id);
  ok('Paginação: sem duplicatas', firstIds.every((id) => !secondIds.includes(id)));
  ok('Paginação: ordem cronológica', firstIds[0] < firstIds[1] && secondIds[0] < secondIds[1]);
  ok(
    'Paginação: cursor aponta mensagem mais antiga',
    page1.body.nextCursor === firstIds[0] && page2.body.nextCursor === secondIds[0]
  );
  const invalidCursor = await api(`/api/channels/${publicId}/messages?before=abc`, { user: 'bruno.dev' });
  ok('Paginação: cursor inválido rejeitado', invalidCursor.status === 400);

  // 8. Anexo exige canal + espaço
  const liveAttachment = await api(`/api/channels/${publicId}/messages`, {
    user: 'bruno.dev',
    method: 'POST',
    body: {
      text: 'Anexo vivo',
      media: [{ fileName: 'canal.pdf', dataUrl: pdfDataUrl() }]
    }
  });
  const liveAttachmentUrl = liveAttachment.body.message?.media?.[0]?.url;
  if (liveAttachmentUrl) {
    const attachmentAllowed = await fetch(BASE + liveAttachmentUrl, {
      headers: { Cookie: cookieHeader('bruno.dev') }
    });
    ok('Anexo de canal acessível ao membro', attachmentAllowed.status === 200);
    const attachmentDenied = await fetch(BASE + liveAttachmentUrl, {
      headers: { Cookie: cookieHeader('ana.souza') }
    });
    ok('Anexo de canal negado a não membro', attachmentDenied.status === 404);
  } else {
    ok('Anexo de canal acessível ao membro', false, 'URL de anexo ausente');
    ok('Anexo de canal negado a não membro', false, 'URL de anexo ausente');
  }

  // 8b. Rollback de anexo em canal não deixa arquivos órfãos
  const isolatedDataDir = process.env.VIBRA_DATA_DIR ? path.resolve(process.env.VIBRA_DATA_DIR) : '';
  const isolatedDbPath = isolatedDataDir ? path.join(isolatedDataDir, 'vibra.db') : '';
  const uploadsDir = isolatedDataDir ? path.join(isolatedDataDir, 'uploads') : '';
  const stagingDir = isolatedDataDir ? path.join(isolatedDataDir, 'staging') : '';
  const canForceRollback =
    process.env.NODE_ENV === 'test' &&
    Boolean(isolatedDbPath) &&
    existsSync(isolatedDbPath) &&
    path.dirname(isolatedDataDir) === path.resolve(os.tmpdir());

  if (canForceRollback) {
    const testDb = new DatabaseSync(isolatedDbPath);
    testDb.exec('PRAGMA busy_timeout = 5000');
    const filesBefore = existsSync(uploadsDir) ? readdirSync(uploadsDir).length : 0;
    const stagedBefore = existsSync(stagingDir) ? readdirSync(stagingDir).length : 0;
    const messagesBefore = Number(
      testDb.prepare('SELECT COUNT(*) AS n FROM chat_messages WHERE channel_id = ?').get(publicId)?.n || 0
    );
    try {
      testDb.exec(
        "CREATE TRIGGER qa_fail_chat_message_media BEFORE INSERT ON chat_message_media BEGIN SELECT RAISE(ABORT, 'forced failure'); END;"
      );
      const rollback = await api(`/api/channels/${publicId}/messages`, {
        user: 'bruno.dev',
        method: 'POST',
        body: {
          text: 'rollback de canal',
          media: [{ fileName: 'rollback-canal.png', dataUrl: pngDataUrl() }]
        }
      });
      ok('Falha de persistência de anexo em canal retorna erro', rollback.status >= 400);
      const messagesAfter = Number(
        testDb.prepare('SELECT COUNT(*) AS n FROM chat_messages WHERE channel_id = ?').get(publicId)?.n || 0
      );
      ok('Rollback remove mensagem de canal', messagesAfter === messagesBefore);
      const filesAfter = existsSync(uploadsDir) ? readdirSync(uploadsDir).length : 0;
      ok('Rollback não deixa anexo final órfão', filesAfter === filesBefore);
      const stagedAfter = existsSync(stagingDir) ? readdirSync(stagingDir).length : 0;
      ok('Rollback não deixa anexo staged órfão', stagedAfter === stagedBefore);
    } finally {
      try {
        testDb.exec('DROP TRIGGER IF EXISTS qa_fail_chat_message_media;');
      } catch {
        /* trigger já removido */
      }
      testDb.close();
    }
  } else {
    console.log('  [SKIP] Rollback de anexo em canal exige banco temporário isolado');
  }

  // 8c. Remoção de membros de espaço e canal
  await login('vibra');
  const anaUserProfile = await api('/api/users/ana.souza', { user: 'vibra' });
  ok('Perfil de ana disponível', anaUserProfile.status === 200);
  const anaId = anaUserProfile.body.user.id;
  const brunoUserProfile = await api('/api/users/bruno.dev', { user: 'vibra' });
  ok('Perfil de bruno disponível', brunoUserProfile.status === 200);
  const brunoId = brunoUserProfile.body.user.id;
  const ownerUserProfile = await api('/api/users/vibra', { user: 'vibra' });
  ok('Perfil do owner disponível', ownerUserProfile.status === 200);
  const ownerId = ownerUserProfile.body.user.id;

  // Owner adds ana to space
  const addAna = await api(`/api/spaces/${spaceId}/members`, {
    user: 'vibra',
    method: 'POST',
    body: { username: 'ana.souza' }
  });
  ok('Dono adiciona ana ao espaço', addAna.status === 201);

  // Plain member (bruno) cannot remove member from space
  const memberRemovesMember = await api(`/api/spaces/${spaceId}/members/${anaId}`, {
    user: 'bruno.dev',
    method: 'DELETE'
  });
  ok('Membro comum não remove membro do espaço', memberRemovesMember.status === 403);

  // Owner removes ana from space
  const ownerRemovesAna = await api(`/api/spaces/${spaceId}/members/${anaId}`, {
    user: 'vibra',
    method: 'DELETE'
  });
  ok('Dono remove membro do espaço', ownerRemovesAna.status === 200);

  // Ana loses space access
  const anaAfterRemoval = await api(`/api/spaces/${spaceId}`, { user: 'ana.souza' });
  ok('Membro removido perde acesso ao espaço', anaAfterRemoval.status === 404);

  // Owner cannot be removed (including self)
  const ownerRemoval = await api(`/api/spaces/${spaceId}/members/${ownerId}`, {
    user: 'vibra',
    method: 'DELETE'
  });
  ok('Proprietário do espaço não é removido', ownerRemoval.status === 403);

  // Re-add ana for channel invite
  const reAddAna = await api(`/api/spaces/${spaceId}/members`, {
    user: 'vibra',
    method: 'POST',
    body: { username: 'ana.souza' }
  });
  ok('Re-adiciona ana para teste de canal', reAddAna.status === 201);

  // Owner invites ana to private channel
  const inviteAnaPrivate = await api(`/api/channels/${privateId}/members`, {
    user: 'vibra',
    method: 'POST',
    body: { username: 'ana.souza' }
  });
  ok('Dono convida ana para canal privado', inviteAnaPrivate.status === 201);

  // Plain member bruno cannot remove member from channel
  const channelMemberRemoves = await api(`/api/channels/${privateId}/members/${anaId}`, {
    user: 'bruno.dev',
    method: 'DELETE'
  });
  ok('Membro comum não remove membro do canal', channelMemberRemoves.status === 403);

  // Owner removes ana from private channel
  const ownerRemovesChannelMember = await api(`/api/channels/${privateId}/members/${anaId}`, {
    user: 'vibra',
    method: 'DELETE'
  });
  ok('Dono remove membro do canal privado', ownerRemovesChannelMember.status === 200);

  // Ana loses channel access
  const anaChannelAfter = await api(`/api/channels/${privateId}/messages`, { user: 'ana.souza' });
  ok('Membro removido do canal perde acesso', anaChannelAfter.status === 404);

  // Remove non-member from space returns 404
  const carlaProfile = await api('/api/users/carla.arte', { user: 'vibra' });
  const carlaId = carlaProfile.body.user?.id;
  const removeNonMember = await api(`/api/spaces/${spaceId}/members/${carlaId}`, {
    user: 'vibra',
    method: 'DELETE'
  });
  ok('Remoção de não-membro devolve 404', removeNonMember.status === 404);

  // Ana leaves the space so the SSE isolation check below still sees an outsider
  const ownerRemovesAnaFinal = await api(`/api/spaces/${spaceId}/members/${anaId}`, {
    user: 'vibra',
    method: 'DELETE'
  });
  ok('Dono remove ana do espaço ao final do bloco', ownerRemovesAnaFinal.status === 200);

  /* Moderador: promoção feita direto no banco isolado do teste. */
  if (canForceRollback) {
    const promoteDb = new DatabaseSync(isolatedDbPath);
    promoteDb.exec('PRAGMA busy_timeout = 5000');
    try {
      promoteDb
        .prepare('UPDATE chat_space_members SET role = ? WHERE space_id = ? AND user_id = ?')
        .run('moderator', spaceId, brunoId);
      // Re-add ana for moderator test
      await api(`/api/spaces/${spaceId}/members`, {
        user: 'vibra',
        method: 'POST',
        body: { username: 'ana.souza' }
      });
      const modRemovesAna = await api(`/api/spaces/${spaceId}/members/${anaId}`, {
        user: 'bruno.dev',
        method: 'DELETE'
      });
      ok('Moderador remove membro comum do espaço', modRemovesAna.status === 200);

      // Moderator cannot remove owner
      const modRemovesOwner = await api(`/api/spaces/${spaceId}/members/${ownerId}`, {
        user: 'bruno.dev',
        method: 'DELETE'
      });
      ok('Moderador não remove o proprietário do espaço', modRemovesOwner.status === 403);

      // Cleanup: ensure ana is removed for SSE test
      await api(`/api/spaces/${spaceId}/members/${anaId}`, {
        user: 'vibra',
        method: 'DELETE'
      });
    } finally {
      promoteDb.close();
    }
  } else {
    console.log('  [SKIP] Teste de moderador exige banco temporário isolado');
  }

  // 9. SSE: envelope, mine por destinatário e isolamento
  const brunoSse = await openSse('bruno.dev');
  const vibraSse = await openSse('vibra');
  const anaSse = await openSse('ana.souza');
  ok('SSE autenticado conecta', brunoSse.response.status === 200);
  const unauthenticatedSse = await fetch(BASE + '/api/events');
  ok('SSE sem sessão é recusado', unauthenticatedSse.status === 401);

  const ssePost = await api(`/api/channels/${publicId}/messages`, {
    user: 'bruno.dev',
    method: 'POST',
    body: { text: 'Teste SSE' }
  });
  ok('Posta durante stream SSE', ssePost.status === 201);

  const brunoEvent = await brunoSse.nextEvent();
  const vibraEvent = await vibraSse.nextEvent();
  ok('SSE: evento message.created', brunoEvent.event === 'message.created' && vibraEvent.event === 'message.created');
  ok(
    'SSE: envelope exato',
    brunoEvent.envelope.type === 'message.created' &&
      brunoEvent.envelope.payload.scope === 'channel' &&
      brunoEvent.envelope.payload.channelId === publicId &&
      brunoEvent.envelope.payload.message.id === ssePost.body.message.id
  );
  ok('SSE: mine verdadeiro no autor', brunoEvent.envelope.payload.message.mine === true);
  ok('SSE: mine falso no destinatário', vibraEvent.envelope.payload.message.mine === false);
  let anaGotMessage = false;
  try {
    const anaEvent = await anaSse.nextEvent(400);
    anaGotMessage = anaEvent.envelope.payload?.message?.id === ssePost.body.message.id;
  } catch {
    anaGotMessage = false;
  }
  ok('SSE: outsider não recebe evento de canal', !anaGotMessage);
  await brunoSse.close();
  await vibraSse.close();
  await anaSse.close();

  // 10. DM: paginação, isolamento e SSE
  const anaProfile = await api('/api/users/ana.souza', { user: 'vibra' });
  ok('Perfil de teste disponível', anaProfile.status === 200);
  const conversation = await api('/api/conversations', {
    user: 'vibra',
    method: 'POST',
    body: { username: 'ana.souza' }
  });
  ok('Cria conversa DM', conversation.status === 200 && conversation.body.conversation?.id > 0);
  const conversationId = conversation.body.conversation.id;

  for (let index = 0; index < 3; index += 1) {
    await api(`/api/conversations/${conversationId}/messages`, {
      user: 'vibra',
      method: 'POST',
      body: { text: `DM ${index}` }
    });
  }
  const dmPage = await api(`/api/conversations/${conversationId}/messages?limit=2`, { user: 'vibra' });
  ok('DM: página com nextCursor', dmPage.status === 200 && dmPage.body.messages.length === 2 && dmPage.body.nextCursor !== null);
  const dmNext = await api(`/api/conversations/${conversationId}/messages?limit=2&before=${dmPage.body.nextCursor}`, {
    user: 'vibra'
  });
  const dmFirstIds = dmPage.body.messages.map((message) => message.id);
  const dmSecondIds = dmNext.body.messages.map((message) => message.id);
  ok(
    'DM: segunda página sem duplicatas',
    dmNext.status === 200 && dmSecondIds.length > 0 && dmFirstIds.every((id) => !dmSecondIds.includes(id))
  );

  const brunoDmDenied = await api(`/api/conversations/${conversationId}/messages`, { user: 'bruno.dev' });
  ok('DM: outsider não lê conversa', brunoDmDenied.status === 404);

  const dmAuthorSse = await openSse('vibra');
  const dmRecipientSse = await openSse('ana.souza');
  const dmPost = await api(`/api/conversations/${conversationId}/messages`, {
    user: 'vibra',
    method: 'POST',
    body: { text: 'DM SSE' }
  });
  ok('DM: posta durante stream SSE', dmPost.status === 201);
  const dmAuthorEvent = await dmAuthorSse.nextEvent();
  const dmRecipientEvent = await dmRecipientSse.nextEvent();
  ok('DM SSE: evento entregue aos participantes', dmAuthorEvent.event === 'message.created' && dmRecipientEvent.event === 'message.created');
  ok('DM SSE: mine por destinatário', dmAuthorEvent.envelope.payload.message.mine === true && dmRecipientEvent.envelope.payload.message.mine === false);
  await dmAuthorSse.close();
  await dmRecipientSse.close();

  const dmEditOther = await api(`/api/conversation-messages/${dmPost.body.message.id}`, {
    user: 'ana.souza',
    method: 'PATCH',
    body: { text: 'Invadido' }
  });
  ok('DM: outro participante não edita', dmEditOther.status === 404);
  const dmEdit = await api(`/api/conversation-messages/${dmPost.body.message.id}`, {
    user: 'vibra',
    method: 'PATCH',
    body: { text: 'DM editada' }
  });
  ok('DM: autor edita mensagem', dmEdit.status === 200 && dmEdit.body.message.editedAt !== null);

  // 11. Limpeza
  await login('vibra');
  const delSpace = await api(`/api/spaces/${spaceId}`, {
    user: 'vibra',
    method: 'DELETE'
  });
  ok('Exclui espaço', delSpace.status === 200);
  const deletedRead = await api(`/api/spaces/${spaceId}`, { user: 'vibra' });
  ok('Espaço excluído não fica acessível', deletedRead.status === 404);

  if (failures > 0) {
    console.error(`\n--- Chat Spaces QA FALHOU com ${failures} erros ---`);
    process.exit(1);
  } else {
    console.log('\n--- Chat Spaces QA SUCESSO ---');
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});