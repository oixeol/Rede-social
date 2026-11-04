import type { Metadata } from 'next';

import { Users } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = {
  title: 'Comunidades',
  description: 'Encontre comunidades para conversar no Vibra.',
};

export default function ComunidadesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">Comunidades</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl">
          Comunidades
        </h1>
      </header>

      <EmptyState
        icon={<Users className="size-5" />}
        title="Comunidades ainda não estão disponíveis"
        description="A API do Vibra ainda não oferece uma rota para listar comunidades. Assim que essa integração existir, as comunidades que você acompanha aparecerão aqui."
      />
    </div>
  );
}