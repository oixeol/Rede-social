'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';

interface ConfiguracoesErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function ConfiguracoesError({ error, retry }: ConfiguracoesErrorProps) {
  useEffect(() => {
    console.error('Falha ao renderizar Configurações.', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ErrorState
        title="Não foi possível carregar as configurações"
        description="Tente novamente. Se o problema continuar, aguarde alguns instantes."
        onRetry={retry}
      />
    </div>
  );
}