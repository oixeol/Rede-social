'use client';

import { cn } from '@/lib/cn';
import type { Presence } from '@/lib/types';

/** Pequeno indicador de presença para uso ao lado de avatares/nomes. */
export function PresenceDot({
  presence = 'invisible',
  size = 'md',
  className,
}: { presence?: Presence; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = { sm: 'size-2', md: 'size-3', lg: 'size-4' };
  const colorClasses: Record<Presence, string> = {
    available: 'bg-success',
    away: 'bg-warning',
    dnd: 'bg-danger',
    invisible: 'bg-subtle',
  };

  const labelMap: Record<Presence, string> = {
    available: 'Online',
    away: 'Ausente',
    dnd: 'Não perturbar',
    invisible: 'Offline',
  };

  return (
    <span
      role="status"
      aria-label={labelMap[presence]}
      className={cn(
        'inline-flex shrink-0 rounded-full border-2 border-surface',
        sizeClasses[size],
        colorClasses[presence],
        className,
      )}
    />
  );
}

/** Rótulo de presença com ponto, para uso no cabeçalho do chat. */
export function PresenceLabel({ presence = 'invisible' }: { presence?: Presence }) {
  const labelMap: Record<Presence, string> = {
    available: 'Online',
    away: 'Ausente',
    dnd: 'Não perturbar',
    invisible: 'Offline',
  };

  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
      <PresenceDot presence={presence} size="sm" />
      <span>{labelMap[presence]}</span>
    </span>
  );
}