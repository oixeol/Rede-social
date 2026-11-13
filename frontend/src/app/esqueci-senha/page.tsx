'use client';

import Link from 'next/link';
import { Mail, LoaderCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useId, useRef, useState } from 'react';

import { ApiError, apiRequest, forgotPassword } from '@/lib/api';
import { OrbitLogo } from '@/components/shell/orbit-logo';

export default function EsqueciSenhaPage() {
  const router = useRouter();
  const emailId = useId();
  const errorId = useId();

  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function messageFromError(caught: unknown): string {
    if (caught instanceof ApiError) {
      if (caught.status >= 400 && caught.status < 500) {
        return caught.message;
      }
      return 'Não foi possível processar agora. Tente novamente em instantes.';
    }
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Informe seu e-mail.');
      emailRef.current?.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('E-mail inválido.');
      emailRef.current?.focus();
      return;
    }

    setPending(true);
    setError(null);

    try {
      await forgotPassword(trimmedEmail);
      setSuccess(true);
    } catch (caught) {
      setError(messageFromError(caught));
      setPending(false);
    }
  }

  const inputClass =
    'h-12 w-full rounded-xl border border-[#1A1A1C] bg-[#0D0D0D] pl-11 pr-4 text-[14px] text-white placeholder:text-[#5F5F67] outline-none transition-colors focus:border-[#FF6A00] focus:ring-2 focus:ring-[#FF6A00]/20 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#121214]">
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="px-6 pt-7 sm:px-10 sm:pt-9">
          <Link
            href="/"
            aria-label="Orbit – página inicial"
            className="inline-flex items-center gap-2 transition-opacity hover:opacity-85"
          >
            <OrbitLogo />
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-md">
            <div className="overflow-hidden rounded-[24px] border border-[#FF6A00]/35 bg-[#0D0D0D]/85 shadow-[0_0_70px_-12px_rgba(255,106,0,0.55),0_28px_70px_rgba(0,0,0,0.65)] backdrop-blur-md">
              <div className="px-6 py-8 sm:px-10 sm:py-10">
                <div className="text-center mb-8">
                  <h1 className="font-display text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] text-white sm:text-[34px]">
                    Esqueceu a <span className="text-[#FF6A00]">senha?</span>
                  </h1>
                  <p className="mt-2.5 text-[13.5px] text-[#A1A1AA]">
                    Informe seu e-mail e enviaremos um link para redefinir sua senha.
                  </p>
                </div>

                {success ? (
                  <div className="flex flex-col items-center text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#052E16] text-[#22C55E]">
                      <CheckCircle className="size-8" strokeWidth={2} />
                    </div>
                    <h2 className="mt-6 text-xl font-semibold text-white">E-mail enviado!</h2>
                    <p className="mt-2 text-[13.5px] text-[#A1A1AA]">
                      Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.
                    </p>
                    <p className="mt-1 text-[12px] text-[#71717A]">
                      Verifique também a pasta de spam/lixo eletrônico.
                    </p>
                    <button
                      onClick={() => router.push('/entrar')}
                      className="mt-6 inline-flex h-11 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF8C00] via-[#FF6A00] to-[#FF4500] text-[15px] font-bold text-[#0A0A0A] shadow-[0_10px_30px_rgba(255,106,0,0.28)] transition-[filter,box-shadow] hover:brightness-110"
                    >
                      Voltar para login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate aria-busy={pending} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={emailId} className="text-[12.5px] font-medium text-[#D4D4D8]">
                        E-mail
                      </label>
                      <div className="relative">
                        <Mail
                          aria-hidden="true"
                          className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#71717A]"
                          strokeWidth={1.8}
                        />
                        <input
                          id={emailId}
                          ref={emailRef}
                          type="email"
                          name="email"
                          autoComplete="email"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="seu@email.com"
                          required
                          disabled={pending}
                          aria-invalid={!!error}
                          aria-describedby={error ? errorId : undefined}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {error ? (
                      <div
                        id={errorId}
                        role="alert"
                        className="flex items-start gap-2 rounded-lg border border-[#EF4444]/30 bg-[#3A1414] p-3 text-[13px] text-[#FCA5A5]"
                      >
                        <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                        <p>{error}</p>
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={pending}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF8C00] via-[#FF6A00] to-[#FF4500] text-[15px] font-bold text-[#0A0A0A] shadow-[0_10px_30px_rgba(255,106,0,0.28)] transition-[filter,box-shadow] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {pending ? (
                        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2.5} />
                      ) : null}
                      {pending ? 'Enviando…' : 'Enviar link de recuperação'}
                    </button>
                  </form>
                )}

                <p className="mt-7 text-center text-[13px] text-[#A1A1AA]">
                  Lembrou a senha?{' '}
                  <Link
                    href="/entrar"
                    className="font-semibold text-[#FF8C00] transition-colors hover:text-[#FF6A00]"
                  >
                    Entrar
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}