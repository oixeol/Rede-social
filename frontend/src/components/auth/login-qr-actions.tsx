'use client';

import { useState } from 'react';

/**
 * Ações alternativas da coluna direita do login (iPhone / passkey).
 *
 * O backend ainda não expõe esses provedores; o botão informa isso ao
 * usuário em vez de simular um login inexistente.
 */
export function LoginQrActions() {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex w-full flex-col items-center">
      <div className="my-6 flex w-full items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-[#1A1A1C]" />
        <span className="text-[10px] font-semibold tracking-[0.2em] text-[#71717A] uppercase">ou</span>
        <span className="h-px flex-1 bg-[#1A1A1C]" />
      </div>

      <button
        type="button"
        onClick={() => setNotice('Login com iPhone chega em breve.')}
        className="inline-flex h-11 w-full max-w-[240px] items-center justify-center gap-2.5 rounded-xl border border-[#2E2E2E] bg-transparent text-[13.5px] font-semibold text-white transition-colors hover:border-[#FF6A00]/50 hover:bg-white/[0.03]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-[16px] fill-none stroke-current"
          strokeWidth={1.8}
          strokeLinecap="round"
        >
          <rect x="7" y="2.5" width="10" height="19" rx="2.4" />
          <path d="M11 18.6h2" />
        </svg>
        Entrar com iPhone
      </button>

      <p className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] text-[#A1A1AA]">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-3.5 fill-none stroke-[#FF6A00]"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </svg>
        Acesso seguro com Passkey
      </p>

      {notice ? (
        <p role="status" className="mt-3 text-[11.5px] text-[#FF8C00]">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
