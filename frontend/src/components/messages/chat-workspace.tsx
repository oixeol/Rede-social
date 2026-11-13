'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Route } from 'next';
import {
  Hash,
  MessageSquare,
  Users,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  X,
  Search,
  Paperclip,
  Send,
  Smile,
  LoaderCircle,
  Phone,
  Video,
  Plus,
  UserPlus,
  Copy,
  Clock,
  ExternalLink,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { SearchField } from '@/components/ui/search-field';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import { apiRequest, createSpaceInvite, joinSpaceWithInvite } from '@/lib/api';
import {
  classifyMessageAttachment,
  fileToDataUrl,
  validateMessageAttachment,
  type MessageAttachmentKind,
} from '@/lib/message-attachments';
import type {
  ConversationSummary,
  Space,
  Channel,
  SpaceMember,
  Message,
  MessageMedia,
  MessageAttachmentInput,
  SendMessageResponse,
  ChannelMessage,
  MessageMutationResponse,
  SearchUser,
} from '@/lib/types';
import { formatClockTime, formatRelativeTime, groupMessagesByDay } from '@/lib/messages';
import {
  parseChatSelection,
  chatSelectionQuery,
  mergeScopedMessages,
  nextMessageCursor,
  scopedChannelMessage,
  scopedDirectMessage,
  type ScopedMessage,
} from '@/lib/chat';
import { useChatEvents } from './use-chat-events';
import { dispatchSseEvent } from '@/lib/chat-events';
import { ChatDialog } from './chat-dialog';
import { isSafeMediaSource } from '@/lib/media';

const MAX_MESSAGE_LENGTH = 2000;
const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😭', '😡', '👍', '👏', '🔥', '🎉', '❤️', '💯', '🙏', '✨'];
const ALL_ATTACHMENTS_ACCEPT =
  '.png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.rtf,.txt,.csv,image/png,image/jpeg,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf,text/rtf,text/plain,text/csv';
const IMAGE_ATTACHMENTS_ACCEPT =
  '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
const DOCUMENT_ATTACHMENTS_ACCEPT =
  '.pdf,.doc,.docx,.rtf,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf,text/rtf,text/plain,text/csv';

type SelectionType = 'dm' | 'channel' | 'none';
type MobileView = 'nav' | 'main' | 'members';

interface ComposerAttachment {
  id: string;
  file: File;
  kind: MessageAttachmentKind;
  sizeBytes: number;
  previewUrl: string | null;
}

interface MessageWithScope extends ScopedMessage {
  scope: 'dm' | 'channel';
}

/** Normaliza mensagem de canal para o formato do workspace. */
function asChannelMessage(message: ScopedMessage): MessageWithScope {
  return { ...message, scope: 'channel' };
}

/** Normaliza mensagem direta para o formato do workspace. */
function asDirectMessage(message: ScopedMessage): MessageWithScope {
  return { ...message, scope: 'dm' };
}

interface CreateSpaceDialogState {
  open: boolean;
  name: string;
  description: string;
  error: string | null;
  submitting: boolean;
}

interface CreateChannelDialogState {
  open: boolean;
  name: string;
  topic: string;
  visibility: 'public' | 'private';
  error: string | null;
  submitting: boolean;
}

interface AddSpaceMemberDialogState {
  open: boolean;
  username: string;
  error: string | null;
  submitting: boolean;
}

interface AddChannelMemberDialogState {
  open: boolean;
  channelId: number | null;
  username: string;
  error: string | null;
  submitting: boolean;
}

interface SpaceInviteDialogState {
  open: boolean;
  spaceId: number | null;
  code: string | null;
  expiresAt: number | null;
  generating: boolean;
  error: string | null;
}

interface JoinSpaceDialogState {
  open: boolean;
  code: string;
  error: string | null;
  submitting: boolean;
}

interface NewConversationDialogState {
  open: boolean;
  search: string;
  results: SearchUser[];
  loading: boolean;
  creating: string | null;
  error: string | null;
}

interface EditMessageDialogState {
  open: boolean;
  message: MessageWithScope | null;
  text: string;
}

interface DeleteMessageDialogState {
  open: boolean;
  message: MessageWithScope | null;
}

/** Estado de carga por escopo. Falha nunca apaga mensagens já carregadas. */
interface ScopeLoadState {
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

/** Principal componente do workspace de mensagens. */
export function ChatWorkspace({
  initialConversations,
  initialSpaces,
  initialSpaceDetail,
  initialSelection,
}: {
  initialConversations: ConversationSummary[];
  initialSpaces: Space[];
  initialSpaceDetail: { space: Space; channels: Channel[]; members: SpaceMember[] } | null;
  initialSelection: ReturnType<typeof parseChatSelection>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [selection, setSelection] = useState(initialSelection);
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [spaces, setSpaces] = useState<Space[]>(initialSpaces);
  const [spaceDetail, setSpaceDetail] = useState<{ space: Space; channels: Channel[]; members: SpaceMember[] } | null>(initialSpaceDetail);

  const [messagesByScope, setMessagesByScope] = useState<Record<string, MessageWithScope[]>>({});
  const [cursorByScope, setCursorByScope] = useState<Record<string, number | null>>({});
  const [scopeLoadState, setScopeLoadState] = useState<Record<string, ScopeLoadState>>({});
  const [sending, setSending] = useState(false);

  const [composerText, setComposerText] = useState('');
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [preparingAttachments, setPreparingAttachments] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousScrollHeight = useRef(0);

  const [createSpaceDialog, setCreateSpaceDialog] = useState<CreateSpaceDialogState>({
    open: false,
    name: '',
    description: '',
    error: null,
    submitting: false,
  });
  const [createChannelDialog, setCreateChannelDialog] = useState<CreateChannelDialogState>({
    open: false,
    name: '',
    topic: '',
    visibility: 'public',
    error: null,
    submitting: false,
  });
  const [addSpaceMemberDialog, setAddSpaceMemberDialog] = useState<AddSpaceMemberDialogState>({
    open: false,
    username: '',
    error: null,
    submitting: false,
  });
  const [addChannelMemberDialog, setAddChannelMemberDialog] = useState<AddChannelMemberDialogState>({
    open: false,
    channelId: null,
    username: '',
    error: null,
    submitting: false,
  });
  const [spaceInviteDialog, setSpaceInviteDialog] = useState<SpaceInviteDialogState>({
    open: false,
    spaceId: null,
    code: null,
    expiresAt: null,
    generating: false,
    error: null,
  });
  const [joinSpaceDialog, setJoinSpaceDialog] = useState<JoinSpaceDialogState>({
    open: false,
    code: '',
    error: null,
    submitting: false,
  });
  const [newConversationDialog, setNewConversationDialog] = useState<NewConversationDialogState>({
    open: false,
    search: '',
    results: [],
    loading: false,
    creating: null,
    error: null,
  });
  const [editDialog, setEditDialog] = useState<EditMessageDialogState>({ open: false, message: null, text: '' });
  const [deleteDialog, setDeleteDialog] = useState<DeleteMessageDialogState>({ open: false, message: null });

  const selectionRef = useRef(selection);
  const spaceDetailRef = useRef(spaceDetail);
  const loadMessagesRef = useRef<(conversationId?: number, channelId?: number, before?: number, preserve?: boolean) => Promise<void>>(async () => undefined);
  /** Geração por escopo. Respostas antigas nunca sobrescrevem carga mais nova. */
  const requestGenerationRef = useRef<Record<string, number>>({});
  const [navSearch, setNavSearch] = useState('');

  const handleSseEvent = useCallback((envelope: Parameters<typeof dispatchSseEvent>[0]) => {
    dispatchSseEvent(envelope, {
      onChannelMessageCreated: (spaceId, channelId, msg) => {
        const current = selectionRef.current;
        if (current.spaceId !== spaceId || current.channelId !== channelId || current.conversationId !== null) return;
        const key = `channel:${channelId}`;
        setMessagesByScope((prev) => ({
          ...prev,
          [key]: mergeScopedMessages(prev[key] ?? [], [asChannelMessage(scopedChannelMessage({ ...msg, channelId }))]),
        }));
      },
      onChannelMessageUpdated: (spaceId, channelId, msg) => {
        const current = selectionRef.current;
        if (current.spaceId !== spaceId || current.channelId !== channelId || current.conversationId !== null) return;
        const key = `channel:${channelId}`;
        setMessagesByScope((prev) => ({
          ...prev,
          [key]: mergeScopedMessages(prev[key] ?? [], [asChannelMessage(scopedChannelMessage({ ...msg, channelId }))]),
        }));
      },
      onChannelMessageDeleted: (spaceId, channelId, messageId) => {
        const current = selectionRef.current;
        if (current.spaceId !== spaceId || current.channelId !== channelId || current.conversationId !== null) return;
        const key = `channel:${channelId}`;
        /* Soft-delete: marcar como excluída em vez de remover. */
        setMessagesByScope((prev) => ({
          ...prev,
          [key]: (prev[key] ?? []).map((m) =>
            m.id === messageId ? { ...m, body: '', deletedAt: Date.now(), media: [] } : m
          ),
        }));
      },
      onChannelCreated: (spaceId, channel) => {
        const current = selectionRef.current;
        if (current.spaceId !== spaceId) return;
        setSpaceDetail((prev) => {
          if (!prev || prev.channels.some((item) => item.id === channel.id)) return prev;
          return { ...prev, channels: [...prev.channels, channel] };
        });
        setSpaces((prev) => prev.map((s) => s.id === spaceId ? { ...s, updatedAt: Date.now() } : s));
      },
      onConversationMessageCreated: (conversationId, msg) => {
        const current = selectionRef.current;
        const key = `conversation:${conversationId}`;
        if (current.conversationId === conversationId) {
          setMessagesByScope((prev) => ({
            ...prev,
            [key]: mergeScopedMessages(prev[key] ?? [], [asDirectMessage(scopedDirectMessage({ ...msg, conversationId }))]),
          }));
        }
        setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, unread: current.conversationId === conversationId ? 0 : c.unread + 1, updatedAt: msg.createdAt } : c));
      },
      onConversationMessageUpdated: (conversationId, msg) => {
        const current = selectionRef.current;
        if (current.conversationId !== conversationId) return;
        const key = `conversation:${conversationId}`;
        setMessagesByScope((prev) => ({
          ...prev,
          [key]: mergeScopedMessages(prev[key] ?? [], [asDirectMessage(scopedDirectMessage({ ...msg, conversationId }))]),
        }));
      },
      onConversationMessageDeleted: (conversationId, messageId) => {
        const current = selectionRef.current;
        if (current.conversationId !== conversationId) return;
        const key = `conversation:${conversationId}`;
        setMessagesByScope((prev) => ({
          ...prev,
          [key]: (prev[key] ?? []).map((m) =>
            m.id === messageId ? { ...m, body: '', deletedAt: Date.now(), media: [] } : m
          ),
        }));
      },
    });
  }, []);

  const sseStatus = useChatEvents({
    onEvent: handleSseEvent,
    onReconnect: () => {
      const current = selectionRef.current;
      if (current.conversationId !== null) {
        void loadMessagesRef.current(current.conversationId, undefined, undefined, true);
      } else if (current.channelId !== null) {
        void loadMessagesRef.current(undefined, current.channelId, undefined, true);
      }
      if (spaceDetailRef.current) {
        void apiRequest<{ space: Space; channels: Channel[]; members: SpaceMember[] }>(
          `/api/spaces/${spaceDetailRef.current.space.id}`,
        ).then((res) => setSpaceDetail(res)).catch(() => undefined);
      }
    },
  });

  useEffect(() => {
    selectionRef.current = selection;
    const query = chatSelectionQuery(selection);
    const url = pathname + (query ? `?${query}` : '');
    if (window.location.href !== url) {
      router.replace(url as Route, { scroll: false });
    }
  }, [selection, pathname, router]);

  useEffect(() => {
    spaceDetailRef.current = spaceDetail;
  }, [spaceDetail]);

  const loadMessages = useCallback(async (conversationId?: number, channelId?: number, before?: number, preserve = false) => {
    if (conversationId === undefined && channelId === undefined) return;
    const targetKey = conversationId !== undefined
      ? `conversation:${conversationId}`
      : `channel:${channelId}`;
    /* Geração invalida respostas antigas do mesmo escopo. */
    const generation = (requestGenerationRef.current[targetKey] ?? 0) + 1;
    requestGenerationRef.current[targetKey] = generation;

    setScopeLoadState((prev) => ({
      ...prev,
      [targetKey]: { loading: !preserve, loadingMore: preserve, error: null },
    }));

    try {
      const params = new URLSearchParams();
      if (before !== undefined) params.set('before', String(before));
      params.set('limit', '50');
      const path = conversationId
        ? `/api/conversations/${conversationId}/messages?${params}`
        : `/api/channels/${channelId}/messages?${params}`;
      const res = await apiRequest<{ messages: (Message | ChannelMessage)[]; nextCursor: number | null }>(path);
      if (requestGenerationRef.current[targetKey] !== generation) return;
      const scoped = conversationId
        ? res.messages.map((m) => asDirectMessage(scopedDirectMessage({ ...m, conversationId })))
        : res.messages.map((m) => asChannelMessage(scopedChannelMessage({ ...m, channelId: channelId! })));
      setMessagesByScope((prev) => ({
        ...prev,
        [targetKey]: mergeScopedMessages(prev[targetKey] ?? [], scoped),
      }));
      setCursorByScope((prev) => ({
        ...prev,
        [targetKey]: nextMessageCursor(before ?? null, res.nextCursor),
      }));
      setScopeLoadState((prev) => ({
        ...prev,
        [targetKey]: { loading: false, loadingMore: false, error: null },
      }));

      if (conversationId) {
        await apiRequest(`/api/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => {});
        setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, unread: 0 } : c));
      } else if (channelId) {
        await apiRequest(`/api/channels/${channelId}/read`, { method: 'POST' }).catch(() => {});
        setSpaceDetail((prev) => prev ? { ...prev, channels: prev.channels.map((ch) => ch.id === channelId ? { ...ch, unreadCount: 0 } : ch) } : prev);
      }
    } catch (err) {
      if (requestGenerationRef.current[targetKey] !== generation) return;
      /* Falha transitória mantém mensagens já carregadas. */
      setScopeLoadState((prev) => ({
        ...prev,
        [targetKey]: {
          loading: false,
          loadingMore: false,
          error: err instanceof Error ? err.message : 'Não foi possível carregar as mensagens.',
        },
      }));
    }
  }, []);

  useEffect(() => {
    loadMessagesRef.current = loadMessages;
  }, [loadMessages]);

  useEffect(() => {
    if (selection.conversationId !== null) {
      void loadMessages(selection.conversationId, undefined, undefined, false);
    } else if (selection.channelId !== null) {
      void loadMessages(undefined, selection.channelId, undefined, false);
    }
  }, [selection.conversationId, selection.channelId, loadMessages]);

  const currentScopeKey = selection.conversationId !== null
    ? `conversation:${selection.conversationId}`
    : selection.channelId !== null
      ? `channel:${selection.channelId}`
      : null;
  const currentLoadState = currentScopeKey ? scopeLoadState[currentScopeKey] : undefined;
  const loadingMessages = currentLoadState?.loading ?? false;
  const loadingMore = currentLoadState?.loadingMore ?? false;
  const loadError = currentLoadState?.error ?? null;

  const handleLoadMore = useCallback(() => {
    const current = selectionRef.current;
    const key = current.conversationId !== null
      ? `conversation:${current.conversationId}`
      : current.channelId !== null
        ? `channel:${current.channelId}`
        : null;
    if (!key) return;
    const state = scopeLoadState[key];
    const cursor = cursorByScope[key] ?? null;
    if (cursor !== null && !state?.loadingMore && !state?.loading) {
      if (current.conversationId !== null) {
        void loadMessages(current.conversationId, undefined, cursor, true);
      } else if (current.channelId !== null) {
        void loadMessages(undefined, current.channelId, cursor, true);
      }
    }
  }, [cursorByScope, scopeLoadState, loadMessages]);

  useEffect(() => {
    if (loadingMore && scrollContainerRef.current) {
      previousScrollHeight.current = scrollContainerRef.current.scrollHeight;
    }
  }, [loadingMore]);

  useEffect(() => {
    if (!loadingMore && scrollContainerRef.current && previousScrollHeight.current > 0) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight - previousScrollHeight.current;
      previousScrollHeight.current = 0;
    }
  }, [loadingMore]);

  useEffect(() => {
    const key = selectionRef.current.conversationId !== null
      ? `conversation:${selectionRef.current.conversationId}`
      : selectionRef.current.channelId !== null
        ? `channel:${selectionRef.current.channelId}`
        : null;
    if (!key) return;
    const msgs = messagesByScope[key];
    if (msgs?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesByScope]);

  const insertEmoji = useCallback((emoji: string) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const next = `${composerText.slice(0, start)}${emoji}${composerText.slice(end)}`;
    setComposerText(next.slice(0, MAX_MESSAGE_LENGTH));
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      input.focus();
      const pos = Math.min(start + emoji.length, MAX_MESSAGE_LENGTH);
      input.setSelectionRange(pos, pos);
    });
  }, [composerText]);

  const openFilePicker = useCallback((mode: 'all' | 'image' | 'document') => {
    const input = fileInputRef.current;
    if (!input || sending || preparingAttachments) return;
    input.accept = mode === 'image' ? IMAGE_ATTACHMENTS_ACCEPT : mode === 'document' ? DOCUMENT_ATTACHMENTS_ACCEPT : ALL_ATTACHMENTS_ACCEPT;
    input.click();
  }, [sending, preparingAttachments]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setPreparingAttachments(true);
    setAttachmentError(null);
    const nextAttachments = [...composerAttachments];
    let error: string | null = null;
    for (const file of files) {
      const validationError = validateMessageAttachment(file, nextAttachments.map((a) => ({ sizeBytes: a.sizeBytes })));
      if (validationError) { error = validationError; continue; }
      const kind = classifyMessageAttachment(file);
      if (!kind) { error = 'Formato não suportado. Use PNG, JPG, WEBP, PDF, DOC, DOCX, RTF, TXT ou CSV.'; continue; }
      try {
        const previewUrl = kind === 'image' ? await fileToDataUrl(file) : null;
        nextAttachments.push({ id: crypto.randomUUID(), file, kind, sizeBytes: file.size, previewUrl });
      } catch {
        error = 'Não foi possível ler um dos anexos.';
      }
    }
    setComposerAttachments(nextAttachments);
    setAttachmentError(error);
    setPreparingAttachments(false);
  }, [composerAttachments]);

  const removeAttachment = useCallback((id: string) => {
    setComposerAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachmentError(null);
  }, []);

  const handleSend = useCallback(async () => {
    const text = composerText.trim();
    const hasAttachments = composerAttachments.length > 0;
    if (!text && !hasAttachments) return;
    if (sending) return;
    const current = selectionRef.current;
    if (current.conversationId === null && current.channelId === null) return;

    setSending(true);
    setAttachmentError(null);
    try {
      const media = await Promise.all(composerAttachments.map(async (a): Promise<MessageAttachmentInput> => ({
        dataUrl: a.previewUrl ?? (await fileToDataUrl(a.file)),
        fileName: a.file.name,
      })));
      let response: SendMessageResponse | MessageMutationResponse;
      if (current.conversationId !== null) {
        response = await apiRequest<SendMessageResponse>(`/api/conversations/${current.conversationId}/messages`, {
          method: 'POST',
          body: { text, media },
        });
      } else if (current.channelId !== null) {
        response = await apiRequest<MessageMutationResponse>(`/api/channels/${current.channelId}/messages`, {
          method: 'POST',
          body: { text, media },
        });
      } else return;
      const scoped = current.conversationId !== null
        ? asDirectMessage(scopedDirectMessage({ ...response.message, conversationId: current.conversationId }))
        : asChannelMessage(scopedChannelMessage({ ...response.message, channelId: current.channelId! }));
      const key = current.conversationId !== null
        ? `conversation:${current.conversationId}`
        : `channel:${current.channelId!}`;
      setMessagesByScope((prev) => ({
        ...prev,
        [key]: mergeScopedMessages(prev[key] ?? [], [scoped]),
      }));
      setComposerText('');
      setComposerAttachments([]);
      inputRef.current?.focus();
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  }, [composerText, composerAttachments, sending]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  }, [handleSend]);

  const openEdit = useCallback((msg: MessageWithScope) => {
    setEditDialog({ open: true, message: msg, text: msg.body });
  }, []);

  const saveEdit = useCallback(async () => {
    const { message, text } = editDialog;
    if (!message || text.trim() === '') return;
    setSending(true);
    try {
      if (message.scope === 'channel') {
        const res = await apiRequest<MessageMutationResponse>(`/api/channel-messages/${message.id}`, {
          method: 'PATCH',
          body: { text: text.trim() },
        });
        const scoped = asChannelMessage(scopedChannelMessage({ ...res.message, channelId: message.channelId! }));
        const key = `channel:${message.channelId!}`;
        setMessagesByScope((prev) => ({
          ...prev,
          [key]: mergeScopedMessages(prev[key] ?? [], [scoped]),
        }));
      } else {
        const res = await apiRequest<MessageMutationResponse>(`/api/conversation-messages/${message.id}`, {
          method: 'PATCH',
          body: { text: text.trim() },
        });
        const scoped = asDirectMessage(scopedDirectMessage({ ...res.message, conversationId: message.conversationId! }));
        const key = `conversation:${message.conversationId!}`;
        setMessagesByScope((prev) => ({
          ...prev,
          [key]: mergeScopedMessages(prev[key] ?? [], [scoped]),
        }));
      }
      setEditDialog({ open: false, message: null, text: '' });
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : 'Não foi possível editar a mensagem.');
    } finally {
      setSending(false);
    }
  }, [editDialog]);

  const openDelete = useCallback((msg: MessageWithScope) => {
    setDeleteDialog({ open: true, message: msg });
  }, []);

  const confirmDelete = useCallback(async () => {
    const { message } = deleteDialog;
    if (!message) return;
    setSending(true);
    try {
      if (message.scope === 'channel') {
        await apiRequest(`/api/channel-messages/${message.id}`, { method: 'DELETE' });
      } else {
        await apiRequest(`/api/conversation-messages/${message.id}`, { method: 'DELETE' });
      }
      const key = message.scope === 'channel'
        ? `channel:${message.channelId!}`
        : `conversation:${message.conversationId!}`;
      /* Soft-delete: API responde com deletedAt; usar merge para preservar tombstone. */
      const deletedMsg = { ...message, body: '', deletedAt: Date.now(), media: [] };
      setMessagesByScope((prev) => ({
        ...prev,
        [key]: mergeScopedMessages(prev[key] ?? [], [deletedMsg]),
      }));
      setDeleteDialog({ open: false, message: null });
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : 'Não foi possível excluir a mensagem.');
    } finally {
      setSending(false);
    }
  }, [deleteDialog]);

  const selectConversation = useCallback((id: number) => {
    setSelection({ conversationId: id, spaceId: null, channelId: null });
  }, []);

  const selectChannel = useCallback((spaceId: number, channelId: number) => {
    setSelection({ conversationId: null, spaceId, channelId });
  }, []);

  const selectSpace = useCallback((spaceId: number) => {
    setSelection({ conversationId: null, spaceId, channelId: null });
  }, []);

  const goBackFromChannel = useCallback(() => {
    if (selection.spaceId !== null) {
      setSelection({ conversationId: null, spaceId: selection.spaceId, channelId: null });
    }
  }, [selection.spaceId]);

  const openCreateSpaceDialog = useCallback(() => {
    setCreateSpaceDialog({ open: true, name: '', description: '', error: null, submitting: false });
  }, []);

  const confirmCreateSpace = useCallback(async () => {
    const { name, description } = createSpaceDialog;
    if (!name.trim()) return;
    setCreateSpaceDialog((prev) => ({ ...prev, error: null, submitting: true }));
    try {
      const res = await apiRequest<{ space: Space }>('/api/spaces', {
        method: 'POST',
        body: { name: name.trim(), description: description.trim() || undefined },
      });
      setSpaces((prev) => [res.space, ...prev]);
      setCreateSpaceDialog({ open: false, name: '', description: '', error: null, submitting: false });
      selectSpace(res.space.id);
    } catch (err) {
      setCreateSpaceDialog((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'Erro ao criar espaço.', submitting: false }));
    }
  }, [createSpaceDialog, selectSpace]);

  const openCreateChannelDialog = useCallback(() => {
    if (!spaceDetail) return;
    setCreateChannelDialog({ open: true, name: '', topic: '', visibility: 'public', error: null, submitting: false });
  }, [spaceDetail]);

  const confirmCreateChannel = useCallback(async () => {
    const { name, topic, visibility } = createChannelDialog;
    if (!name.trim() || !spaceDetail) return;
    setCreateChannelDialog((prev) => ({ ...prev, error: null, submitting: true }));
    try {
      const res = await apiRequest<{ channel: Channel }>(`/api/spaces/${spaceDetail.space.id}/channels`, {
        method: 'POST',
        body: { name: name.trim(), topic: topic.trim() || undefined, visibility },
      });
      setSpaceDetail((prev) => prev ? { ...prev, channels: [...prev.channels, res.channel] } : prev);
      setCreateChannelDialog({ open: false, name: '', topic: '', visibility: 'public', error: null, submitting: false });
      selectChannel(spaceDetail.space.id, res.channel.id);
    } catch (err) {
      setCreateChannelDialog((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'Erro ao criar canal.', submitting: false }));
    }
  }, [createChannelDialog, spaceDetail, selectChannel]);

  const openAddSpaceMemberDialog = useCallback(() => {
    if (!spaceDetail) return;
    setAddSpaceMemberDialog({ open: true, username: '', error: null, submitting: false });
  }, [spaceDetail]);

  const confirmAddSpaceMember = useCallback(async () => {
    const { username } = addSpaceMemberDialog;
    if (!username.trim() || !spaceDetail) return;
    setAddSpaceMemberDialog((prev) => ({ ...prev, error: null, submitting: true }));
    try {
      await apiRequest(`/api/spaces/${spaceDetail.space.id}/members`, {
        method: 'POST',
        body: { username: username.trim().toLowerCase() },
      });
      setSpaceDetail((prev) => prev ? { ...prev, members: [...prev.members, { userId: 0, username: username.trim(), name: '', avatar: null, role: 'member', joinedAt: Date.now(), presence: 'offline' as const }] } : prev);
      setAddSpaceMemberDialog({ open: false, username: '', error: null, submitting: false });
    } catch (err) {
      setAddSpaceMemberDialog((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'Erro ao adicionar membro.', submitting: false }));
    }
  }, [addSpaceMemberDialog, spaceDetail]);

  const openAddChannelMemberDialog = useCallback((channelId: number) => {
    setAddChannelMemberDialog({ open: true, channelId, username: '', error: null, submitting: false });
  }, []);

  const confirmAddChannelMember = useCallback(async () => {
    const { channelId, username } = addChannelMemberDialog;
    if (!username.trim() || !channelId) return;
    setAddChannelMemberDialog((prev) => ({ ...prev, error: null, submitting: true }));
    try {
      await apiRequest(`/api/channels/${channelId}/members`, {
        method: 'POST',
        body: { username: username.trim().toLowerCase() },
      });
      setAddChannelMemberDialog({ open: false, channelId: null, username: '', error: null, submitting: false });
    } catch (err) {
      setAddChannelMemberDialog((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'Erro ao adicionar membro.', submitting: false }));
    }
  }, [addChannelMemberDialog]);

  const openSpaceInviteDialog = useCallback(() => {
    if (!spaceDetail) return;
    setSpaceInviteDialog({
      open: true,
      spaceId: spaceDetail.space.id,
      code: null,
      expiresAt: null,
      generating: true,
      error: null,
    });
    // Generate invite code
    createSpaceInvite(spaceDetail.space.id)
      .then((res) => {
        setSpaceInviteDialog((prev) => ({
          ...prev,
          code: res.invite.code,
          expiresAt: res.invite.expiresAt,
          generating: false,
        }));
      })
      .catch((err) => {
        setSpaceInviteDialog((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Erro ao gerar convite.',
          generating: false,
        }));
      });
  }, [spaceDetail]);

  const closeSpaceInviteDialog = useCallback(() => {
    setSpaceInviteDialog({ open: false, spaceId: null, code: null, expiresAt: null, generating: false, error: null });
  }, []);

  const copyInviteCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // fallback
    }
  }, []);

  const openJoinSpaceDialog = useCallback(() => {
    setJoinSpaceDialog({ open: true, code: '', error: null, submitting: false });
  }, []);

  const closeJoinSpaceDialog = useCallback(() => {
    setJoinSpaceDialog({ open: false, code: '', error: null, submitting: false });
  }, []);

  const confirmJoinSpace = useCallback(async () => {
    const { code } = joinSpaceDialog;
    if (!code.trim()) return;
    setJoinSpaceDialog((prev) => ({ ...prev, error: null, submitting: true }));
    try {
      const res = await joinSpaceWithInvite(code.trim().toUpperCase());
      closeJoinSpaceDialog();
      if (res.alreadyMember) {
        // Already a member, just select the space
        selectSpace(res.spaceId);
      } else {
        // New member, refresh spaces and select
        // The spaces list will be updated via SSE or we can refetch
        void apiRequest<{ spaces: Space[] }>('/api/spaces').then((res) => setSpaces(res.spaces)).catch(() => {});
        selectSpace(res.spaceId);
      }
    } catch (err) {
      setJoinSpaceDialog((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'Erro ao entrar no servidor.', submitting: false }));
    }
  }, [joinSpaceDialog, closeJoinSpaceDialog, selectSpace]);

  const openNewConversationDialog = useCallback(() => {
    setNewConversationDialog({ open: true, search: '', results: [], loading: false, creating: null, error: null });
  }, []);

  const debouncedSearchRef = useRef<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const handleConversationSearchChange = useCallback((value: string) => {
    setNewConversationDialog((prev) => ({ ...prev, search: value, error: null }));
    if (debouncedSearchRef.current) clearTimeout(debouncedSearchRef.current);
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setNewConversationDialog((prev) => ({ ...prev, results: [], loading: false }));
      return;
    }
    debouncedSearchRef.current = window.setTimeout(() => {
      setNewConversationDialog((prev) => ({ ...prev, loading: true }));
      apiRequest<{ users: SearchUser[] }>(
        `/api/search?q=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal },
      )
        .then((res) => {
          if (!controller.signal.aborted) {
            setNewConversationDialog((prev) => ({ ...prev, results: res.users, loading: false }));
          }
        })
        .catch((err) => {
          if (!(err instanceof DOMException && err.name === 'AbortError') && !controller.signal.aborted) {
            setNewConversationDialog((prev) => ({ ...prev, results: [], loading: false }));
          }
        });
    }, 200);
  }, []);

  const handleCreateConversation = useCallback(async (username: string) => {
    setNewConversationDialog((prev) => ({ ...prev, creating: username, error: null }));
    try {
      const res = await apiRequest<{ conversation: { id: number } }>('/api/conversations', {
        method: 'POST',
        body: { username },
      });
      setNewConversationDialog({ open: false, search: '', results: [], loading: false, creating: null, error: null });
      selectConversation(res.conversation.id);
    } catch (err) {
      setNewConversationDialog((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'Não foi possível iniciar a conversa.', creating: null }));
    }
  }, [selectConversation]);

  const closeNewConversationDialog = useCallback(() => {
    searchAbortRef.current?.abort();
    if (debouncedSearchRef.current) clearTimeout(debouncedSearchRef.current);
    setNewConversationDialog({ open: false, search: '', results: [], loading: false, creating: null, error: null });
  }, []);

  const selectedSpace = spaces.find((s) => s.id === selection.spaceId) ?? spaceDetail?.space ?? null;
  const selectedChannel = spaceDetail?.channels.find((c) => c.id === selection.channelId) ?? null;
  const selectedConversation = conversations.find((c) => c.id === selection.conversationId) ?? null;

  const activePane: SelectionType = selection.channelId !== null ? 'channel' : 'dm';

  const [mobileView, setMobileView] = useState<MobileView>('nav');
  const [activeTab, setActiveTab] = useState<'mensagens' | 'servidores'>('mensagens');

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  const currentMessages = currentScopeKey ? messagesByScope[currentScopeKey] ?? [] : [];
  const currentCursor = currentScopeKey ? cursorByScope[currentScopeKey] ?? null : null;
  const hasMore = currentCursor !== null;

  // Se estamos na aba Servidores e nenhum espaço selecionado, mostrar lista de espaços
  const showSpacesList = activeTab === 'servidores';

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background md:flex-row">
      {/* ============ LAYOUT DM (Mensagens Diretas) - IGUAL ANTES ============ */}
      {activePane === 'dm' ? (
        <>
          {/* Sidebar Esquerda: Abas Mensagens/Servidores + Lista */}
          <aside
            className={cn(
              'flex min-h-0 flex-col overflow-hidden border-r border-border bg-surface md:w-[320px] md:shrink-0 md:border-r',
              isMobile && mobileView !== 'nav' && 'hidden',
            )}
            aria-label={activeTab === 'servidores' ? 'Servidores' : 'Mensagens'}
          >
            {/* Abas Mensagens / Servidores */}
            <div className="shrink-0 border-b border-border">
              <div className="flex">
                <button
                  type="button"
                  onClick={() => setActiveTab('mensagens')}
                  className={cn(
                    'flex-1 py-3 px-4 text-sm font-medium text-center transition-colors border-b-2',
                    activeTab === 'mensagens'
                      ? 'border-brand text-brand'
                      : 'border-transparent text-muted hover:text-foreground hover:bg-surface-subtle',
                  )}
                  aria-selected={activeTab === 'mensagens'}
                  role="tab"
                >
                  Mensagens
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('servidores')}
                  className={cn(
                    'flex-1 py-3 px-4 text-sm font-medium text-center transition-colors border-b-2',
                    activeTab === 'servidores'
                      ? 'border-brand text-brand'
                      : 'border-transparent text-muted hover:text-foreground hover:bg-surface-subtle',
                  )}
                  aria-selected={activeTab === 'servidores'}
                  role="tab"
                >
                  Servidores
                </button>
              </div>
            </div>

            <div className="shrink-0 border-b border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {showSpacesList ? (
                    <>
                      <p className="text-[11px] font-bold tracking-[0.18em] text-brand uppercase">Servidores</p>
                      <h1 className="mt-1 truncate font-display text-xl font-semibold text-foreground">Meus servidores</h1>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-bold tracking-[0.18em] text-brand uppercase">Conversas</p>
                      <h1 className="mt-1 truncate font-display text-xl font-semibold text-foreground">Mensagens diretas</h1>
                    </>
                  )}
                </div>
                {showSpacesList ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="primary" onClick={openCreateSpaceDialog} leadingIcon={<Plus className="size-4" />}>
                      Novo servidor
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={openNewConversationDialog} leadingIcon={<MessageSquare className="size-4" />}>
                    Nova conversa
                  </Button>
                )}
              </div>
                {!showSpacesList && (
                  <div className="mt-4">
                    <SearchField
                      id="busca-conversas"
                      value={navSearch}
                      onValueChange={setNavSearch}
                      label="Buscar"
                      placeholder="Buscar por nome ou @usuário…"
                      rounded="lg"
                      className="border-border-strong/70 bg-surface-subtle"
                    />
                  </div>
                )}
                {showSpacesList && (
                  <div className="mt-4">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full justify-center py-2.5 text-xs font-semibold"
                      onClick={openJoinSpaceDialog}
                      leadingIcon={<ExternalLink className="size-4" />}
                    >
                      Entrar com código
                    </Button>
                  </div>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {showSpacesList ? (
                spaces.length > 0 ? (
                  <ul className="space-y-1" role="list">
                    {spaces.map((space) => {
                      const isSelected = selection.spaceId === space.id;
                      const initial = space.name.charAt(0).toUpperCase();
                      const onlineCount = space.onlineCount ?? Math.min(space.memberCount, 1);

                      return (
                        <li key={space.id}>
                          <button
                            type="button"
                            onClick={() => { selectSpace(space.id); if (isMobile) setMobileView('nav'); }}
                            className={cn(
                              'w-full flex min-w-0 items-center justify-between gap-3 rounded-card p-3 transition-colors text-left',
                              isSelected ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-subtle hover:text-foreground',
                            )}
                            aria-pressed={isSelected}
                            aria-label={space.name}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              {space.avatar ? (
                                <Image
                                  src={space.avatar}
                                  alt={space.name}
                                  width={40}
                                  height={40}
                                  unoptimized
                                  className="size-10 shrink-0 rounded-xl object-cover"
                                />
                              ) : (
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/20 font-bold text-brand">
                                  {initial}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{space.name}</p>
                                <p className="truncate text-xs text-muted">{space.memberCount} membro{space.memberCount !== 1 ? 's' : ''}</p>
                              </div>
                            </div>

                            {/* Bolinhas / contagem de membros online no canto direito inferior */}
                            <div className="flex items-center gap-1 shrink-0 self-end mb-0.5" title={`${onlineCount} online`}>
                              <span className="size-2 rounded-full bg-online animate-pulse" />
                              {onlineCount > 1 && (
                                <span className="text-[10px] font-bold text-online">{onlineCount}</span>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
                    <p className="text-sm font-semibold text-foreground">Nenhum servidor ainda</p>
                    <p className="mt-1 text-xs text-muted">Crie seu primeiro servidor ou seja convidado para um.</p>
                  </div>
                )
              ) : (
                conversations.length > 0 ? (
                  <ul className="space-y-0.5" role="list">
                    {conversations
                      .filter((conv) =>
                        conv.other.name.toLowerCase().includes(navSearch.toLowerCase()) ||
                        conv.other.username.toLowerCase().includes(navSearch.toLowerCase()) ||
                        (conv.lastMessage?.body ?? '').toLowerCase().includes(navSearch.toLowerCase())
                      )
                      .map((conv) => (
                      <li key={conv.id}>
                        <button
                          type="button"
                          onClick={() => { selectConversation(conv.id); if (isMobile) setMobileView('main'); }}
                          className={cn(
                            'w-full flex min-w-0 items-center gap-3 rounded-card p-3 transition-colors',
                            selection.conversationId === conv.id ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-subtle hover:text-foreground',
                          )}
                          aria-pressed={selection.conversationId === conv.id}
                          aria-current={selection.conversationId === conv.id ? 'page' : undefined}
                        >
                          <Avatar src={conv.other.avatar} alt={conv.other.name} name={conv.other.name} size="sm" online={undefined} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{conv.other.name}</p>
                            <p className="truncate text-xs text-muted">
                              {conv.lastMessage ? (conv.lastMessage.mine ? 'Você: ' : '') + (conv.lastMessage.sharedPostId ? 'Publicação compartilhada' : conv.lastMessage.body) : 'Conversa sem mensagens'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <time className="text-xs text-subtle">{formatRelativeTime(conv.updatedAt)}</time>
                            {conv.unread > 0 ? (
                              <span className="inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-danger text-white">
                                {conv.unread > 99 ? '99+' : conv.unread}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
                    <p className="text-sm font-semibold text-foreground">Nenhuma conversa ainda</p>
                    <p className="mt-1 text-xs text-muted">Inicie uma conversa para aparecer aqui.</p>
                  </div>
                )
              )}
            </div>
          </aside>

          {/* Pane Principal: Chat DM */}
          <section
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden bg-background',
              isMobile && mobileView !== 'main' && 'hidden',
            )}
            aria-label="Conversa"
          >
            {selection.conversationId === null ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <span aria-hidden="true" className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-surface-subtle text-muted">
                  <MessageSquare className="size-6" />
                </span>
                <h2 className="font-display text-xl font-semibold text-foreground">Escolha uma conversa</h2>
                <p className="mt-1 max-w-sm text-sm leading-6 text-muted">
                  Selecione uma conversa direta para começar.
                </p>
              </div>
            ) : (
              <>
                <ConversationHeader
                  conversation={selectedConversation!}
                  onBack={() => { setSelection({ conversationId: null, spaceId: null, channelId: null }); if (isMobile) setMobileView('nav'); }}
                />
                <MessageList
                  messages={currentMessages}
                  loading={loadingMessages}
                  error={loadError}
                  onRetry={() => loadMessages(selection.conversationId!, undefined, undefined, false)}
                  onLoadMore={handleLoadMore}
                  hasMore={hasMore}
                  isLoadingMore={loadingMore}
                  scrollContainerRef={scrollContainerRef}
                  messagesEndRef={messagesEndRef}
                  onEdit={openEdit}
                  onDelete={openDelete}
                />
                <MessageComposer
                  disabled={!selectedConversation}
                  sending={sending}
                  text={composerText}
                  setText={setComposerText}
                  attachments={composerAttachments}
                  setAttachments={setComposerAttachments}
                  attachmentError={attachmentError}
                  preparing={preparingAttachments}
                  emojiOpen={emojiOpen}
                  setEmojiOpen={setEmojiOpen}
                  inputRef={inputRef}
                  fileInputRef={fileInputRef}
                  onSend={handleSend}
                  onKeyDown={handleKeyDown}
                  insertEmoji={insertEmoji}
                  openFilePicker={openFilePicker}
                  removeAttachment={removeAttachment}
                />
              </>
            )}

            {/* Members Pane (xl) or mobile overlay */}
            {spaceDetail && (
              <MembersPane
                space={spaceDetail.space}
                channels={spaceDetail.channels}
                members={spaceDetail.members}
                selectedChannelId={selection.channelId}
                isOpen={isMobile && mobileView === 'members'}
                onClose={() => setMobileView('main')}
                onAddSpaceMember={openAddSpaceMemberDialog}
                onAddChannelMember={openAddChannelMemberDialog}
                onInvite={openSpaceInviteDialog}
              />
            )}
          </section>
        </>
      ) : activePane === 'channel' ? (
        /* ============ LAYOUT SERVIDOR/CANAIS (NOVO 3 COLUNAS) ============ */
        <>
          {/* Coluna 1: Servidor & Membros (Esquerda) */}
          {spaceDetail ? (
            <aside className="flex min-h-0 flex-col overflow-hidden border-r border-border bg-background-secondary md:w-[280px] md:shrink-0 hidden md:flex">
              {/* Card do Servidor */}
              <div className="relative shrink-0 overflow-hidden">
                <div className="h-24 w-full bg-brand/10" />
                <div className="relative -mt-10 px-4 pb-4">
                  <div className="size-16 overflow-hidden rounded-2xl border-4 border-background-secondary bg-surface shadow-lg">
                    <div className="flex size-full items-center justify-center bg-brand text-2xl font-bold text-white">
                      {spaceDetail.space.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <h2 className="mt-2 truncate font-display text-lg font-bold text-foreground">{spaceDetail.space.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-bold tracking-wider text-muted uppercase">
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-online" />
                      {spaceDetail.members.filter(m => m.presence === 'online').length} Online
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-border-strong" />
                      {spaceDetail.members.length} Membros
                    </span>
                  </div>
                </div>
              </div>

              {/* Convidar / Código */}
              <div className="shrink-0 border-y border-border p-3">
                <Button 
                  variant="primary" 
                  size="sm" 
                  className="w-full justify-start gap-2 rounded-lg"
                  onClick={openSpaceInviteDialog}
                >
                  <UserPlus className="size-4" />
                  Convidar amigos
                </Button>
                <div className="mt-2 rounded-lg bg-surface-subtle p-2 text-center border border-border/50">
                  <p className="text-[10px] font-bold text-muted uppercase">Código de convite rápido</p>
                  <button 
                    onClick={openSpaceInviteDialog}
                    className="mt-1 font-mono text-xs font-bold text-brand hover:underline"
                  >
                    GERAR CÓDIGO
                  </button>
                </div>
              </div>

              {/* Lista de Membros (Ordenada: Online > Ausente > Offline) */}
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
                <p className="px-2 text-[11px] font-bold tracking-widest text-muted uppercase mb-3">Membros — {spaceDetail.members.length}</p>
                <ul className="space-y-1">
                  {spaceDetail.members
                    .sort((a, b) => {
                      const order = { online: 0, idle: 1, offline: 2 };
                      return (order[a.presence] ?? 2) - (order[b.presence] ?? 2) || a.name.localeCompare(b.name);
                    })
                    .map((member) => (
                      <li key={member.userId}>
                        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-subtle group text-left">
                          <div className="relative shrink-0">
                            <Avatar src={member.avatar} name={member.name} size="sm" alt={member.name} />
                            <span 
                              className={cn(
                                "absolute bottom-0 right-0 size-3 rounded-full border-2 border-background-secondary",
                                member.presence === 'online' ? 'bg-online' : member.presence === 'idle' ? 'bg-warning' : 'bg-muted'
                              )}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              "truncate text-sm font-medium transition-colors",
                              member.presence === 'offline' ? 'text-subtle' : 'text-foreground group-hover:text-brand'
                            )}>
                              {member.name}
                            </p>
                            {member.presence !== 'offline' && (
                              <p className="truncate text-[10px] text-muted capitalize">{member.presence}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            </aside>
          ) : (
            <aside className="hidden md:flex md:w-[280px] md:shrink-0 border-r border-border bg-background-secondary min-h-0 flex-col items-center justify-center p-6 text-center text-muted">
              <Users className="mb-2 size-8 opacity-20" />
              <p className="text-xs">Selecione um servidor</p>
            </aside>
          )}

          {/* Coluna 2: Canais (Meio) */}
          {spaceDetail ? (
            <aside className="flex min-h-0 flex-col overflow-hidden border-r border-border bg-surface md:w-[240px] md:shrink-0 hidden md:flex">
              <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
                <h2 className="truncate font-display text-sm font-bold text-foreground">CANAIS</h2>
                <IconButton label="Criar Canal" icon={<Plus className="size-4" />} onClick={openCreateChannelDialog} />
              </header>
              
              <nav className="min-h-0 flex-1 overflow-y-auto p-2">
                {spaceDetail.channels.length === 0 ? (
                  <p className="mt-10 text-center text-xs text-muted px-4">Nenhum canal. Clique no + para criar.</p>
                ) : (
                  <div className="space-y-4">
                    {/* Categoria: Texto */}
                    <div>
                      <div className="flex items-center justify-between px-2 mb-1">
                        <p className="text-[10px] font-bold tracking-widest text-muted uppercase">Texto</p>
                        <IconButton label="Criar canal de texto" icon={<Plus className="size-3" />} onClick={openCreateChannelDialog} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <ul className="space-y-0.5">
                        {spaceDetail.channels
                          .filter((c) => c.type !== 'voice')
                          .map((channel) => (
                            <li key={channel.id}>
                              <button
                                onClick={() => selectChannel(spaceDetail.space.id, channel.id)}
                                className={cn(
                                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                                  selection.channelId === channel.id ? "bg-surface-raised text-foreground font-semibold" : "text-muted hover:bg-surface-subtle hover:text-foreground"
                                )}
                              >
                                <Hash className="size-4 shrink-0" />
                                <span className="truncate">{channel.name}</span>
                                {channel.unreadCount && channel.unreadCount > 0 && (
                                  <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-danger text-white">
                                    {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                                  </span>
                                )}
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>

                    {/* Categoria: Voz e Vídeo */}
                    <div>
                      <div className="flex items-center justify-between px-2 mb-1">
                        <p className="text-[10px] font-bold tracking-widest text-muted uppercase">Voz e Vídeo</p>
                        <IconButton label="Criar canal de voz" icon={<Plus className="size-3" />} onClick={openCreateChannelDialog} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <ul className="space-y-0.5">
                        {spaceDetail.channels
                          .filter((c) => c.type === 'voice')
                          .map((channel) => (
                            <li key={channel.id}>
                              <button
                                onClick={() => selectChannel(spaceDetail.space.id, channel.id)}
                                className={cn(
                                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                                  selection.channelId === channel.id ? "bg-surface-raised text-foreground font-semibold" : "text-muted hover:bg-surface-subtle hover:text-foreground"
                                )}
                              >
                                <Phone className="size-4 shrink-0" />
                                <span className="truncate">{channel.name}</span>
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                )}
              </nav>
            </aside>
          ) : (
            <aside className="hidden md:flex md:w-[240px] md:shrink-0 border-r border-border bg-surface min-h-0 flex-col items-center justify-center p-6 text-center text-muted">
              <Hash className="mb-2 size-8 opacity-20" />
              <p className="text-xs">Selecione um servidor</p>
            </aside>
          )}

          {/* Coluna 3: Principal (Direita) - Participantes + Chat */}
          <main
            className={cn(
              'relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background',
              isMobile && mobileView === 'nav' && 'hidden',
              isMobile && mobileView === 'members' && 'hidden',
            )}
          >
            {!selection.conversationId && !selection.spaceId && !selection.channelId ? (
              <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
                <div className="flex size-20 items-center justify-center rounded-3xl bg-surface-subtle">
                  <MessageSquare className="size-10 text-muted/30" />
                </div>
                <h2 className="mt-6 font-display text-xl font-bold text-foreground">Bem-vindo ao Orbit</h2>
                <p className="mt-2 max-w-xs text-sm text-muted">
                  Selecione um servidor à esquerda ou uma conversa para começar a interagir.
                </p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Cabeçalho do Canal */}
                {spaceDetail ? (
                  <ChannelHeader
                    channel={selectedChannel ?? null}
                    space={spaceDetail.space}
                    onBack={() => setMobileView('nav')}
                    onMembers={() => setMobileView('members')}
                    onAddMember={undefined}
                    onInvite={openSpaceInviteDialog}
                    showMembersButton={true}
                  />
                ) : null}

                <div className="flex flex-1 flex-col min-h-0">
                  {/* Área de Participantes (Voz/Vídeo) */}
                  {selectedChannel?.type === 'voice' && (
                    <div className="flex-1 bg-background-secondary p-4 flex flex-col items-center justify-center relative group min-h-[320px]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl h-full items-center content-center">
                        {spaceDetail?.members
                          .sort((a, b) => {
                            const order = { online: 0, idle: 1, offline: 2 };
                            return (order[a.presence] ?? 2) - (order[b.presence] ?? 2);
                          })
                          .slice(0, 6)
                          .map((member, idx) => (
                            <div 
                              key={member.userId} 
                              className="aspect-video rounded-2xl bg-surface-raised border border-border/50 flex flex-col items-center justify-center relative overflow-hidden group"
                            >
                              {/* Indicador de fala (simulado) */}
                              {idx === 0 && (
                                <div className="absolute inset-0 bg-brand/10 flex items-center justify-center z-10 pointer-events-none">
                                  <Video className="size-12 opacity-20" />
                                </div>
                              )}
                              <div className="flex flex-col items-center justify-center z-20">
                                <Avatar src={member.avatar} name={member.name} size="xl" alt={member.name} />
                                <p className="mt-3 text-sm font-semibold text-foreground text-center px-2">{member.name}</p>
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 px-2 py-1 rounded text-[10px] font-bold uppercase text-white">
                                  {member.presence === 'online' ? 'Online' : member.presence === 'idle' ? 'Ausente' : 'Offline'}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* Controles Flutuantes */}
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-surface-raised/95 backdrop-blur-xl p-3 rounded-2xl border border-border shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                        <IconButton label="Ativar Câmera" icon={<Video className="size-5" />} />
                        <IconButton label="Compartilhar Tela" icon={<ExternalLink className="size-5" />} />
                        <IconButton label="Mutar Microfone" icon={<Smile className="size-5" />} />
                        <Button variant="danger" size="sm" className="rounded-xl px-4">Sair</Button>
                      </div>
                    </div>
                  )}

                  {/* Área de Mensagens */}
                  <div className={cn("flex flex-col min-h-0", selectedChannel?.type === 'voice' ? "h-[300px] border-t border-border" : "flex-1")}>
                    {spaceDetail ? (
                      <>
                        <MessageList
                          messages={currentMessages}
                          loading={loadingMessages}
                          error={loadError}
                          onRetry={() => loadMessages(undefined, selection.channelId!, undefined, false)}
                          onLoadMore={handleLoadMore}
                          hasMore={hasMore}
                          isLoadingMore={loadingMore}
                          scrollContainerRef={scrollContainerRef}
                          messagesEndRef={messagesEndRef}
                          onEdit={openEdit}
                          onDelete={openDelete}
                        />
                        <div className="shrink-0 p-4">
                          <div className="mx-auto w-full max-w-4xl">
                            <MessageComposer
                              disabled={!selectedChannel}
                              sending={sending}
                              text={composerText}
                              setText={setComposerText}
                              attachments={composerAttachments}
                              setAttachments={setComposerAttachments}
                              attachmentError={attachmentError}
                              preparing={preparingAttachments}
                              emojiOpen={emojiOpen}
                              setEmojiOpen={setEmojiOpen}
                              inputRef={inputRef}
                              fileInputRef={fileInputRef}
                              onSend={handleSend}
                              onKeyDown={handleKeyDown}
                              insertEmoji={insertEmoji}
                              openFilePicker={openFilePicker}
                              removeAttachment={removeAttachment}
                            />
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </main>
        </>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALL_ATTACHMENTS_ACCEPT}
        className="sr-only"
        disabled={sending || preparingAttachments}
        onChange={(e) => { const files = Array.from(e.currentTarget.files ?? []); e.currentTarget.value = ''; void handleFiles(files); }}
      />

      {/* Dialogs */}
      <ChatDialog
        isOpen={joinSpaceDialog.open}
        onClose={closeJoinSpaceDialog}
        title="Entrar no servidor"
        description="Digite o código de convite de 5 caracteres para participar do servidor."
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="join-space-code" className="block text-sm font-medium text-foreground mb-1">
              Código do convite
            </label>
            <input
              id="join-space-code"
              type="text"
              maxLength={5}
              value={joinSpaceDialog.code}
              onChange={(e) => setJoinSpaceDialog((prev) => ({ ...prev, code: e.target.value.toUpperCase(), error: null }))}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-center text-lg font-mono tracking-widest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              placeholder="ABC12"
              autoComplete="off"
              data-autofocus
              disabled={joinSpaceDialog.submitting}
            />
          </div>
          {joinSpaceDialog.error && (
            <p className="text-sm text-danger" role="alert">{joinSpaceDialog.error}</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={closeJoinSpaceDialog} disabled={joinSpaceDialog.submitting} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={confirmJoinSpace} disabled={joinSpaceDialog.submitting || joinSpaceDialog.code.length !== 5} className="flex-1">
              {joinSpaceDialog.submitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </div>
        </div>
      </ChatDialog>

      <ChatDialog
        isOpen={createSpaceDialog.open}
        onClose={() => setCreateSpaceDialog({ open: false, name: '', description: '', error: null, submitting: false })}
        title="Criar servidor"
        description="Dê um nome ao seu servidor e comece a conversar."
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="create-space-name" className="block text-sm font-medium text-foreground mb-1">
              Nome do servidor
            </label>
            <input
              id="create-space-name"
              type="text"
              maxLength={50}
              value={createSpaceDialog.name}
              onChange={(e) => setCreateSpaceDialog((prev) => ({ ...prev, name: e.target.value, error: null }))}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              placeholder="Meu servidor"
              data-autofocus
              disabled={createSpaceDialog.submitting}
            />
          </div>
          <div>
            <label htmlFor="create-space-desc" className="block text-sm font-medium text-foreground mb-1">
              Descrição (opcional)
            </label>
            <textarea
              id="create-space-desc"
              maxLength={200}
              value={createSpaceDialog.description}
              onChange={(e) => setCreateSpaceDialog((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-h-[80px] resize-y"
              placeholder="Sobre o que é este servidor?"
              disabled={createSpaceDialog.submitting}
            />
          </div>
          {createSpaceDialog.error && (
            <p className="text-sm text-danger" role="alert">{createSpaceDialog.error}</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateSpaceDialog({ open: false, name: '', description: '', error: null, submitting: false })} disabled={createSpaceDialog.submitting} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={confirmCreateSpace} disabled={createSpaceDialog.submitting || !createSpaceDialog.name.trim()} className="flex-1">
              {createSpaceDialog.submitting ? 'Criando...' : 'Criar servidor'}
            </Button>
          </div>
        </div>
      </ChatDialog>

      <ChatDialog
        isOpen={createChannelDialog.open}
        onClose={() => setCreateChannelDialog({ open: false, name: '', topic: '', visibility: 'public', error: null, submitting: false })}
        title="Criar canal"
        description="Configure o novo canal para este servidor."
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="create-channel-name" className="block text-sm font-medium text-foreground mb-1">
              Nome do canal
            </label>
            <input
              id="create-channel-name"
              type="text"
              maxLength={30}
              value={createChannelDialog.name}
              onChange={(e) => setCreateChannelDialog((prev) => ({ ...prev, name: e.target.value, error: null }))}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              placeholder="geral"
              data-autofocus
              disabled={createChannelDialog.submitting}
            />
          </div>
          <div>
            <label htmlFor="create-channel-topic" className="block text-sm font-medium text-foreground mb-1">
              Tópico (opcional)
            </label>
            <input
              id="create-channel-topic"
              type="text"
              maxLength={100}
              value={createChannelDialog.topic}
              onChange={(e) => setCreateChannelDialog((prev) => ({ ...prev, topic: e.target.value }))}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              placeholder="Sobre o que é este canal?"
              disabled={createChannelDialog.submitting}
            />
          </div>
          <fieldset>
            <legend className="block text-sm font-medium text-foreground mb-2">Visibilidade</legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="channel-visibility"
                  value="public"
                  checked={createChannelDialog.visibility === 'public'}
                  onChange={(e) => setCreateChannelDialog((prev) => ({ ...prev, visibility: e.target.value as 'public' | 'private' }))}
                  className="size-4 text-brand border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  disabled={createChannelDialog.submitting}
                />
                <span className="text-sm text-foreground">Público</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="channel-visibility"
                  value="private"
                  checked={createChannelDialog.visibility === 'private'}
                  onChange={(e) => setCreateChannelDialog((prev) => ({ ...prev, visibility: e.target.value as 'public' | 'private' }))}
                  className="size-4 text-brand border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  disabled={createChannelDialog.submitting}
                />
                <span className="text-sm text-foreground">Privado</span>
              </label>
            </div>
          </fieldset>
          {createChannelDialog.error && (
            <p className="text-sm text-danger" role="alert">{createChannelDialog.error}</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateChannelDialog({ open: false, name: '', topic: '', visibility: 'public', error: null, submitting: false })} disabled={createChannelDialog.submitting} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={confirmCreateChannel} disabled={createChannelDialog.submitting || !createChannelDialog.name.trim()} className="flex-1">
              {createChannelDialog.submitting ? 'Criando...' : 'Criar canal'}
            </Button>
          </div>
        </div>
      </ChatDialog>

      <ChatDialog
        isOpen={addSpaceMemberDialog.open}
        onClose={() => setAddSpaceMemberDialog({ open: false, username: '', error: null, submitting: false })}
        title="Adicionar membro ao espaço"
        description="Digite o @username do usuário que deseja adicionar."
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="add-space-member-username" className="block text-sm font-medium text-foreground mb-1">
              @username
            </label>
            <input
              id="add-space-member-username"
              type="text"
              maxLength={30}
              value={addSpaceMemberDialog.username}
              onChange={(e) => setAddSpaceMemberDialog((prev) => ({ ...prev, username: e.target.value.replace(/^@/, ''), error: null }))}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              placeholder="usuario"
              data-autofocus
              disabled={addSpaceMemberDialog.submitting}
            />
          </div>
          {addSpaceMemberDialog.error && (
            <p className="text-sm text-danger" role="alert">{addSpaceMemberDialog.error}</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddSpaceMemberDialog({ open: false, username: '', error: null, submitting: false })} disabled={addSpaceMemberDialog.submitting} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={confirmAddSpaceMember} disabled={addSpaceMemberDialog.submitting || !addSpaceMemberDialog.username.trim()} className="flex-1">
              {addSpaceMemberDialog.submitting ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </ChatDialog>

      <ChatDialog
        isOpen={addChannelMemberDialog.open}
        onClose={() => setAddChannelMemberDialog({ open: false, channelId: null, username: '', error: null, submitting: false })}
        title="Adicionar membro ao canal"
        description="Digite o @username do usuário que deseja adicionar ao canal privado."
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="add-channel-member-username" className="block text-sm font-medium text-foreground mb-1">
              @username
            </label>
            <input
              id="add-channel-member-username"
              type="text"
              maxLength={30}
              value={addChannelMemberDialog.username}
              onChange={(e) => setAddChannelMemberDialog((prev) => ({ ...prev, username: e.target.value.replace(/^@/, ''), error: null }))}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              placeholder="usuario"
              data-autofocus
              disabled={addChannelMemberDialog.submitting}
            />
          </div>
          {addChannelMemberDialog.error && (
            <p className="text-sm text-danger" role="alert">{addChannelMemberDialog.error}</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddChannelMemberDialog({ open: false, channelId: null, username: '', error: null, submitting: false })} disabled={addChannelMemberDialog.submitting} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={confirmAddChannelMember} disabled={addChannelMemberDialog.submitting || !addChannelMemberDialog.username.trim()} className="flex-1">
              {addChannelMemberDialog.submitting ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </ChatDialog>

      <ChatDialog
        isOpen={spaceInviteDialog.open}
        onClose={closeSpaceInviteDialog}
        title="Convite do servidor"
        description={spaceInviteDialog.code ? 'Compartilhe este código para convidar pessoas. Expira em 1 hora.' : 'Gerando código de convite...'}
      >
        <div className="space-y-4">
          {spaceInviteDialog.generating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-brand" />
              <span className="ml-3 text-sm text-muted">Gerando código...</span>
            </div>
          ) : spaceInviteDialog.code ? (
            <>
              <div className="flex items-center gap-2 p-4 rounded-xl bg-surface border border-border">
                <code className="flex-1 text-center text-2xl font-mono tracking-widest text-foreground select-all" id="invite-code-display">{spaceInviteDialog.code}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(spaceInviteDialog.code!);
                  }}
                  aria-label="Copiar código"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              {spaceInviteDialog.expiresAt && (
                <p className="text-xs text-muted text-center">
                  Expira em <time dateTime={new Date(spaceInviteDialog.expiresAt).toISOString()}>{new Date(spaceInviteDialog.expiresAt).toLocaleString('pt-BR')}</time>
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={closeSpaceInviteDialog} className="flex-1">
                  Fechar
                </Button>
                <Button onClick={() => { navigator.clipboard.writeText(spaceInviteDialog.code!); }} className="flex-1">
                  <Copy className="size-4 mr-1" /> Copiar
                </Button>
              </div>
            </>
          ) : null}
          {spaceInviteDialog.error && (
            <p className="text-sm text-danger" role="alert">{spaceInviteDialog.error}</p>
          )}
        </div>
      </ChatDialog>

      <ChatDialog
        isOpen={newConversationDialog.open}
        onClose={closeNewConversationDialog}
        title="Nova conversa"
        description="Busque um usuário para iniciar uma conversa direta."
      >
        <div className="space-y-4 max-h-[60vh] flex flex-col">
          <div>
            <label htmlFor="new-conv-search" className="block text-sm font-medium text-foreground mb-1">
              Buscar usuário
            </label>
            <input
              id="new-conv-search"
              type="text"
              value={newConversationDialog.search}
              onChange={(e) => handleConversationSearchChange(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              placeholder="Digite @username ou nome..."
              data-autofocus
              disabled={newConversationDialog.loading || !!newConversationDialog.creating}
            />
          </div>
          {newConversationDialog.error && (
            <p className="text-sm text-danger" role="alert">{newConversationDialog.error}</p>
          )}
          <div className="flex-1 overflow-y-auto">
            {newConversationDialog.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-brand" />
                <span className="ml-3 text-sm text-muted">Buscando...</span>
              </div>
            ) : newConversationDialog.results.length > 0 ? (
              <ul className="space-y-1" role="list">
                {newConversationDialog.results.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => handleCreateConversation(user.username)}
                      disabled={newConversationDialog.creating === user.username}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-subtle transition-colors disabled:opacity-50"
                    >
                      <Avatar src={user.avatar} alt={user.name} name={user.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                        <p className="truncate text-xs text-muted">@{user.username}</p>
                      </div>
                      {newConversationDialog.creating === user.username && <Loader2 className="size-4 animate-spin text-brand" />}
                    </button>
                  </li>
                ))}
              </ul>
            ) : newConversationDialog.search ? (
              <p className="text-sm text-muted text-center py-8">Nenhum usuário encontrado.</p>
            ) : (
              <p className="text-sm text-muted text-center py-8">Digite um nome ou @username para buscar.</p>
            )}
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="secondary" onClick={closeNewConversationDialog} disabled={newConversationDialog.loading || !!newConversationDialog.creating} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </ChatDialog>

      <ChatDialog
        isOpen={editDialog.open}
        onClose={() => setEditDialog({ open: false, message: null, text: '' })}
        title="Editar mensagem"
      >
        <div className="space-y-4">
          <textarea
            value={editDialog.text}
            onChange={(e) => setEditDialog((prev) => ({ ...prev, text: e.target.value }))}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-h-[100px] resize-y"
            data-autofocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setEditDialog({ open: false, message: null, text: '' })}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>
              Salvar
            </Button>
          </div>
        </div>
      </ChatDialog>

      <ChatDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, message: null })}
        title="Excluir mensagem"
        description="Esta ação não pode ser desfeita."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">Tem certeza que deseja excluir esta mensagem?</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteDialog({ open: false, message: null })}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Excluir
            </Button>
          </div>
        </div>
      </ChatDialog>
    </div>
  );
}

/* ===== Sub-components ===== */

function ChannelHeader({
  channel,
  space,
  onBack,
  onMembers,
  onAddMember,
  onInvite,
  showMembersButton,
}: {
  channel: Channel | null;
  space: Space;
  onBack: () => void;
  onMembers: () => void;
  onAddMember: (() => void) | undefined;
  onInvite: () => void;
  showMembersButton: boolean;
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3">
      <button type="button" onClick={onBack} className="md:hidden" aria-label="Voltar">
        <ChevronLeft className="size-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Hash className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">#{channel?.name}</p>
          <p className="truncate text-xs font-medium text-brand">{space.name}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {showMembersButton && onAddMember && (
          <IconButton label="Adicionar membro" icon={<UserPlus className="size-5" />} onClick={onAddMember} />
        )}
        {showMembersButton && (
          <IconButton label="Membros" icon={<Users className="size-5" />} onClick={onMembers} />
        )}
        {showMembersButton && (
          <IconButton label="Convidar" icon={<ExternalLink className="size-5" />} onClick={onInvite} />
        )}
        <IconButton label="Mais opções" icon={<MoreHorizontal className="size-5" />} disabled />
      </div>
    </header>
  );
}

function ConversationHeader({
  conversation,
  onBack,
}: { conversation: ConversationSummary; onBack: () => void }) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3">
      <button type="button" onClick={onBack} className="md:hidden" aria-label="Voltar">
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        onClick={() => {}}
      >
        <Avatar src={conversation.other.avatar} alt={conversation.other.name} name={conversation.other.name} size="md" online={undefined} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{conversation.other.name}</span>
          <span className="mt-0.5 block text-xs text-muted">@{conversation.other.username}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton label="Chamada de voz (em breve)" icon={<Phone className="size-5" />} disabled />
        <IconButton label="Chamada de vídeo (em breve)" icon={<Video className="size-5" />} disabled />
        <IconButton label="Mais opções" icon={<MoreHorizontal className="size-5" />} disabled />
      </div>
    </header>
  );
}

function MessageList({
  messages,
  loading,
  error,
  onRetry,
  onLoadMore,
  hasMore,
  isLoadingMore,
  scrollContainerRef,
  messagesEndRef,
  onEdit,
  onDelete,
}: {
  messages: MessageWithScope[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onEdit: ((msg: MessageWithScope) => void) | null;
  onDelete: ((msg: MessageWithScope) => void) | null;
}) {
  const groups = useMemo(() => groupMessagesByDay(messages), [messages]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center" role="status" aria-live="polite">
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" /> Carregando mensagens…
        </span>
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-semibold text-foreground">Não foi possível carregar as mensagens</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted">{error}</p>
        <button type="button" onClick={onRetry} className="mt-4 rounded-pill border border-border bg-surface-raised px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-brand/30 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span aria-hidden="true" className="mb-3 inline-flex size-12 items-center justify-center rounded-full bg-surface-subtle text-muted">
          <MessageSquare className="size-5" />
        </span>
        <p className="text-sm font-semibold text-foreground">Diga olá para começar</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted">Esta conversa ainda não tem mensagens. Envie a primeira mensagem abaixo.</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="min-h-0 flex-1 overflow-y-auto"
      onScroll={(e) => {
        const target = e.currentTarget;
        if (target.scrollTop === 0 && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      }}
    >
      <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6">
        {hasMore && (
          <button type="button" onClick={onLoadMore} disabled={isLoadingMore} className="self-center mb-2 text-xs text-muted hover:text-foreground disabled:opacity-50">
            {isLoadingMore ? <Loader2 className="inline size-3 animate-spin" /> : 'Carregar mensagens anteriores'}
          </button>
        )}
        {groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-1.5" aria-label={group.label}>
            <div className="flex items-center gap-3" role="separator" aria-label={group.label}>
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-bold tracking-[0.12em] text-subtle uppercase">{group.label}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            {group.messages.map((message) => (
              <MessageBubble key={message.id} message={message} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </section>
        ))}
        <div ref={messagesEndRef} className="h-px" />
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onEdit,
  onDelete,
}: {
  message: MessageWithScope;
  onEdit: ((msg: MessageWithScope) => void) | null;
  onDelete: ((msg: MessageWithScope) => void) | null;
}) {
  const isMine = message.mine;
  const sharedMedia = message.sharedPost?.media?.[0]?.url;
  const safeSharedMedia = sharedMedia && isSafeMediaSource(sharedMedia) ? sharedMedia : null;
  const isVideo = message.sharedPost?.media?.[0]?.mediaType === 'video';
  const hasBody = Boolean(message.body.trim());
  const attachments = message.media ?? [];
  const sender = message.sender;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems: DropdownMenuItem[] = useMemo(() => {
    if (!isMine || !onEdit || !onDelete) return [];
    return [
      { id: 'edit', label: 'Editar', icon: <Pencil className="size-4" />, onSelect: () => onEdit(message) },
      { id: 'delete', label: 'Excluir', icon: <Trash2 className="size-4" />, destructive: true, onSelect: () => onDelete(message) },
    ];
  }, [isMine, message, onEdit, onDelete]);

  return (
    <article className="flex gap-3" ref={menuRef}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Avatar src={sender.avatar} alt={sender.name} name={sender.name} size="sm" online={undefined} />
          <div className="flex min-w-0 items-center gap-2">
            <strong className="truncate text-sm text-foreground">{sender.name}</strong>
            {sender.verified && <span className="size-3.5 shrink-0 text-brand" aria-label="Perfil verificado">✓</span>}
            <time className="shrink-0 text-[10px] text-subtle" dateTime={new Date(message.createdAt).toISOString()}>
              {formatClockTime(message.createdAt)}
            </time>
            {message.editedAt && <span className="text-[10px] text-subtle">(editado)</span>}
            {message.deletedAt && <span className="text-[10px] text-danger">(excluída)</span>}
          </div>
        </div>
        {message.deletedAt ? (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-muted italic">Esta mensagem foi excluída.</p>
        ) : (
          <>
            {hasBody && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{message.body}</p>}
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((attachment, index) => (
                  <MessageAttachment key={`${attachment.url}-${index}`} attachment={attachment} />
                ))}
              </div>
            )}
            {message.sharedPost && (
              <div className="mt-2 overflow-hidden rounded-xl border border-border bg-surface-subtle">
                {safeSharedMedia ? (
                  isVideo ? (
                    <video
                      src={safeSharedMedia}
                      muted
                      playsInline
                      preload="metadata"
                      controls
                      style={{ aspectRatio: '468 / 585' }}
                      className="w-full bg-surface-subtle object-cover"
                      aria-label="Vídeo compartilhado na conversa"
                    />
                  ) : (
                    <Image
                      src={safeSharedMedia}
                      alt={message.sharedPost.caption || 'Foto compartilhada na conversa'}
                      width={468}
                      height={585}
                      unoptimized
                      className="h-auto w-full bg-surface-subtle object-cover"
                    />
                  )
                ) : (
                  <span style={{ aspectRatio: '468 / 585' }} className="flex w-full items-center justify-center text-xs text-muted">
                    Publicação sem imagem
                  </span>
                )}
                <div className="flex items-start gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">Publicação compartilhada</p>
                    {message.sharedPost.caption && <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{message.sharedPost.caption}</p>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {isMine ? (
        <div className="flex shrink-0 items-end relative">
          <span className="size-3.5 text-subtle" aria-label="Mensagem enviada">✓✓</span>
          {menuItems.length > 0 && (
            <DropdownMenu
              items={menuItems}
              trigger={<IconButton label="Opções da mensagem" icon={<MoreHorizontal className="size-4" />} disabled={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="size-9 ml-1 text-muted" />}
              triggerClassName="ml-1"
              menuClassName="min-w-[160px]"
            />
          )}
        </div>
      ) : null}
    </article>
  );
}

function MessageAttachment({ attachment }: { attachment: MessageMedia }) {
  const safeSource = isSafeMediaSource(attachment.url) ? attachment.url : null;
  if (!safeSource) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
        <span className="size-4 shrink-0">📄</span> Anexo indisponível
      </div>
    );
  }
  if (attachment.mediaType === 'image') {
    return (
      <div className="mt-2 max-w-md overflow-hidden rounded-xl border border-border bg-surface-subtle">
        <Image
          src={safeSource}
          alt={attachment.fileName || 'Imagem enviada na mensagem'}
          width={1024}
          height={1024}
          unoptimized
          className="h-auto max-h-96 w-full object-contain"
        />
      </div>
    );
  }
  return (
    <a href={safeSource} download={attachment.fileName || undefined} className="mt-2 flex max-w-md items-center gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-2.5 transition-colors hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <span className="size-5">📄</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-foreground">{attachment.fileName || 'Documento'}</span>
        <span className="block truncate text-[10px] text-muted">{formatBytes(attachment.sizeBytes ?? 0) || attachment.mimeType || 'Documento'}</span>
      </span>
      <span className="size-4 shrink-0 text-muted">⬇</span>
    </a>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageComposer({
  disabled,
  sending,
  text,
  setText,
  attachments,
  setAttachments,
  attachmentError,
  preparing,
  emojiOpen,
  setEmojiOpen,
  inputRef,
  fileInputRef,
  onSend,
  onKeyDown,
  insertEmoji,
  openFilePicker,
  removeAttachment,
}: {
  disabled: boolean;
  sending: boolean;
  text: string;
  setText: (v: string) => void;
  attachments: ComposerAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<ComposerAttachment[]>>;
  attachmentError: string | null;
  preparing: boolean;
  emojiOpen: boolean;
  setEmojiOpen: React.Dispatch<React.SetStateAction<boolean>>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  insertEmoji: (emoji: string) => void;
  openFilePicker: (mode: 'all' | 'image' | 'document') => void;
  removeAttachment: (id: string) => void;
}) {
  const busy = sending || preparing;
  const canSend = (text.trim().length > 0 || attachments.length > 0) && !disabled && !busy;
  const placeholder = disabled ? 'Mensagens indisponíveis' : 'Mensagem…';

  return (
    <div className="shrink-0 border-t border-border bg-surface px-3 py-3 sm:px-5 sm:py-4">
      {disabled && <p className="mx-auto mb-2 max-w-3xl rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-center text-xs text-warning">Você não pode enviar mensagens neste canal.</p>}
      {attachments.length > 0 && (
        <div className="mx-auto mb-2 flex max-w-3xl gap-2 overflow-x-auto pb-1" aria-label="Anexos selecionados">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex min-w-0 max-w-[220px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 pr-2">
              {attachment.kind === 'image' && attachment.previewUrl ? (
                <span className="size-10 shrink-0 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url("${attachment.previewUrl}")` }} role="img" aria-label={`Prévia de ${attachment.file.name}`} />
              ) : (
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/8 text-muted"><span className="size-4">📄</span></span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">{attachment.file.name}</span>
                <span className="block text-[10px] text-muted">{formatBytes(attachment.sizeBytes)}</span>
              </span>
              <button type="button" onClick={() => removeAttachment(attachment.id)} className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" aria-label={`Remover ${attachment.file.name}`}>
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      {attachmentError && <p className="mx-auto mb-2 max-w-3xl text-center text-xs text-danger" role="alert">{attachmentError}</p>}
      <div className="relative mx-auto flex max-w-3xl items-center gap-1.5 rounded-2xl border border-border bg-surface-subtle px-1.5 py-1.5 focus-within:border-brand">
        {emojiOpen && (
          <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-30 grid w-[248px] grid-cols-8 gap-1 rounded-2xl border border-border bg-surface p-2 shadow-float" role="dialog" aria-label="Escolher emoji">
            {EMOJIS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="inline-flex size-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" aria-label={`Inserir ${emoji}`}>{emoji}</button>
            ))}
          </div>
        )}
        <input ref={fileInputRef} type="file" multiple accept={ALL_ATTACHMENTS_ACCEPT} className="sr-only" disabled={disabled || busy} />
        <IconButton label="Anexar arquivo" icon={<Paperclip className="size-5" />} onClick={() => openFilePicker('all')} disabled={disabled || busy} className="size-9 text-muted" />
        <textarea
          ref={inputRef}
          id="mensagem-texto"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60 resize-none"
          style={{ minHeight: '40px', maxHeight: '160px' }}
        />
        <IconButton label="Inserir emoji" icon={<Smile className="size-5" />} onClick={() => setEmojiOpen((v) => !v)} disabled={disabled} className="size-9 text-muted" />
        <Button type="button" onClick={onSend} disabled={!canSend} aria-label="Enviar mensagem" className={cn('size-9 shrink-0 rounded-xl p-0', !canSend && 'opacity-45')}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function MembersPane({
  space,
  channels,
  members,
  selectedChannelId,
  isOpen,
  onClose,
  onAddSpaceMember,
  onAddChannelMember,
  onInvite,
}: {
  space: Space;
  channels: Channel[];
  members: SpaceMember[];
  selectedChannelId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onAddSpaceMember: () => void;
  onAddChannelMember: (channelId: number) => void;
  onInvite: () => void;
}) {
  if (typeof window === 'undefined') return null;
  const selectedChannel = channels.find((c) => c.id === selectedChannelId);
  const isPrivateChannel = selectedChannel?.visibility === 'private';

  return (
    <div className={cn('fixed inset-0 z-[80] md:hidden', isOpen ? 'flex' : 'hidden')} onClick={onClose}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <aside className="relative z-10 flex max-w-sm w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-float animate-in slide-in-from-right duration-200">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-semibold text-foreground">Membros</h2>
          <button type="button" onClick={onClose} className="size-8 rounded-full bg-surface-subtle flex items-center justify-center text-foreground hover:bg-surface-hover" aria-label="Fechar"><X className="size-4" /></button>
        </header>
        <div className="shrink-0 border-b border-border px-4 py-2">
          <button type="button" onClick={onAddSpaceMember} className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-brand hover:bg-brand-soft transition-colors">
            <UserPlus className="size-4" />
            Adicionar ao espaço
          </button>
        </div>
        <div className="shrink-0 border-b border-border px-4 py-2">
          <button type="button" onClick={onInvite} className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-brand hover:bg-brand-soft transition-colors">
            <ExternalLink className="size-4" />
            Convidar (código)
          </button>
        </div>
        {isPrivateChannel && selectedChannelId && (
          <div className="shrink-0 border-b border-border px-4 py-2">
            <button type="button" onClick={() => onAddChannelMember(selectedChannelId)} className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-brand hover:bg-brand-soft transition-colors">
              <UserPlus className="size-4" />
              Adicionar ao canal
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {members.map((member) => (
            <div key={member.userId} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <Avatar src={member.avatar} alt={member.name} name={member.name} size="sm" online={undefined} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
                <p className="truncate text-xs text-muted">@{member.username}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-medium bg-surface-subtle text-muted">{member.role}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}