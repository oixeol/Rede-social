import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'full';
  label?: string;
}

export function Skeleton({
  className,
  rounded = 'md',
  label = 'Carregando',
  'aria-label': ariaLabel,
  ...props
}: SkeletonProps) {
  return (
    <div
      {...props}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel ?? label}
      className={cn(
        'animate-pulse bg-surface-subtle',
        rounded === 'sm' && 'rounded-md',
        rounded === 'md' && 'rounded-xl',
        rounded === 'full' && 'rounded-full',
        className,
      )}
    />
  );
}
