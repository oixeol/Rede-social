'use client';

import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';

import { cn } from '@/lib/cn';

/** Estado de uma ação assíncrona de salvamento. */
export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

/** Mensagem de retorno das ações de salvamento. */
export interface SaveState {
  status: SaveStatus;
  message: string | null;
}

/** Estado inicial das ações de salvamento. */
export const IDLE_SAVE: SaveState = { status: 'idle', message: null };

export interface SaveActions {
  /** Estado atual da ação. */
  state: SaveState;
  /** Marca a ação como em andamento. */
  start: () => void;
  /** Marca a ação como concluída, com mensagem opcional. */
  succeed: (message?: string) => void;
  /** Marca a ação como falha, com mensagem de erro. */
  fail: (error: unknown, fallback: string) => void;
}

/**
 * Hook simples para ações de salvamento: guarda status e mensagem, e evita
 * estados duplicados entre as seções.
 */
export function useSaveAction(): SaveActions {
  const [state, setState] = useState<SaveState>(IDLE_SAVE);

  const start = useCallback(() => {
    setState({ status: 'saving', message: null });
  }, []);

  const succeed = useCallback((message?: string) => {
    setState({ status: 'success', message: message ?? null });
  }, []);

  const fail = useCallback((error: unknown, fallback: string) => {
    setState({
      status: 'error',
      message: error instanceof Error ? error.message : fallback,
    });
  }, []);

  return { state, start, succeed, fail };
}

/** Cabeçalho de uma seção de configurações. */
export function SettingsHeading({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-5">
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </header>
  );
}

/** Cartão que agrupa um bloco de configurações. */
export function SettingsCard({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn('rounded-card border border-border bg-surface p-4 sm:p-5', className)}
    >
      {children}
    </section>
  );
}

/** Linha de configuração: rótulo, descrição e controle à direita. */
export function SettingsRow({
  title,
  description,
  control,
}: {
  title: string;
  description?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

/** Mensagem de status (sucesso/erro) das ações de salvamento. */
export function SettingsStatus({ state }: { state: SaveState }) {
  if (state.status === 'error' && state.message) {
    return (
      <p
        role="alert"
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-danger/20 bg-danger-soft/45 px-3 py-2 text-sm text-danger"
      >
        <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
        {state.message}
      </p>
    );
  }

  if (state.status === 'success' && state.message) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-success"
      >
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
        {state.message}
      </p>
    );
  }

  return null;
}

/** Campo de texto padrão das seções de configuração. */
export function SettingsField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Classe padrão dos inputs das seções de configuração. */
export const INPUT_CLASS =
  'w-full min-h-11 rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground placeholder:text-subtle focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
