'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';

interface FavoritosErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function FavoritosError({ error, retry }: FavoritosErrorProps) {
  useEffect(() => {
    console.error('Falha ao renderizar Favoritos.', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ErrorState
        title="Não foi possível carregar os Favoritos"
        description="Tente novamente. Se o problema continuar, aguarde alguns instantes."
        onRetry={retry}
      />
    </div>
  );
}