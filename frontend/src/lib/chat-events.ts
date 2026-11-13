import type { ScopedMessage } from './chat.ts';
import type { Channel } from './types.ts';

export interface ChatEventEnvelope {
  type: string;
  payload: unknown;
}

interface RawEnvelope {
  type?: string;
  payload?: unknown;
}

/** Tenta extrair envelope de evento SSE. */
export function parseSseEnvelope(
  data: string,
  eventType?: string,
): ChatEventEnvelope | null {
  if (!data.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const raw = parsed as RawEnvelope;
  const type = (raw.type ?? eventType ?? '').trim();
  if (!type) return null;

  return { type, payload: raw.payload ?? raw };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isMessageLike(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'number' &&
    typeof value.body === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.mine === 'boolean' &&
    isRecord(value.sender)
  );
}

function toScopedMessage(value: Record<string, unknown>): ScopedMessage {
  return {
    id: value.id as number,
    body: value.body as string,
    sender: value.sender as ScopedMessage['sender'],
    createdAt: value.createdAt as number,
    mine: value.mine as boolean,
    media: Array.isArray(value.media) ? (value.media as ScopedMessage['media']) : [],
    sharedPostId: typeof value.sharedPostId === 'number' ? value.sharedPostId : null,
    sharedPost: (value.sharedPost as ScopedMessage['sharedPost']) ?? null,
    editedAt: typeof value.editedAt === 'number' ? value.editedAt : null,
    deletedAt: typeof value.deletedAt === 'number' ? value.deletedAt : null,
  };
}

/** Helper to create a chat selection for a channel. */
export function chatSelectionFromChannel(spaceId: number, channelId: number): import('./chat.ts').ChatSelection {
  return { conversationId: null, spaceId, channelId };
}

/** Helper to create a chat selection for a conversation (DM). */
export function chatSelectionFromConversation(conversationId: number): import('./chat.ts').ChatSelection {
  return { conversationId, spaceId: null, channelId: null };
}

function deletedMessageId(payload: Record<string, unknown>): number | null {
  if (typeof payload.messageId === 'number') return payload.messageId;
  const message = payload.message;
  if (isMessageLike(message) && typeof message.id === 'number') return message.id;
  return null;
}

export interface ChatEventHandlers {
  onChannelMessageCreated?: (spaceId: number, channelId: number, message: ScopedMessage) => void;
  onChannelMessageUpdated?: (spaceId: number, channelId: number, message: ScopedMessage) => void;
  onChannelMessageDeleted?: (spaceId: number, channelId: number, messageId: number) => void;
  onChannelCreated?: (spaceId: number, channel: Channel) => void;
  onConversationMessageCreated?: (conversationId: number, message: ScopedMessage) => void;
  onConversationMessageUpdated?: (conversationId: number, message: ScopedMessage) => void;
  onConversationMessageDeleted?: (conversationId: number, messageId: number) => void;
}

/**
 * Despacha envelope por escopo. Eventos sem escopo ou com payload inválido
 * são ignorados: nenhum estado de conversa é alterado por evento ambíguo.
 */
export function dispatchSseEvent(
  envelope: ChatEventEnvelope,
  handlers: ChatEventHandlers,
): void {
  const { type, payload } = envelope;
  if (!isRecord(payload)) return;

  if (type === 'channel.created') {
    if (payload.scope !== 'space' || typeof payload.spaceId !== 'number') return;
    const channel = payload.channel;
    if (!isRecord(channel) || typeof channel.id !== 'number') return;
    /* Canal privado não entra no rail público do espaço. */
    if (channel.visibility === 'private') return;
    handlers.onChannelCreated?.(payload.spaceId, channel as unknown as Channel);
    return;
  }

  const scope = payload.scope;

  if (scope === 'channel') {
    const channelId = payload.channelId;
    const spaceId = payload.spaceId;
    if (typeof channelId !== 'number' || typeof spaceId !== 'number') return;

    if (type === 'message.deleted') {
      const messageId = deletedMessageId(payload);
      if (messageId !== null) handlers.onChannelMessageDeleted?.(spaceId, channelId, messageId);
      return;
    }

    const message = payload.message;
    if (!isMessageLike(message)) return;
    const scoped = toScopedMessage(message);
    scoped.channelId = channelId;
    if (type === 'message.created') handlers.onChannelMessageCreated?.(spaceId, channelId, scoped);
    if (type === 'message.updated') handlers.onChannelMessageUpdated?.(spaceId, channelId, scoped);
    return;
  }

  if (scope === 'conversation') {
    const conversationId = payload.conversationId;
    if (typeof conversationId !== 'number') return;

    if (type === 'message.deleted') {
      const messageId = deletedMessageId(payload);
      if (messageId !== null) handlers.onConversationMessageDeleted?.(conversationId, messageId);
      return;
    }

    const message = payload.message;
    if (!isMessageLike(message)) return;
    const scoped = toScopedMessage(message);
    scoped.conversationId = conversationId;
    if (type === 'message.created') handlers.onConversationMessageCreated?.(conversationId, scoped);
    if (type === 'message.updated') handlers.onConversationMessageUpdated?.(conversationId, scoped);
  }
}
