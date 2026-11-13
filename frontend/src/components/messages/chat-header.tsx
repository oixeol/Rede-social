'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { ArrowLeft, MoreHorizontal, Phone, Video } from 'lucide-react';

import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/cn';
import type { ConversationOther } from '@/lib/types';

import { ChatOptionsMenu } from './chat-options-menu';
import { ConversationAvatar } from './conversation-avatar';
import { PresenceLabel } from './presence-dot';

interface ChatHeaderProps {
  other: ConversationOther;
  onBack: () => void;
  pinned: boolean;
  muted: boolean;
  onTogglePinned: () => void;
  onToggleMuted: () => void;
  onBlock: () => void;
  onReport: () => void;
}

/** Cabeçalho fixo da conversa: participante, presença e ações. */
export function ChatHeader({
  other,
  onBack,
  pinned,
  muted,
  onTogglePinned,
  onToggleMuted,
  onBlock,
  onReport,
}: ChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-5">
      <IconButton
        label="Voltar para conversas"
        icon={<ArrowLeft className="size-5" />}
        onClick={onBack}
        className="md:hidden"
      />
      <Link
        href={`/perfil/${encodeURIComponent(other.username)}` as Route}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <ConversationAvatar
          src={other.avatar}
          alt={other.name}
          name={other.name}
          size="md"
          presence={other.presence}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{other.name}</span>
          <span className="mt-0.5 block text-xs text-muted">
            <PresenceLabel presence={other.presence} />
          </span>
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          label="Chamada de voz (em breve)"
          icon={<Phone className="size-5" />}
          disabled
          title="Chamadas de voz chegam na próxima etapa"
          className={cn('opacity-50')}
        />
        <IconButton
          label="Chamada de vídeo (em breve)"
          icon={<Video className="size-5" />}
          disabled
          title="Chamadas de vídeo chegam na próxima etapa"
          className={cn('opacity-50')}
        />
        <ChatOptionsMenu
          pinned={pinned}
          muted={muted}
          onTogglePinned={onTogglePinned}
          onToggleMuted={onToggleMuted}
          onBlock={onBlock}
          onReport={onReport}
          trigger={<MoreHorizontal className="size-5" />}
        />
      </div>
    </header>
  );
}
