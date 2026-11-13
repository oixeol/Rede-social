import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type PillTone = 'neutral' | 'brand' | 'accent' | 'dark';

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: PillTone;
}

const toneClasses: Record<PillTone, string> = {
  neutral: 'border border-border bg-surface-subtle text-muted',
  brand: 'border border-brand/15 bg-brand-soft text-brand',
  accent: 'border border-accent/20 bg-accent-soft text-foreground',
  dark: 'border border-border bg-surface-raised text-foreground',
};

export function Pill({ children, tone = 'neutral', className, ...props }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center rounded-pill border px-2.5 text-[11px] font-semibold leading-none',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
