'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/error-state';

interface PerfilErrorProps {
  error: unknown;
  retry: () => void;
  reset?: () => void;
}

function getErrorDigest(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'digest' in error) {
    const digest = (error as { digest?: unknown }).digest;
    return typeof digest === 'string' ? digest : undefined;
  }
  return undefined;
}

export default function PerfilError({ error, retry }: PerfilErrorProps) {
  useEffect(() => {
    const digest = getErrorDigest(error);
    // O digest permite correlacionar a falha com os logs do servidor sem
    // expor detalhes da requisição ou dados pessoais no navegador.
    console.error('Falha ao renderizar o perfil.', digest ?? 'sem identificador');
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <ErrorState
        title="Não foi possível carregar o perfil"
        description="Tente novamente. Se o problema continuar, aguarde alguns instantes."
        onRetry={retry}
      />
    </div>
  );
}