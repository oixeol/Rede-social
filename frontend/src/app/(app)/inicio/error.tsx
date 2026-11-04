'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';

interface InicioErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function InicioError({ error, retry }: InicioErrorProps) {
  useEffect(() => {
    // O digest permite correlacionar a falha com os logs do servidor sem
    // expor detalhes da requisição ou dados pessoais no navegador.
    console.error('Falha ao renderizar o Início.', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <ErrorState
        title="Não foi possível carregar o Início"
        description="Tente novamente. Se o problema continuar, aguarde alguns instantes."
        onRetry={retry}
      />
    </div>
  );
}
