'use client';

import { MessageSquarePlus, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { ConversationSummary } from '@/lib/types';

import { ConversationFilters, type ConversationFilter } from './conversation-filters';
import { ConversationItem } from './conversation-item';
import { ConversationSearch } from './conversation-search';

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  selectedId: number | null;
  search: string;
  filter: ConversationFilter;
  pinnedIds: number[];
  onSearchChange: (value: string) => void;
  onFilterChange: (value: ConversationFilter) => void;
  onSelect: (conversationId: number) => void;
  onNewConversation: () => void;
  className?: string;
}

/** Coluna esquerda: título, busca, filtros e lista de conversas. */
export function ConversationSidebar({
  conversations,
  selectedId,
  search,
  filter,
  pinnedIds,
  onSearchChange,
  onFilterChange,
  onSelect,
  onNewConversation,
  className,
}: ConversationSidebarProps) {
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const filtered = conversations.filter((conversation) => {
    if (filter === 'unread' && conversation.unread <= 0) return false;
    if (!normalizedSearch) return true;
    return (
      conversation.other.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
      conversation.other.username.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
    );
  });

  const pinnedSet = new Set(pinnedIds);
  const sorted = [...filtered].sort((left, right) => {
    const leftPinned = pinnedSet.has(left.id) ? 1 : 0;
    const rightPinned = pinnedSet.has(right.id) ? 1 : 0;
    if (leftPinned !== rightPinned) return rightPinned - leftPinned;
    return right.updatedAt - left.updatedAt;
  });
  const unreadCount = conversations.reduce((total, conversation) => total + conversation.unread, 0);

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col overflow-hidden border-border bg-surface md:border-r',
        className,
      )}
      aria-label="Lista de conversas"
    >
      <div className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.18em] text-brand uppercase">Conversas</p>
            <h1 className="mt-1 truncate font-display text-2xl font-semibold tracking-[-0.02em] text-foreground">
              Mensagens diretas
            </h1>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={onNewConversation}
            leadingIcon={<MessageSquarePlus className="size-4" />}
            className="px-3.5"
          >
            <span className="hidden sm:inline">Nova conversa</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>

        <div className="mt-4">
          <ConversationSearch value={search} onValueChange={onSearchChange} />
        </div>
        <div className="mt-3 overflow-x-auto pb-1">
          <ConversationFilters value={filter} onChange={onFilterChange} unreadCount={unreadCount} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sorted.length > 0 ? (
          <ul className="space-y-0.5" role="list">
            {sorted.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedId === conversation.id}
                isPinned={pinnedSet.has(conversation.id)}
                onSelect={() => onSelect(conversation.id)}
              />
            ))}
          </ul>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
            <span aria-hidden="true" className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-surface-subtle text-muted">
              <SearchX className="size-5" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              {conversations.length === 0
                ? 'Nenhuma conversa ainda'
                : 'Nenhuma conversa encontrada'}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {conversations.length === 0
                ? 'Inicie uma conversa para aparecer aqui.'
                : 'Tente outro nome ou remova os filtros.'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
