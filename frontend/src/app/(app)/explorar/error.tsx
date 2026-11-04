'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';

interface ExplorarErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function ExplorarError({ error, retry }: ExplorarErrorProps) {
  useEffect(() => {
    console.error('Falha ao renderizar Explorar.', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <ErrorState
        title="Não foi possível carregar Explorar"
        description="Tente novamente. Se o problema continuar, aguarde alguns instantes."
        onRetry={retry}
      />
    </div>
  );
}