'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';

interface PostDetailErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function PostDetailError({ error, retry }: PostDetailErrorProps) {
  useEffect(() => {
    // O digest correlaciona a falha com os logs do servidor sem expor
    // detalhes da requisição ou dados pessoais no navegador.
    console.error('Falha ao renderizar a publicação.', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <ErrorState
        title="Não foi possível carregar a publicação"
        description="Tente novamente. Se o problema continuar, aguarde alguns instantes."
        onRetry={retry}
      />
    </div>
  );
}
