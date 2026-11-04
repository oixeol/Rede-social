'use client';

import { AlertCircle, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import type { FormEvent } from 'react';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError, apiRequest } from '@/lib/api';

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<FieldName | null>(null);

  function messageFromError(caught: unknown): string {
    if (caught instanceof ApiError) {
      if (caught.status >= 400 && caught.status < 500) {
        return caught.message;
      }
      return 'Não foi possível entrar agora. Tente novamente em instantes.';
    }
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setInvalidField('username');
      setError('Informe seu nome de usuário.');
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
      await apiRequest<LoginResponse>('/api/login', {
        method: 'POST',
        body: { username: trimmedUsername, password },
      });
      // A sessão é mantida em cookie httpOnly pelo servidor; nenhum token é
      // persistido no navegador. O cast é necessário porque `/inicio` ainda
      // não consta das rotas tipadas geradas pelo Next.js.
      router.push('/inicio' as Route);
      router.refresh();
    } catch (caught) {
      setError(messageFromError(caught));
      setPending(false);
      submittingRef.current = false;
    }
  }

  const inputClass =
    'w-full h-11 rounded-xl border border-border bg-surface-raised px-4 text-sm placeholder:text-subtle outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} noValidate aria-busy={pending}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={usernameId} className="block text-sm font-medium text-foreground">
              Usuário
            </label>
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
              placeholder="seu_usuario"
              required
              disabled={pending}
              aria-invalid={invalidField === 'username'}
              aria-describedby={error ? errorId : undefined}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={passwordId} className="block text-sm font-medium text-foreground">
              Senha
            </label>
            <input
              id={passwordId}
              ref={passwordRef}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              disabled={pending}
              aria-invalid={invalidField === 'password'}
              aria-describedby={error ? errorId : undefined}
              className={inputClass}
            />
          </div>

          {error ? (
            <div
              id={errorId}
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <p>{error}</p>
            </div>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2.5} />
            ) : null}
            {pending ? 'Entrando…' : 'Entrar'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
