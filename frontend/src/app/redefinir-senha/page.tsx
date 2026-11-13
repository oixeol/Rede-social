'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, LoaderCircle, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import type { FormEvent } from 'react';
import { useId, useRef, useState, useEffect } from 'react';

import { ApiError } from '@/lib/api';
import { resetPassword } from '@/lib/auth-client';
import { OrbitLogo } from '@/components/shell/orbit-logo';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const passwordId = useId();
  const confirmPasswordId = useId();
  const errorId = useId();

  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invalidToken, setInvalidToken] = useState(!token);

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
    if (pending || !token) return;

    if (!password) {
      setError('Informe a nova senha.');
      passwordRef.current?.focus();
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      passwordRef.current?.focus();
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('A senha deve conter pelo menos 1 letra maiúscula.');
      passwordRef.current?.focus();
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('A senha deve conter pelo menos 1 número.');
      passwordRef.current?.focus();
      return;
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      setError('A senha deve conter pelo menos 1 caractere especial (!@#$%^&*...).');
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      confirmPasswordRef.current?.focus();
      return;
    }

    setPending(true);
    setError(null);

    try {
      await resetPassword({
        token,
        newPassword: password,
      });
      setSuccess(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) {
        setError(caught.message);
        if (caught.message.includes('Token inválido') || caught.message.includes('expirado')) {
          setInvalidToken(true);
        }
      } else {
        setError(messageFromError(caught));
      }
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
                    Redefinir <span className="text-[#FF6A00]">senha</span>
                  </h1>
                  <p className="mt-2.5 text-[13.5px] text-[#A1A1AA]">
                    {invalidToken ? 'Token inválido ou expirado.' : 'Crie uma nova senha segura para sua conta.'}
                  </p>
                </div>

                {success ? (
                  <div className="flex flex-col items-center text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#052E16] text-[#22C55E]">
                      <CheckCircle className="size-8" strokeWidth={2} />
                    </div>
                    <h2 className="mt-6 text-xl font-semibold text-white">Senha redefinida!</h2>
                    <p className="mt-2 text-[13.5px] text-[#A1A1AA]">
                      Sua senha foi alterada com sucesso. Faça login com a nova senha.
                    </p>
                    <button
                      onClick={() => router.push('/entrar')}
                      className="mt-6 inline-flex h-11 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF8C00] via-[#FF6A00] to-[#FF4500] text-[15px] font-bold text-[#0A0A0A] shadow-[0_10px_30px_rgba(255,106,0,0.28)] transition-[filter,box-shadow] hover:brightness-110"
                    >
                      Ir para login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate aria-busy={pending} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={passwordId} className="text-[12.5px] font-medium text-[#D4D4D8]">
                        Nova senha
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
                          autoComplete="new-password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="••••••••"
                          required
                          disabled={pending || invalidToken}
                          aria-invalid={!!error}
                          aria-describedby={error ? errorId : undefined}
                          className={`${inputClass} pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((visible) => !visible)}
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          disabled={pending || invalidToken}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#71717A] transition-colors hover:text-white disabled:opacity-50"
                        >
                          {showPassword ? (
                            <EyeOff aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />
                          ) : (
                            <Eye aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />
                          )}
                        </button>
                      </div>
                      <ul className="mt-1.5 space-y-0.5 text-[11px] text-[#71717A]" aria-hidden="true">
                        <li className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#2E2E2E]" />
                          Mínimo 8 caracteres
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#2E2E2E]" />
                          1 letra maiúscula
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#2E2E2E]" />
                          1 número
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#2E2E2E]" />
                          1 caractere especial (!@#$%^&*)
                        </li>
                      </ul>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={confirmPasswordId} className="text-[12.5px] font-medium text-[#D4D4D8]">
                        Confirmar nova senha
                      </label>
                      <div className="relative">
                        <Lock
                          aria-hidden="true"
                          className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#71717A]"
                          strokeWidth={1.8}
                        />
                        <input
                          id={confirmPasswordId}
                          ref={confirmPasswordRef}
                          type={showPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="••••••••"
                          required
                          disabled={pending || invalidToken}
                          aria-invalid={!!error}
                          aria-describedby={error ? errorId : undefined}
                          className={`${inputClass} pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((visible) => !visible)}
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          disabled={pending || invalidToken}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#71717A] transition-colors hover:text-white disabled:opacity-50"
                        >
                          {showPassword ? (
                            <EyeOff aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />
                          ) : (
                            <Eye aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />
                          )}
                        </button>
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
                      disabled={pending || invalidToken}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF8C00] via-[#FF6A00] to-[#FF4500] text-[15px] font-bold text-[#0A0A0A] shadow-[0_10px_30px_rgba(255,106,0,0.28)] transition-[filter,box-shadow] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {pending ? (
                        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2.5} />
                      ) : null}
                      {pending ? 'Redefinindo…' : 'Redefinir senha'}
                    </button>
                  </form>
                )}

                {invalidToken && (
                  <div className="mt-6 text-center">
                    <p className="text-[13px] text-[#A1A1AA]">
                      O link expirou ou é inválido.{' '}
                      <Link
                        href="/esqueci-senha"
                        className="font-semibold text-[#FF8C00] transition-colors hover:text-[#FF6A00]"
                      >
                        Solicitar novo link
                      </Link>
                    </p>
                  </div>
                )}

                {!success && !invalidToken && (
                  <p className="mt-7 text-center text-[13px] text-[#A1A1AA]">
                    Lembrou a senha?{' '}
                    <Link
                      href="/entrar"
                      className="font-semibold text-[#FF8C00] transition-colors hover:text-[#FF6A00]"
                    >
                      Entrar
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}