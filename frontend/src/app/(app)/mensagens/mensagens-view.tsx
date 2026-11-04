'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';
import type { ConversationSummary } from '@/lib/types';

interface MensagensViewProps {
  conversations: ConversationSummary[];
}

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(timestamp));
}

export function MensagensView({ conversations }: MensagensViewProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">Mensagens</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl">
          Suas conversas
        </h1>
      </header>

      {conversations.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-5" />}
          title="Nenhuma conversa por aqui"
          description="Quando alguém iniciar uma conversa com você, ela aparecerá nesta lista."
        />
      ) : (
        <ul className="space-y-3" role="list">
          {conversations.map((conversation) => {
            const lastMessage = conversation.lastMessage;
            const preview = lastMessage
              ? `${lastMessage.mine ? 'Você: ' : ''}${lastMessage.body || (lastMessage.sharedPostId ? 'Publicação compartilhada' : 'Mensagem')}`
              : 'Conversa sem mensagens ainda.';

            return (
              <li
                key={conversation.id}
                className="flex min-w-0 items-center gap-3 rounded-card border border-border bg-surface p-4"
              >
                <Avatar
                  src={conversation.other.avatar}
                  alt={conversation.other.name}
                  name={conversation.other.name}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="min-w-0 truncate text-sm text-foreground">{conversation.other.name}</strong>
                    {conversation.unread > 0 ? (
                      <Pill tone="brand">{conversation.unread} não lida{conversation.unread > 1 ? 's' : ''}</Pill>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted">{preview}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <time
                    dateTime={new Date(conversation.updatedAt).toISOString()}
                    className="text-xs font-medium text-subtle"
                  >
                    {relativeTime(conversation.updatedAt)}
                  </time>
                  <Link
                    href={`/perfil/${encodeURIComponent(conversation.other.username)}` as Route}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Ver perfil
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}