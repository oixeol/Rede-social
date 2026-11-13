'use client';

import { cn } from '@/lib/cn';
import type { AvatarProps } from '@/components/ui/avatar';
import { Avatar } from '@/components/ui/avatar';
import { PresenceDot } from './presence-dot';

interface ConversationAvatarProps extends Omit<AvatarProps, 'online'> {
  presence?: 'available' | 'away' | 'dnd' | 'invisible';
  size?: 'sm' | 'md' | 'lg';
}

/** Avatar usado na lista de conversas com ponto de presença explícito. */
export function ConversationAvatar({
  src,
  alt,
  name,
  size = 'md',
  presence = 'invisible',
  className,
}: ConversationAvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <Avatar src={src} alt={alt} name={name} size={size} online={false} />
      <PresenceDot
        presence={presence}
        size={size === 'sm' ? 'sm' : size === 'md' ? 'md' : 'lg'}
        className="absolute right-0 bottom-0"
      />
    </span>
  );
}