import type { MessageMedia, MessageSender, Post } from './types.ts';

export interface ChatSelection {
  conversationId: number | null;
  spaceId: number | null;
  channelId: number | null;
}

/** Mensagem normalizada usada por canais e conversas diretas. */
export interface ScopedMessage {
  id: number;
  body: string;
  sender: MessageSender;
  createdAt: number;
  mine: boolean;
  media: MessageMedia[];
  sharedPostId: number | null;
  sharedPost?: Post | null;
  editedAt: number | null;
  deletedAt: number | null;
  channelId?: number;
  conversationId?: number;
}

interface SearchParamsLike {
  get(name: string): string | null;
}

function positiveInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Lê a seleção atual. Link de conversa sempre exclui links de canal. */
export function parseChatSelection(params: SearchParamsLike): ChatSelection {
  const conversationId = positiveInteger(params.get('conversa'));
  if (conversationId !== null) {
    return { conversationId, spaceId: null, channelId: null };
  }

  const spaceId = positiveInteger(params.get('espaco'));
  const channelId = positiveInteger(params.get('canal'));
  if (spaceId !== null && channelId !== null) {
    return { conversationId: null, spaceId, channelId };
  }

  return {
    conversationId: null,
    spaceId,
    channelId: channelId ?? null,
  };
}

/** Versão para `searchParams` de Server Components (objeto simples). */
export function parseChatSelectionRecord(
  record: Record<string, string | string[] | undefined>,
): ChatSelection {
  return parseChatSelection({
    get(name) {
      const value = record[name];
      if (value === undefined) return null;
      return (Array.isArray(value) ? value[0] : value) ?? null;
    },
  });
}

/** Constrói query canônica. Conversa e canal nunca aparecem juntos. */
export function chatSelectionQuery(selection: ChatSelection): string {
  const params = new URLSearchParams();
  if (selection.conversationId !== null) {
    params.set('conversa', String(selection.conversationId));
    return params.toString();
  }
  if (selection.spaceId !== null) {
    params.set('espaco', String(selection.spaceId));
  }
  if (selection.channelId !== null) {
    params.set('canal', String(selection.channelId));
  }
  return params.toString();
}

/** Chave estável do alvo ativo. Usada para impedir updates entre escopos. */
export function chatScopeKey(selection: ChatSelection): string {
  if (selection.conversationId !== null) return `conversation:${selection.conversationId}`;
  if (selection.channelId !== null) return `channel:${selection.channelId}`;
  return 'none';
}

/**
 * Mescla páginas, respostas de envio e eventos realtime por ID estável.
 * Dados mais recentes sobrescrevem o registro anterior sem apagar mídia rica.
 */
export function mergeScopedMessages<T extends ScopedMessage>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const merged = new Map<number, T>();
  for (const message of current) merged.set(message.id, message);

  for (const message of incoming) {
    const previous = merged.get(message.id);
    if (!previous) {
      merged.set(message.id, message);
      continue;
    }

    merged.set(message.id, {
      ...previous,
      ...message,
      media: message.media.length > 0 ? message.media : previous.media,
      sharedPost: message.sharedPost ?? previous.sharedPost,
      deletedAt: message.deletedAt ?? previous.deletedAt,
    });
  }

  return [...merged.values()].sort((left, right) => {
    if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
    return left.id - right.id;
  });
}

/**
 * Cursor usado para carregar página anterior. `null` encerra paginação.
 * Cursor precisa avançar para mensagens progressivamente mais antigas.
 */
export function nextMessageCursor(
  currentCursor: number | null,
  responseCursor: number | null | undefined,
): number | null {
  if (responseCursor === null || responseCursor === undefined) return null;
  if (currentCursor !== null && responseCursor >= currentCursor) return null;
  return responseCursor;
}

/** Converte mensagem direta para formato comum de workspace. */
export function scopedDirectMessage(message: {
  id: number;
  body: string;
  sender: MessageSender;
  createdAt: number;
  mine: boolean;
  media?: MessageMedia[];
  sharedPostId?: number | null;
  sharedPost?: Post | null;
  editedAt?: number | null;
  deletedAt?: number | null;
  conversationId?: number;
}): ScopedMessage {
  return {
    id: message.id,
    body: message.body,
    sender: message.sender,
    createdAt: message.createdAt,
    mine: message.mine,
    media: message.media ?? [],
    sharedPostId: message.sharedPostId ?? null,
    sharedPost: message.sharedPost ?? null,
    editedAt: message.editedAt ?? null,
    deletedAt: message.deletedAt ?? null,
    conversationId: message.conversationId,
  };
}

/** Converte mensagem de canal para formato comum de workspace. */
export function scopedChannelMessage(message: {
  id: number;
  channelId: number;
  body: string;
  sender: MessageSender;
  createdAt: number;
  mine: boolean;
  media?: MessageMedia[];
  sharedPostId?: number | null;
  sharedPost?: Post | null;
  editedAt?: number | null;
  deletedAt?: number | null;
}): ScopedMessage {
  return {
    id: message.id,
    body: message.body,
    sender: message.sender,
    createdAt: message.createdAt,
    mine: message.mine,
    media: message.media ?? [],
    sharedPostId: message.sharedPostId ?? null,
    sharedPost: message.sharedPost ?? null,
    editedAt: message.editedAt ?? null,
    deletedAt: message.deletedAt ?? null,
    channelId: message.channelId,
  };
}
