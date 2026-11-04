import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  tone?: 'default' | 'brand' | 'danger';
  pressed?: boolean;
}

const toneClasses = {
  default: 'text-muted hover:bg-surface-subtle hover:text-foreground',
  brand: 'text-brand hover:bg-brand-soft',
  danger: 'text-danger hover:bg-danger-soft',
};

export function IconButton({
  label,
  icon,
  tone = 'default',
  pressed,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45',
        toneClasses[tone],
        className,
      )}
      {...props}
      {...(pressed !== undefined ? { 'aria-pressed': pressed } : {})}
    >
      <span aria-hidden="true" className="inline-flex">{icon}</span>
    </button>
  );
}
