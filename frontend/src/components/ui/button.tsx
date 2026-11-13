import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-fill text-on-brand shadow-[0_5px_16px_rgb(from_var(--orbit-brand-fill)_r_g_b_/_0.24)] hover:bg-brand-fill-hover',
  secondary:
    'border border-border-strong bg-surface-raised text-foreground hover:border-brand/35 hover:bg-brand-soft/45',
  ghost: 'bg-transparent text-foreground hover:bg-surface-subtle',
  danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-on-brand',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
};

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-pill font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {leadingIcon ? <span aria-hidden="true" className="inline-flex">{leadingIcon}</span> : null}
      {children}
      {trailingIcon ? <span aria-hidden="true" className="inline-flex">{trailingIcon}</span> : null}
    </button>
  );
}
