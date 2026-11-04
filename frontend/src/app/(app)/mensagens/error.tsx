'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';

interface MensagensErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function MensagensError({ error, retry }: MensagensErrorProps) {
  useEffect(() => {
    console.error('Falha ao renderizar Mensagens.', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ErrorState
        title="Não foi possível carregar as mensagens"
        description="Tente novamente. Se o problema continuar, aguarde alguns instantes."
        onRetry={retry}
      />
    </div>
  );
}