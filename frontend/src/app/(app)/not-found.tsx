'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { SearchX } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl py-12">
      <EmptyState
        icon={<SearchX className="size-5" />}
        title="Página não encontrada"
        description="O endereço acessado não existe ou foi movido."
        action={
          <Link
            href={'/inicio' as Route}
            className="inline-flex h-10 items-center justify-center rounded-pill bg-brand-fill px-4 text-sm font-semibold text-on-brand shadow-[0_5px_16px_rgb(from_var(--vibra-brand-fill)_r_g_b_/_0.24)] transition-colors hover:bg-brand-fill-hover"
          >
            Voltar ao Início
          </Link>
        }
      />
    </div>
  );
}
