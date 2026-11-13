'use client';

import { useEffect, useRef } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';

import { cn } from '@/lib/cn';
import { groupMessagesByDay } from '@/lib/messages';
import type { Message } from '@/lib/types';

import { MessageBubble } from './message-bubble';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/** Área rolável com separadores de data e balões. */
export function MessageList({ messages, loading, error, onRetry }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const groups = groupMessagesByDay(messages);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center" role="status" aria-live="polite">
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          Carregando mensagens…
        </span>
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-semibold text-foreground">Não foi possível carregar as mensagens</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-pill border border-border bg-surface-raised px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-brand/30 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
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
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted">
          Esta conversa ainda não tem mensagens. Envie a primeira mensagem abaixo.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite" aria-relevant="additions">
      <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6">
        {groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-1.5" aria-label={group.label}>
            <div className="flex items-center gap-3" role="separator" aria-label={group.label}>
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-bold tracking-[0.12em] text-subtle uppercase">{group.label}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            {group.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </section>
        ))}
        <div ref={endRef} className={cn('h-px', messages.length === 0 && 'hidden')} />
      </div>
    </div>
  );
}
