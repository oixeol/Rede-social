'use client';

import { Volume2 } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Logo do Orbit: glifo de onda sonora + wordmark "orbit" em minúsculas, peso 600.
 * Sem gradientes decorativos — usa a cor de destaque coral.
 */
export interface OrbitLogoProps {
  className?: string;
  /** Esconde o texto e mantém apenas o glifo. */
  compact?: boolean;
  /** Tamanho do wordmark (padrão: base). */
  size?: 'sm' | 'base' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'text-[14px]',
  base: 'text-[20px]',
  lg: 'text-[24px]',
};

const ICON_SIZES = {
  sm: 'size-4',
  base: 'size-5',
  lg: 'size-6',
};

export function OrbitLogo({ className, compact = false, size = 'base' }: OrbitLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Volume2
        aria-hidden="true"
        className={cn('shrink-0 text-brand', ICON_SIZES[size])}
        strokeWidth={1.75}
      />
      {compact ? null : (
        <span className={cn('font-semibold tracking-[-0.02em] text-foreground', SIZE_CLASSES[size])}>
          orbit
        </span>
      )}
    </span>
  );
}
