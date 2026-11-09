'use client';

import { useId } from 'react';

import { cn } from '@/lib/cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  /**
   * Oculta o rótulo visível (mantém o `aria-label` do botão). Use quando o
   * texto já aparece em outro componente, como `SettingsRow`.
   */
  hideLabel?: boolean;
}

/**
 * Interruptor acessível (role="switch") com rótulo e descrição opcionais.
 * Foco visível e alvo de toque de 44px.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
  hideLabel = false,
}: SwitchProps) {
  const descriptionId = useId();

  return (
    <div className={cn('flex items-start justify-between gap-4 py-3', className)}>
      <div className="min-w-0">
        <span
          className={cn(
            'block text-sm font-medium text-foreground',
            hideLabel && 'sr-only',
          )}
        >
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="mt-0.5 block text-xs leading-5 text-muted">
            {description}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          checked ? 'border-brand bg-brand' : 'border-border-strong bg-surface-subtle',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-4 rounded-full bg-foreground transition-transform duration-150',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}
