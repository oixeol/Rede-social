import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChatSelection,
  chatSelectionQuery,
  mergeScopedMessages,
  nextMessageCursor,
  scopedDirectMessage,
  scopedChannelMessage,
} from '../src/lib/chat.ts';
import { parseSseEnvelope, dispatchSseEvent } from '../src/lib/chat-events.ts';

function makeParams(map: Record<string, string | null>): { get(name: string): string | null } {
  return { get: (name) => map[name] ?? null };
}

test('parseChatSelection prefere conversa quando presente', () => {
  const sel = parseChatSelection(makeParams({ conversa: '12', espaco: '5', canal: '7' }));
  assert.deepEqual(sel, { conversationId: 12, spaceId: null, channelId: null });
});

test('parseChatSelection retorna espaco e canal quando conversa ausente', () => {
  const sel = parseChatSelection(makeParams({ espaco: '3', canal: '9' }));
  assert.deepEqual(sel, { conversationId: null, spaceId: 3, channelId: 9 });
});

test('parseChatSelection retorna apenas espaco quando canal ausente', () => {
  const sel = parseChatSelection(makeParams({ espaco: '2' }));
  assert.deepEqual(sel, { conversationId: null, spaceId: 2, channelId: null });
});

test('parseChatSelection ignora conversa inválida', () => {
  const sel = parseChatSelection(makeParams({ conversa: 'abc', espaco: '1', canal: '2' }));
  assert.deepEqual(sel, { conversationId: null, spaceId: 1, channelId: 2 });
});

test('chatSelectionQuery serializa conversa apenas', () => {
  const q = chatSelectionQuery({ conversationId: 42, spaceId: 99, channelId: 88 });
  assert.equal(q, 'conversa=42');
});

test('chatSelectionQuery serializa espaco+canal', () => {
  const q = chatSelectionQuery({ conversationId: null, spaceId: 7, channelId: 11 });
  assert.equal(q, 'espaco=7&canal=11');
});

test('chatSelectionQuery serializa apenas espaco', () => {
  const q = chatSelectionQuery({ conversationId: null, spaceId: 5, channelId: null });
  assert.equal(q, 'espaco=5');
});

test('mergeScopedMessages deduplica e preserva media compartilhada', () => {
  const base: typeof scopedDirectMessage extends (a: infer A) => infer R ? R : never = {
    id: 1,
    body: 'olá',
    sender: { id: 1, username: 'u', name: 'U', avatar: null, verified: false },
    createdAt: 100,
    mine: true,
    media: [{ url: '/uploads/a.png', mediaType: 'image', mimeType: 'image/png', sizeBytes: 100, fileName: 'a.png' }],
    sharedPostId: null,
    sharedPost: null,
    editedAt: null,
    deletedAt: null,
    conversationId: 5,
  };
  const incoming = [
    { ...base, body: 'olá editado', editedAt: 101, media: [] },
    { ...base, id: 2, body: 'nova', createdAt: 102, media: [] },
  ];
  const merged = mergeScopedMessages([base], incoming);
  assert.equal(merged.length, 2);
  const first = merged.find(m => m.id === 1)!;
  assert.equal(first.body, 'olá editado');
  assert.equal(first.editedAt, 101);
  assert.equal(first.media.length, 1); // preservou media anterior
  const second = merged.find(m => m.id === 2)!;
  assert.equal(second.body, 'nova');
  assert.equal(second.media.length, 0);
});

test('nextMessageCursor avança quando cursor diferente', () => {
  assert.equal(nextMessageCursor(100, 90), 90);
  assert.equal(nextMessageCursor(null, 90), 90);
  assert.equal(nextMessageCursor(90, 90), null);
  assert.equal(nextMessageCursor(90, undefined), null);
  assert.equal(nextMessageCursor(90, null), null);
});

test('parseSseEnvelope extrai envelope JSON com type', () => {
  const data = JSON.stringify({ type: 'message.created', payload: { foo: 1 } });
  const env = parseSseEnvelope(data);
  assert(env !== null);
  assert.equal(env!.type, 'message.created');
  assert.deepEqual(env!.payload, { foo: 1 });
});

test('parseSseEnvelope usa eventType quando JSON sem type', () => {
  const data = JSON.stringify({ foo: 'bar' });
  const env = parseSseEnvelope(data, 'message.created');
  assert(env !== null);
  assert.equal(env!.type, 'message.created');
  assert.deepEqual(env!.payload, { foo: 'bar' });
});

test('dispatchSseEvent despacha channel.created', () => {
  let called = false;
  dispatchSseEvent(
    { type: 'channel.created', payload: { scope: 'space', spaceId: 1, channel: { id: 5, name: 'geral', slug: 'geral', visibility: 'public' } } },
    { onChannelCreated: (sid, ch) => { called = true; assert.equal(sid, 1); assert.equal(ch.id, 5); } }
  );
  assert(called);
});

test('dispatchSseEvent ignora channel.created privado', () => {
  let called = false;
  dispatchSseEvent(
    { type: 'channel.created', payload: { scope: 'space', spaceId: 1, channel: { id: 6, name: 'priv', slug: 'priv', visibility: 'private' } } },
    { onChannelCreated: () => { called = true; } }
  );
  assert(!called);
});

test('dispatchSseEvent channel message created/updated/deleted', () => {
  const msg = { id: 7, body: 'x', sender: { id: 1, username: 'u', name: 'U', avatar: null, verified: false }, createdAt: 100, mine: false, media: [], sharedPostId: null, sharedPost: null, editedAt: null, deletedAt: null, channelId: 3 };
  let created = false, updated = false, deleted = false;
  dispatchSseEvent(
    { type: 'message.created', payload: { scope: 'channel', spaceId: 2, channelId: 3, message: msg } },
    { onChannelMessageCreated: (sid, cid, m) => { created = true; assert.equal(sid, 2); assert.equal(cid, 3); assert.equal(m.id, 7); } }
  );
  dispatchSseEvent(
    { type: 'message.updated', payload: { scope: 'channel', spaceId: 2, channelId: 3, message: { ...msg, body: 'y', editedAt: 101 } } },
    { onChannelMessageUpdated: (sid, cid, m) => { updated = true; assert.equal(sid, 2); assert.equal(cid, 3); assert.equal(m.body, 'y'); assert.equal(m.editedAt, 101); } }
  );
  dispatchSseEvent(
    { type: 'message.deleted', payload: { scope: 'channel', spaceId: 2, channelId: 3, messageId: 7 } },
    { onChannelMessageDeleted: (sid, cid, mid) => { deleted = true; assert.equal(sid, 2); assert.equal(cid, 3); assert.equal(mid, 7); } }
  );
  assert(created && updated && deleted);
});

test('dispatchSseEvent ignora eventos de canal sem spaceId', () => {
  const msg = { id: 9, body: 'z', sender: { id: 1, username: 'u', name: 'U', avatar: null, verified: false }, createdAt: 300, mine: false, media: [], sharedPostId: null, sharedPost: null, editedAt: null, deletedAt: null, channelId: 3 };
  let called = false;
  dispatchSseEvent(
    { type: 'message.created', payload: { scope: 'channel', channelId: 3, message: msg } },
    { onChannelMessageCreated: () => { called = true; } }
  );
  dispatchSseEvent(
    { type: 'message.deleted', payload: { scope: 'channel', channelId: 3, messageId: 9 } },
    { onChannelMessageDeleted: () => { called = true; } }
  );
  assert(!called);
});

test('dispatchSseEvent conversation message created/updated/deleted', () => {
  const msg = { id: 8, body: 'dm', sender: { id: 1, username: 'u', name: 'U', avatar: null, verified: false }, createdAt: 200, mine: false, media: [], sharedPostId: null, sharedPost: null, editedAt: null, deletedAt: null, conversationId: 4 };
  let created = false, updated = false, deleted = false;
  dispatchSseEvent(
    { type: 'message.created', payload: { scope: 'conversation', conversationId: 4, message: msg } },
    { onConversationMessageCreated: (cid, m) => { created = true; assert.equal(cid, 4); assert.equal(m.id, 8); } }
  );
  dispatchSseEvent(
    { type: 'message.updated', payload: { scope: 'conversation', conversationId: 4, message: { ...msg, body: 'dm2', editedAt: 201 } } },
    { onConversationMessageUpdated: (cid, m) => { updated = true; assert.equal(cid, 4); assert.equal(m.body, 'dm2'); } }
  );
  dispatchSseEvent(
    { type: 'message.deleted', payload: { scope: 'conversation', conversationId: 4, messageId: 8 } },
    { onConversationMessageDeleted: (cid, mid) => { deleted = true; assert.equal(cid, 4); assert.equal(mid, 8); } }
  );
  assert(created && updated && deleted);
});