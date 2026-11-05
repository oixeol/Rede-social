'use client';

import { Sparkle } from 'lucide-react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

/**
 * Logo do Vibra: estrela de 4 pontas (gradiente laranja) à esquerda do nome
 * "Vibra." em itálico bold branco.
 *
 * O `id` do gradiente é único por instância (via `useId`) para evitar
 * colisão quando o logo aparece mais de uma vez na mesma página.
 */
export interface VibraLogoProps {
  className?: string;
  /** Esconde o texto e mantém apenas a estrela. */
  compact?: boolean;
}

export function VibraLogo({ className, compact = false }: VibraLogoProps) {
  const gradientId = `vibra-logo-${useId().replace(/:/g, '')}`;

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--vibra-premium-from)" />
            <stop offset="1" stopColor="var(--vibra-premium-to)" />
          </linearGradient>
        </defs>
      </svg>
      <Sparkle
        aria-hidden="true"
        className="size-[22px] shrink-0"
        strokeWidth={2}
        style={{
          fill: `url(#${gradientId})`,
          stroke: `url(#${gradientId})`,
        }}
      />
      {compact ? null : (
        <span className="text-[22px] font-bold italic tracking-[-0.02em] text-foreground">
          Vibra<span className="text-foreground">.</span>
        </span>
      )}
    </span>
  );
}
