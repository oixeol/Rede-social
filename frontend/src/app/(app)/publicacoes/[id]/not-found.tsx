'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { FileQuestion } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function PostDetailNotFound() {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-2xl py-12">
      <EmptyState
        icon={<FileQuestion className="size-5" />}
        title="Publicação não encontrada"
        description="A publicação que você tentou abrir não existe, foi removida ou você não tem permissão para vê-la."
        action={
          <Button
            variant="primary"
            onClick={() => {
              // O cast é necessário porque `/inicio` ainda não consta das
              // rotas tipadas geradas pelo Next.js.
              router.push('/inicio' as Route);
            }}
          >
            Voltar ao Início
          </Button>
        }
      />
    </div>
  );
}
