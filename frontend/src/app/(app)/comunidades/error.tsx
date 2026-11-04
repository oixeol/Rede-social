'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';

interface ComunidadesErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function ComunidadesError({ error, retry }: ComunidadesErrorProps) {
  useEffect(() => {
    console.error('Falha ao renderizar Comunidades.', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ErrorState
        title="Não foi possível carregar as Comunidades"
        description="Tente novamente. Se o problema continuar, aguarde alguns instantes."
        onRetry={retry}
      />
    </div>
  );
}