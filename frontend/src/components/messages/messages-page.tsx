/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageSquare, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  loadMutedConversations,
  loadPinnedConversations,
  toggleMutedConversation,
  togglePinnedConversation,
} from '@/lib/conversation-prefs';
import type {
  ConversationDetailResponse,
  ConversationsResponse,
  ConversationSummary,
  Message,
  MessageAttachmentInput,
  SendMessagePayload,
  SendMessageResponse,
} from '@/lib/types';

import { ChatHeader } from './chat-header';
import type { ConversationFilter } from './conversation-filters';
import { ConversationSidebar } from './conversation-sidebar';
import { MessageComposer } from './message-composer';
import { MessageList } from './message-list';
import { NewConversationModal } from './new-conversation-modal';

interface MensagensViewProps {
  initialConversations: ConversationSummary[];
  initialConversationId?: number | null;
}

const POLLING_INTERVAL_MS = 15_000;

function parseConversationId(value: string | null | undefined): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function reasonForCanSend(reason: string | null): string | null {
  switch (reason) {
    case 'match_ended':
      return 'Este match foi encerrado. Você não pode mais enviar mensagens.';
    case 'dating_locked':
      return 'O Namoro exige verificação de identidade e idade aprovada.';
    case 'messaging_policy':
      return 'Este perfil não aceita novas mensagens no momento.';
    default:
      return null;
  }
}

export function MessagesPage({ initialConversations, initialConversationId }: MensagensViewProps) {
  const searchParams = useSearchParams();
  const queryConversationId = parseConversationId(searchParams.get('conversa'));
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<number | null>(initialConversationId ?? queryConversationId);
  const [detail, setDetail] = useState<ConversationDetailResponse | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);
  const [mutedIds, setMutedIds] = useState<number[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const detailRequestRef = useRef(0);
  const conversationsRequestRef = useRef(0);

  useEffect(() => {
    setPinnedIds(loadPinnedConversations());
    setMutedIds(loadMutedConversations());
  }, []);

  useEffect(() => {
    if (queryConversationId !== selectedId) {
      setSelectedId(queryConversationId);
    }
  }, [queryConversationId, selectedId]);

  const refreshConversations = useCallback(async () => {
    const requestId = ++conversationsRequestRef.current;
    try {
      const response = await apiRequest<ConversationsResponse>('/api/conversations');
      if (requestId !== conversationsRequestRef.current) return;
      setConversations(response.conversations);
    } catch {
      /* Mantém lista atual durante falha temporária de polling. */
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshConversations();
    }, POLLING_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      conversationsRequestRef.current += 1;
    };
  }, [refreshConversations]);

  const loadDetail = useCallback(async (
    conversationId: number,
    options: { preserveCurrent?: boolean } = {},
  ) => {
    const requestId = ++detailRequestRef.current;
    setLoadingDetail(true);
    setDetailError(null);
    // Troca de conversa: limpa estado antigo sem flash da conversa anterior.
    // Polling: preserva detalhe e rascunho para não desmontar o compositor.
    if (!options.preserveCurrent) {
      setDetail(null);
      setMessages([]);
    }
    try {
      const response = await apiRequest<ConversationDetailResponse>(
        `/api/conversations/${conversationId}`,
      );
      if (requestId !== detailRequestRef.current) return;
      setDetail(response);
      setMessages(response.messages);
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unread: 0 } : conversation,
        ),
      );
      try {
        await apiRequest(`/api/conversations/${conversationId}/read`, { method: 'POST' });
      } catch {
        /* Leitura é idempotente; falha não deve esconder mensagens. */
      }
    } catch (error) {
      if (requestId !== detailRequestRef.current) return;
      setDetail(null);
      setMessages([]);
      setDetailError(error instanceof Error ? error.message : 'Não foi possível carregar a conversa.');
    } finally {
      if (requestId === detailRequestRef.current) setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      detailRequestRef.current += 1;
      setDetail(null);
      setMessages([]);
      setDetailError(null);
      return;
    }
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setInterval(() => {
      void loadDetail(selectedId, { preserveCurrent: true });
    }, POLLING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadDetail, selectedId]);

  const isPinned = selectedId ? pinnedIds.includes(selectedId) : false;
  const isMuted = selectedId ? mutedIds.includes(selectedId) : false;
  const canSend = detail?.conversation.canSend ?? false;
  const canSendReason = reasonForCanSend(detail?.conversation.reason ?? null);
  const selectedUser = detail?.other ?? null;

  function updateConversationUrl(conversationId: number | null) {
    const url = new URL(window.location.href);
    if (conversationId) url.searchParams.set('conversa', String(conversationId));
    else url.searchParams.delete('conversa');
    window.history.pushState(null, '', url.toString());
  }

  function handleSelectConversation(conversationId: number) {
    setSelectedId(conversationId);
    setActionMessage(null);
    updateConversationUrl(conversationId);
  }

  function handleBack() {
    setSelectedId(null);
    setActionMessage(null);
    updateConversationUrl(null);
  }

  function handleTogglePinned() {
    if (!selectedId) return;
    setPinnedIds(togglePinnedConversation(selectedId));
  }

  function handleToggleMuted() {
    if (!selectedId) return;
    setMutedIds(toggleMutedConversation(selectedId));
  }

  async function handleSend(text: string, media: MessageAttachmentInput[] = []): Promise<boolean> {
    if (!selectedId || !canSend) return false;
    setSending(true);
    setActionMessage(null);
    try {
      const body: SendMessagePayload = { text, media };
      const response = await apiRequest<SendMessageResponse>(
        `/api/conversations/${selectedId}/messages`,
        { method: 'POST', body },
      );
      setMessages((previous) => [...previous, response.message]);
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === selectedId
            ? {
                ...conversation,
                lastMessage: {
                  id: response.message.id,
                  body: response.message.body || (response.message.media?.length ? 'Anexo enviado' : ''),
                  sharedPostId: response.message.sharedPostId ?? response.message.sharedPost?.id ?? null,
                  createdAt: response.message.createdAt,
                  mine: true,
                  sender: response.message.sender,
                },
                updatedAt: response.message.createdAt,
              }
            : conversation,
        ),
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.';
      setActionMessage(message);
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleBlock() {
    if (!detail?.other) return;
    if (!window.confirm(`Bloquear ${detail.other.name}? A conversa deixará de aparecer.`)) return;
    try {
      await apiRequest(`/api/users/${encodeURIComponent(detail.other.username)}/block`, {
        method: 'POST',
      });
      await refreshConversations();
      handleBack();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Não foi possível bloquear o participante.');
    }
  }

  async function handleReport() {
    if (!detail?.other) return;
    const reason = window.prompt('Descreva o motivo da denúncia (mínimo 3 caracteres):');
    if (!reason?.trim()) return;
    try {
      await apiRequest('/api/reports', {
        method: 'POST',
        body: {
          targetType: 'user',
          targetId: detail.other.id,
          reason: reason.trim(),
          details: `Denúncia feita pela conversa ${detail.conversation.id}.`,
        },
      });
      setActionMessage('Denúncia enviada. Obrigado por ajudar a manter o Orbit seguro.');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Não foi possível enviar a denúncia.');
    }
  }

  async function handleConversationCreated(conversationId: number) {
    await refreshConversations();
    handleSelectConversation(conversationId);
  }

  const hasSelection = Boolean(selectedId);

  return (
    <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-surface md:flex-row">
      <ConversationSidebar
        conversations={conversations}
        selectedId={selectedId}
        search={search}
        filter={filter}
        pinnedIds={pinnedIds}
        onSearchChange={setSearch}
        onFilterChange={setFilter}
        onSelect={handleSelectConversation}
        onNewConversation={() => setNewConversationOpen(true)}
        className={cn(
          'min-h-0 w-full md:w-[350px] md:shrink-0',
          hasSelection ? 'hidden md:flex' : 'flex',
        )}
      />

      <section className={cn('min-h-0 min-w-0 flex-1 flex-col bg-surface-raised', hasSelection ? 'flex' : 'hidden md:flex')} aria-label="Conversa selecionada">
        {selectedId && detail ? (
          <>
            <ChatHeader
              other={detail.other}
              onBack={handleBack}
              pinned={isPinned}
              muted={isMuted}
              onTogglePinned={handleTogglePinned}
              onToggleMuted={handleToggleMuted}
              onBlock={() => void handleBlock()}
              onReport={() => void handleReport()}
            />
            <MessageList
              messages={messages}
              loading={loadingDetail}
              error={detailError}
              onRetry={() => void loadDetail(selectedId)}
            />
            {actionMessage ? (
              <p role="status" className="shrink-0 border-t border-border bg-surface px-4 py-2 text-center text-xs text-brand">
                {actionMessage}
              </p>
            ) : null}
            <MessageComposer
              username={detail.other.username}
              disabled={!canSend}
              disabledReason={canSendReason}
              sending={sending}
              onSend={handleSend}
            />
          </>
        ) : selectedId && loadingDetail ? (
          <MessageList messages={[]} loading error={null} onRetry={() => void loadDetail(selectedId)} />
        ) : selectedId && detailError ? (
          <MessageList messages={[]} loading={false} error={detailError} onRetry={() => void loadDetail(selectedId)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span aria-hidden="true" className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-surface-subtle text-muted">
              <MessageSquare className="size-6" />
            </span>
            <h2 className="font-display text-xl font-semibold text-foreground">Escolha uma conversa</h2>
            <p className="mt-1 max-w-sm text-sm leading-6 text-muted">
              Selecione alguém na lista para ver as mensagens. Use a busca para encontrar uma conversa pelo nome.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-5"
              leadingIcon={<Search className="size-3.5" />}
              onClick={() => document.getElementById('busca-conversas')?.focus()}
            >
              Buscar conversa
            </Button>
          </div>
        )}
      </section>

      <NewConversationModal
        isOpen={newConversationOpen}
        onClose={() => setNewConversationOpen(false)}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
