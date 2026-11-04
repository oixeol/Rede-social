'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';

interface NotificacoesErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function NotificacoesError({ error, retry }: NotificacoesErrorProps) {
  useEffect(() => {
    console.error('Falha ao renderizar Notificações.', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ErrorState
        title="Não foi possível carregar as notificações"
        description="Tente novamente. Se o problema continuar, aguarde alguns instantes."
        onRetry={retry}
      />
    </div>
  );
}