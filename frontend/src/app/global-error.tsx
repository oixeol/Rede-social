'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
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

export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    const digest = getErrorDigest(error);
    // Log only a non‑sensitive identifier
    console.error('Falha global não tratada.', digest ?? 'sem identificador');
  }, [error]);

  return (
    <html lang="pt-BR">
      <head>
        <title>Erro inesperado · Orbit</title>
        <style>{`
          *,*::before,*::after { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; min-height: 100%; }
          html { color-scheme: light dark; }
          body {
            min-height: 100vh;
            background: #121214;
            color: #FFFFFF;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            -webkit-font-smoothing: antialiased;
            display: grid;
            place-items: center;
            padding: 1.5rem;
          }
          button {
            font: inherit;
            cursor: pointer;
            border: none;
            background: #FF6A00;
            color: #0A0A0A;
            padding: 0.75rem 1.5rem;
            border-radius: 999px;
            font-weight: 700;
          }
          button:focus-visible {
            outline: 3px solid color-mix(in srgb, #FF6A00 68%, transparent);
            outline-offset: 3px;
          }
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }
        `}</style>
      </head>
      <body>
        <main role="alert" aria-labelledby="global-error-title" aria-describedby="global-error-desc" style={{ textAlign: 'center' }}>
          <h1 id="global-error-title">Algo deu errado</h1>
          <p id="global-error-desc">Não foi possível carregar o Orbit.</p>
          <button type="button" onClick={retry}>Tentar novamente</button>
        </main>
      </body>
    </html>
  );
}