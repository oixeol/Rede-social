'use client';

import { cn } from '@/lib/cn';

export type ConversationFilter = 'all' | 'unread';

const filters: Array<{ id: ConversationFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'Não lidas' },
];

interface ConversationFiltersProps {
  value: ConversationFilter;
  onChange: (value: ConversationFilter) => void;
  unreadCount: number;
}

/** Filtros compactos da lista de conversas. */
export function ConversationFilters({ value, onChange, unreadCount }: ConversationFiltersProps) {
  return (
    <div className="flex min-w-max items-center gap-1.5" role="group" aria-label="Filtrar conversas">
      {filters.map((filter) => {
        const active = filter.id === value;
        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(filter.id)}
            className={cn(
              'inline-flex min-h-9 items-center gap-1.5 rounded-pill px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              active
                ? 'bg-brand-fill text-on-brand shadow-[0_5px_16px_rgb(from_var(--vibra-brand-fill)_r_g_b_/_0.22)]'
                : 'border border-border bg-surface-subtle text-muted hover:border-brand/30 hover:text-foreground',
            )}
          >
            {filter.label}
            {filter.id === 'unread' && unreadCount > 0 ? (
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                  active ? 'bg-black/20 text-on-brand' : 'bg-danger text-white',
                )}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
