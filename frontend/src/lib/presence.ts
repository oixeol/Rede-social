import type { Presence } from '@/lib/types';

/** Rótulo de cada estado de presença. */
export const PRESENCE_LABEL: Record<Presence, string> = {
  available: 'Online',
  away: 'Ocupado',
  dnd: 'Não perturbar',
  invisible: 'Modo fantasma',
};

/** Cor da bolinha por estado de presença. */
export const PRESENCE_COLOR: Record<Presence, string> = {
  available: 'bg-[var(--vibra-success)]',
  away: 'bg-[var(--vibra-warning)]',
  dnd: 'bg-[var(--vibra-danger)]',
  invisible: 'bg-[var(--vibra-muted)]',
};

/** Texto auxiliar exibido no menu de status. */
export const PRESENCE_DESCRIPTION: Record<Presence, string> = {
  available: 'Visível para todos',
  away: 'Ausente por um tempo',
  dnd: 'Você não receberá notificação na área de trabalho',
  invisible: 'Você vai aparecer Off-line',
};

/** Ordem de exibição dos estados. */
export const PRESENCE_ORDER: Presence[] = ['available', 'away', 'dnd', 'invisible'];
