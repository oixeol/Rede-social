'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/messages';
import { Pill } from '@/components/ui/pill';
import type { ConversationSummary } from '@/lib/types';

import { ConversationAvatar } from './conversation-avatar';

interface ConversationItemProps {
  conversation: ConversationSummary;
  isSelected: boolean;
  isPinned: boolean;
  onSelect: () => void;
}

function previewText(conversation: ConversationSummary): string {
  const last = conversation.lastMessage;
  if (!last) return 'Conversa sem mensagens ainda.';
  if (last.sharedPostId) return `${last.mine ? 'Você: ' : ''}Publicação compartilhada`;
  return `${last.mine ? 'Você: ' : ''}${last.body}`;
}

export function ConversationItem({
  conversation,
  isSelected,
  isPinned,
  onSelect,
}: ConversationItemProps) {
  return (
    <li className="relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className={cn(
          'w-full flex min-w-0 items-center gap-3 rounded-card border p-3 transition-colors duration-150',
          isSelected
            ? 'border-brand bg-brand-soft/15'
            : 'border-transparent bg-transparent hover:bg-surface-subtle',
        )}
      >
        <ConversationAvatar
          src={conversation.other.avatar}
          alt={conversation.other.name}
          name={conversation.other.name}
          size="md"
          presence={conversation.other.presence}
        />
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="min-w-0 truncate text-sm text-foreground">{conversation.other.name}</strong>
            {isPinned ? (
              <Pill tone="dark">Fixada</Pill>
            ) : null}
            {conversation.unread > 0 ? (
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none bg-danger text-white',
                )}
              >
                {conversation.unread > 99 ? '99+' : conversation.unread}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted text-left">{previewText(conversation)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <time
            dateTime={new Date(conversation.updatedAt).toISOString()}
            className="text-xs font-medium text-subtle"
          >
            {formatRelativeTime(conversation.updatedAt)}
          </time>
        </div>
      </button>
    </li>
  );
}