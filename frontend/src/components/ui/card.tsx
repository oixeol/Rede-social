import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Card({ children, className, elevated = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-surface',
        elevated && 'shadow-card',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
