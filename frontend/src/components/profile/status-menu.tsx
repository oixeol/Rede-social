'use client';

import { useState, type ReactNode } from 'react';
import { BellOff, Circle, Ghost, Moon } from 'lucide-react';

import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Presence } from '@/lib/types';

export interface StatusMenuProps {
  /** Presença atual do usuário. */
  presence?: Presence;
  /** Quando true, o menu permite trocar o status (apenas no próprio perfil). */
  editable?: boolean;
  /** Callback disparado depois que a presença muda com sucesso. */
  onChange?: (newPresence: Presence) => void;
  /** Classe CSS extra para o ponto. */
  className?: string;
}

/** Cor do ponto por estado de presença. */
const PRESENCE_COLOR: Record<Presence, string> = {
  available: 'bg-[var(--vibra-success)]',
  away: 'bg-[var(--vibra-warning)]',
  dnd: 'bg-[var(--vibra-danger)]',
  invisible: 'bg-[var(--vibra-muted)]',
};

const PRESENCE_LABEL: Record<Presence, string> = {
  available: 'Disponível',
  away: 'Ausente',
  dnd: 'Não perturbar',
  invisible: 'Invisível',
};

const PRESENCE_ICON: Record<Presence, ReactNode> = {
  available: <Circle className="size-4 text-[var(--vibra-success)]" aria-hidden="true" />,
  away: <Moon className="size-4 text-[var(--vibra-warning)]" aria-hidden="true" />,
  dnd: <BellOff className="size-4 text-[var(--vibra-danger)]" aria-hidden="true" />,
  invisible: <Ghost className="size-4 text-[var(--vibra-muted)]" aria-hidden="true" />,
};

export function StatusMenu({
  presence = 'available',
  editable = false,
  onChange,
  className,
}: StatusMenuProps) {
  const [pending, setPending] = useState(false);
  const label = PRESENCE_LABEL[presence];

  async function handleSelect(next: Presence) {
    if (next === presence || pending) return;
    setPending(true);
    try {
      await apiRequest('/api/me', { method: 'PATCH', body: { presence: next } });
      onChange?.(next);
    } catch {
      /* Mantém o estado anterior: o menu reflete a última presença persistida. */
    } finally {
      setPending(false);
    }
  }

  const items: DropdownMenuItem[] = (Object.keys(PRESENCE_LABEL) as Presence[]).map((value) => ({
    id: value,
    label: PRESENCE_LABEL[value],
    icon: PRESENCE_ICON[value],
    description:
      value === 'dnd'
        ? 'Você não receberá notificação na área de trabalho'
        : value === 'invisible'
          ? 'Você vai aparecer Off-line'
          : undefined,
    badge: value === presence ? 'Atual' : undefined,
    onSelect: () => void handleSelect(value),
  }));

  const dot = (
    <span
      className={cn(
        'block size-[15px] rounded-full border-2 border-[var(--vibra-background)]',
        PRESENCE_COLOR[presence],
        pending && 'opacity-60',
        className,
      )}
    />
  );

  if (!editable) {
    return (
      <span role="img" aria-label={`Status: ${label}`}>
        {dot}
      </span>
    );
  }

  return (
    <DropdownMenu
      label="Alterar status de presença"
      items={items}
      align="end"
      trigger={dot}
    />
  );
}
