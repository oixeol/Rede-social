import type { Route } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/cn';

export interface BrandProps {
  className?: string;
  compact?: boolean;
  href?: Route;
}

export function Brand({ className, compact = false, href = '/' }: BrandProps) {
  return (
    <Link
      href={href}
      aria-label="Orbit – página inicial"
      className={cn('inline-flex items-center gap-2 text-brand', className)}
    >
      <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-full bg-brand-fill text-on-brand shadow-[0_4px_12px_rgb(from_var(--orbit-brand-fill)_r_g_b_/_0.28)]">
        <Plus className="size-4" strokeWidth={2.5} />
      </span>
      {!compact ? (
        <span className="font-display text-[22px] font-semibold tracking-[-0.02em] text-foreground">
          orbit<span className="text-brand">.</span>
        </span>
      ) : null}
    </Link>
  );
}
