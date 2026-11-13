'use client';

import { useId } from 'react';

import { cn } from '@/lib/cn';

/**
 * Ondas decorativas (gradiente coral translúcido).
 *
 * Usadas no canto inferior direito dos cards "Sobre mim" e "Orbit Premium".
 * É puramente decorativa: o SVG não recebe foco nem interação.
 *
 * O `id` do gradiente é único por instância (via `useId`) para evitar
 * colisão quando várias ondas coexistem no mesmo documento.
 */
export interface WavesProps {
  className?: string;
  /** Intensidade do gradiente. */
  opacity?: number;
}

export function Waves({ className, opacity = 0.55 }: WavesProps) {
  const gradientId = `orbit-wave-${useId().replace(/:/g, '')}`;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 120"
      preserveAspectRatio="none"
      className={cn('pointer-events-none absolute', className)}
      style={{ opacity }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--orbit-brand)" stopOpacity="0" />
          <stop offset="0.45" stopColor="var(--orbit-brand)" stopOpacity="0.85" />
          <stop offset="1" stopColor="var(--orbit-brand-hover)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path
        d="M0 96 C 40 96 48 44 92 44 C 136 44 132 104 176 104 C 208 104 214 74 240 74 L240 120 L0 120 Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M0 104 C 48 104 56 62 100 62 C 144 62 140 116 184 116 C 214 116 220 94 240 94 L240 120 L0 120 Z"
        fill={`url(#${gradientId})`}
        opacity="0.7"
      />
    </svg>
  );
}
