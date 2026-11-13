'use client';

import { AlertCircle, Eye, EyeOff, LoaderCircle, Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { useId, useRef, useState } from 'react';

import { ApiError } from '@/lib/api';
import { signIn } from '@/lib/auth-client';

interface LoginResponse {
  user: unknown;
  stats: unknown;
}

type FieldName = 'username' | 'password';

export function LoginForm() {
  const router = useRouter();
  const usernameId = useId();
  const passwordId = useId();
  const errorId = useId();

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<FieldName | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function messageFromError(caught: unknown): string {
    if (caught instanceof ApiError) {
      if (caught.status >= 400 && caught.status < 500) {
        return caught.message;
      }
      return 'Não foi possível entrar agora. Tente novamente em instantes.';
    }
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }

  async function handleSubmitSocial(provider: 'google'): Promise<void> {
    try {
      setPending(true);
      setError(null);
      const res = await fetch('/api/auth/sign-in/social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          callbackURL: `${window.location.origin}/inicio`,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao conectar com serviço de autenticação.');
      }

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Resposta inválida do servidor.');
      }
    } catch (caught) {
      setError(messageFromError(caught));
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setInvalidField('username');
      setError('Informe seu e-mail ou usuário.');
      usernameRef.current?.focus();
      return;
    }
    if (!password) {
      setInvalidField('password');
      setError('Informe sua senha.');
      passwordRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setError(null);
    setInvalidField(null);

    try {
      await signIn.email({
        email: trimmedUsername,
        password,
        callbackURL: '/inicio',
      });
      router.push('/inicio' as Route);
      router.refresh();
    } catch (caught) {
      setError(messageFromError(caught));
      setPending(false);
      submittingRef.current = false;
    }
  }

  const inputClass =
    'h-12 w-full rounded-xl border border-[#1A1A1C] bg-[#0D0D0D] pl-11 pr-4 text-[14px] text-white placeholder:text-[#5F5F67] outline-none transition-colors focus:border-[#FF6A00] focus:ring-2 focus:ring-[#FF6A00]/20 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="flex w-full flex-col">
      <h1 className="font-display text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] text-white sm:text-[34px]">
        Bem-vindo ao <span className="text-brand">Orbit!</span>
      </h1>
      <p className="mt-2.5 text-[13.5px] text-[#A1A1AA]">
        Estamos muito animados em te ver novamente!
      </p>

      <form onSubmit={handleSubmit} noValidate aria-busy={pending} className="mt-7 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={usernameId} className="text-[12.5px] font-medium text-[#D4D4D8]">
            E-mail ou número de telefone
          </label>
          <div className="relative">
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#71717A]"
              strokeWidth={1.8}
            />
            <input
              id={usernameId}
              ref={usernameRef}
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="seu@email.com"
              required
              disabled={pending}
              aria-invalid={invalidField === 'username'}
              aria-describedby={error ? errorId : undefined}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={passwordId} className="text-[12.5px] font-medium text-[#D4D4D8]">
            Senha
          </label>
          <div className="relative">
            <Lock
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#71717A]"
              strokeWidth={1.8}
            />
            <input
              id={passwordId}
              ref={passwordRef}
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              disabled={pending}
              aria-invalid={invalidField === 'password'}
              aria-describedby={error ? errorId : undefined}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#71717A] transition-colors hover:text-white"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />
              ) : (
                <Eye aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            href="/esqueci-senha"
            className="text-[12.5px] font-medium text-[#FF8C00] transition-colors hover:text-[#FF6A00]"
          >
            Esqueceu sua senha?
          </Link>
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
          {pending ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="my-1 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-[#1A1A1C]" />
          <span className="text-[10px] font-semibold tracking-[0.2em] text-[#71717A] uppercase">ou</span>
          <span className="h-px flex-1 bg-[#1A1A1C]" />
        </div>

        <div className="grid gap-2.5">
          <button
            type="button"
            onClick={() => handleSubmitSocial('google')}
            className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[#2E2E2E] bg-transparent text-[13.5px] font-semibold text-white transition-colors hover:border-[#FF6A00]/50 hover:bg-white/[0.03]"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[17px]">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z"
              />
            </svg>
            Continuar com Google
          </button>

          <button
            type="button"
            onClick={() => setNotice('Login com Apple chega em breve.')}
            className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[#2E2E2E] bg-transparent text-[13.5px] font-semibold text-white transition-colors hover:border-[#FF6A00]/50 hover:bg-white/[0.03]"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[17px] fill-current">
              <path d="M16.36 1.43c0 1.14-.47 2.21-1.34 3.04-.97.95-2.16 1.51-3.12 1.41-.02-.11-.03-.23-.03-.34 0-1.09.6-2.23 1.35-3.02.46-.49 1.05-.91 1.72-1.16.67-.25 1.32-.36 1.87-.36.02.13.03.26.03.4Zm5.62 15.18c-.56 1.29-.82 1.86-1.53 3-.99 1.58-2.39 3.54-4.11 3.55-1.53.03-1.89-1-4.1-1-2.2 0-2.61.98-4.08 1.03-1.64.05-2.9-1.71-3.89-3.29-2.67-4.22-2.95-9.68-1.21-12.45 1.28-2.06 3.31-3.27 5.22-3.27 1.95 0 3.17 1.01 4.79 1.01 1.57 0 2.52-1.01 4.79-1.01 1.71 0 3.52.93 4.8 2.53-4.22 1.84-3.54 7.61.74 8.89Z" />
            </svg>
            Continuar com Apple
          </button>

          <button
            type="button"
            onClick={() => setNotice('Login com Passkey chega em breve.')}
            className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[#2E2E2E] bg-transparent text-[13.5px] font-semibold text-white transition-colors hover:border-[#FF6A00]/50 hover:bg-white/[0.03]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-[17px] fill-none stroke-current"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <circle cx="8" cy="12" r="4.5" />
              <path d="M12.5 12v4.5a2 2 0 0 0 4 0V12a4.5 4.5 0 0 0-9 0v2" />
              <path d="M15.5 16.5V18" />
            </svg>
            Entrar com Passkey
          </button>
        </div>

        {notice ? (
          <p role="status" className="text-center text-[12px] text-[#FF8C00]">
            {notice}
          </p>
        ) : null}
      </form>

      <p className="mt-7 text-center text-[13px] text-[#A1A1AA]">
        Não tem uma conta?{' '}
        <Link
          href="/cadastrar"
          className="font-semibold text-[#FF8C00] transition-colors hover:text-[#FF6A00]"
        >
          Criar conta
        </Link>
      </p>
    </div>
  );
}
