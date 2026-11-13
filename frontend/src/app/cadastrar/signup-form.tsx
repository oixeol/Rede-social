'use client';

import { AlertCircle, LoaderCircle, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import type { FormEvent, ChangeEvent } from 'react';
import { useEffect, useId, useRef, useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { ApiError, apiRequest } from '@/lib/api';
import { signUp } from '@/lib/auth-client';
import { getCountries, getStatesByCountry, type Country, type State } from '@/lib/countries';

interface SignupResponse {
  user: unknown;
  stats: unknown;
}

type FieldName =
  | 'fullName'
  | 'username'
  | 'email'
  | 'country'
  | 'password'
  | 'confirmPassword';

function validatePassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Pelo menos 8 caracteres');
  if (!/[A-Z]/.test(password)) errors.push('Pelo menos 1 letra maiúscula');
  if (!/[0-9]/.test(password)) errors.push('Pelo menos 1 número');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Pelo menos 1 caractere especial (!@#$%^&*...)');
  return errors;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUsername(username: string): boolean {
  return /^[a-z0-9._]{3,24}$/.test(username);
}

export function SignupForm() {
  const router = useRouter();
  const countriesList = getCountries();

  // Refs
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // States
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<FieldName | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const submittingRef = useRef(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle'|'checking'|'available'|'unavailable'>('idle');

  // Username validation
  useEffect(() => {
    const normalized = username.trim().toLowerCase();
    if (!validateUsername(normalized)) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setUsernameStatus('checking');
      apiRequest<{ available: boolean }>(
        `/api/username-available?username=${encodeURIComponent(normalized)}`,
      )
        .then((response) => {
          if (cancelled) return;
          setUsernameStatus(response.available ? 'available' : 'unavailable');
          if (!response.available) {
            setInvalidField('username');
            setError('Esse nome de usuário já está em uso. Escolha outro.');
          }
        })
        .catch(() => {
          if (!cancelled) setUsernameStatus('idle');
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username]);

  function messageFromError(caught: unknown): string {
    if (caught instanceof ApiError) {
      if (caught.status >= 400 && caught.status < 500) return caught.message;
      return 'Não foi possível criar sua conta agora. Tente novamente em instantes.';
    }
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }

  function validateField(field: FieldName, value: string): boolean {
    switch (field) {
      case 'fullName':
        return value.trim().split(' ').filter(Boolean).length >= 1;
      case 'username':
        return validateUsername(value.trim().toLowerCase());
      case 'email':
        return validateEmail(value);
      case 'country':
        return countriesList.some((c) => c.code === value);
      case 'password':
        return validatePassword(value).length === 0;
      case 'confirmPassword':
        return value === password && value.length > 0;
      default:
        return true;
    }
  }

  function getFieldErrorMessage(field: FieldName, value: string): string {
    switch (field) {
      case 'fullName':
        return 'Informe seu nome completo.';
      case 'username':
        return 'Use de 3 a 24 caracteres: letras minúsculas, números, ponto ou underline.';
      case 'email':
        return 'Informe um e-mail válido.';
      case 'country':
        return 'Selecione seu país.';
      case 'password': {
        const errors = validatePassword(value);
        if (errors.length > 0) return errors.join(', ');
        return 'A senha não atende aos requisitos de segurança.';
      }
      case 'confirmPassword':
        return value !== password ? 'As senhas não conferem.' : 'Confirme sua senha.';
      default:
        return 'Campo inválido.';
    }
  }

  function handleBlur(field: FieldName, value: string) {
    if (!validateField(field, value)) {
      setInvalidField(field);
      setError(getFieldErrorMessage(field, value));
    } else if (invalidField === field) {
      setInvalidField(null);
      setError(null);
    }
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    const errors = validatePassword(value);
    setPasswordErrors(errors);
    if (confirmPassword && value !== confirmPassword) {
      setInvalidField('confirmPassword');
      setError('As senhas não conferem.');
    } else if (invalidField === 'confirmPassword') {
      setInvalidField(null);
      setError(null);
    }
  }

  function handleConfirmPasswordChange(value: string) {
    setConfirmPassword(value);
    if (value && value !== password) {
      setInvalidField('confirmPassword');
      setError('As senhas não conferem.');
    } else if (invalidField === 'confirmPassword') {
      setInvalidField(null);
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef) return;

    const fields: { field: FieldName; value: string }[] = [
      { field: 'fullName', value: fullName },
      { field: 'username', value: username },
      { field: 'email', value: email },
      { field: 'country', value: country },
      { field: 'password', value: password },
      { field: 'confirmPassword', value: confirmPassword },
    ];

    for (const { field, value } of fields) {
      if (!validateField(field, value)) {
        setInvalidField(field);
        setError(getFieldErrorMessage(field, value));
        return;
      }
    }

    if (usernameStatus === 'unavailable') {
      setInvalidField('username');
      setError('Esse nome de usuário já está em uso. Escolha outro.');
      usernameRef.current?.focus();
      return;
    }

    if (password !== confirmPassword) {
      setInvalidField('confirmPassword');
      setError('As senhas não conferem.');
      confirmPasswordRef.current?.focus();
      return;
    }

    setSubmittingRef(true);
    setPending(true);
    setError(null);
    setInvalidField(null);

    const names = fullName.trim().split(' ');
    const firstName = names[0] || '';
    const lastName = names.slice(1).join(' ') || firstName;

    try {
      await signUp.email({
        email: email.trim().toLowerCase(),
        password,
        name: fullName.trim(),
        username: username.trim().toLowerCase(),
        country,
        callbackURL: '/inicio',
      } as any);
      router.push('/inicio' as Route);
      router.refresh();
    } catch (caught) {
      setError(messageFromError(caught));
      setPending(false);
    }
  }

  const inputClass = cn(
    'w-full h-11 rounded-xl border border-border bg-surface-raised px-4 text-sm placeholder:text-subtle outline-none transition-colors',
    'focus:border-brand focus:ring-2 focus:ring-brand/20',
    'disabled:cursor-not-allowed disabled:opacity-50'
  );

  const selectClass = cn(
    'vibra-select-dark w-full h-11 rounded-xl border border-border px-4 text-sm outline-none transition-colors appearance-none [color-scheme:dark]',
    'focus:border-brand focus:ring-2 focus:ring-brand/20',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'bg-no-repeat bg-right pr-10',
    "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")] bg-center"
  );

  const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

  const fieldErrorClass = cn(inputClass, 'border-danger focus:border-danger focus:ring-danger/20');

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} noValidate aria-busy={pending}>
        <div className="space-y-4">
          {/* Nome Completo */}
          <div className="space-y-1.5">
            <label htmlFor="fullName" className={labelClass}>
              Nome completo <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="fullName"
              ref={fullNameRef}
              type="text"
              name="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
              onBlur={(e) => handleBlur('fullName', e.target.value)}
              placeholder="João Silva"
              required
              disabled={pending}
              aria-invalid={invalidField === 'fullName'}
              aria-describedby={error && invalidField === 'fullName' ? 'form-error' : undefined}
              className={invalidField === 'fullName' ? fieldErrorClass : inputClass}
            />
          </div>

          {/* Nome de usuário */}
          <div className="space-y-1.5">
            <label htmlFor="username" className={labelClass}>
              Nome de usuário <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <span
                className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-subtle"
                aria-hidden="true"
              >
                @
              </span>
              <input
                id="username"
                ref={usernameRef}
                type="text"
                name="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const next = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '');
                  setUsername(next);
                  setUsernameStatus('idle');
                }}
                onBlur={(e) => handleBlur('username', e.target.value)}
                placeholder="joao.silva"
                required
                disabled={pending}
                aria-invalid={invalidField === 'username' || usernameStatus === 'unavailable'}
                aria-describedby={cn(
                  (usernameStatus === 'checking' || usernameStatus === 'available' || usernameStatus === 'unavailable') ? 'username-status' : undefined,
                  error && (invalidField === 'username' || usernameStatus === 'unavailable') ? 'form-error' : undefined
                )}
                className={cn(
                  'pl-9',
                  invalidField === 'username' || usernameStatus === 'unavailable'
                    ? fieldErrorClass
                    : inputClass
                )}
              />
              {usernameStatus === 'checking' ? (
                <span className="absolute inset-y-0 right-4 flex items-center text-xs text-muted" id="username-status">
                  verificando…
                </span>
              ) : usernameStatus === 'available' ? (
                <span className="absolute inset-y-0 right-4 flex items-center text-xs text-success" id="username-status">
                  disponível ✓
                </span>
              ) : usernameStatus === 'unavailable' ? (
                <span className="absolute inset-y-0 right-4 flex items-center text-xs text-danger" id="username-status">
                  já está em uso
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted">3–24 caracteres. Apenas letras minúsculas, números, ponto e underline.</p>
          </div>

          {/* E-mail */}
          <div className="space-y-1.5">
            <label htmlFor="email" className={labelClass}>
              E-mail <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              onBlur={(e) => handleBlur('email', e.target.value)}
              placeholder="seu@email.com"
              required
              disabled={pending}
              aria-invalid={invalidField === 'email'}
              aria-describedby={error && invalidField === 'email' ? 'form-error' : undefined}
              className={invalidField === 'email' ? fieldErrorClass : inputClass}
            />
          </div>

          {/* País */}
          <div className="space-y-1.5">
            <label htmlFor="country" className={labelClass}>
              País <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <select
              id="country"
              name="country"
              value={country}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setCountry(e.target.value)}
              onBlur={(e) => handleBlur('country', e.target.value)}
              required
              disabled={pending}
              aria-invalid={invalidField === 'country'}
              aria-describedby={error && invalidField === 'country' ? 'form-error' : undefined}
              className={cn(selectClass, invalidField === 'country' && 'border-danger focus:border-danger focus:ring-danger/20')}
            >
              <option value="" className="bg-[#0D0D0D] text-white">Selecione seu país</option>
              {countriesList.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#0D0D0D] text-white">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Senha */}
          <div className="space-y-1.5">
            <label htmlFor="password" className={labelClass}>
              Senha <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handlePasswordChange(e.target.value)}
                onBlur={(e) => handleBlur('password', e.target.value)}
                placeholder="••••••••"
                required
                disabled={pending}
                aria-invalid={invalidField === 'password'}
                aria-describedby={error && invalidField === 'password' ? 'form-error' : 'password-requirements'}
                className={cn(
                  inputClass,
                  'pr-12',
                  invalidField === 'password' && 'border-danger focus:border-danger focus:ring-danger/20'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="size-4" strokeWidth={2} /> : <Eye className="size-4" strokeWidth={2} />}
              </button>
            </div>
            <div id="password-requirements" className="space-y-1 text-xs" aria-live="polite">
              {password.length > 0 && (
                <>
                  <p className={cn('flex items-center gap-1.5', validatePassword(password).includes('Pelo menos 8 caracteres') ? 'text-danger' : 'text-success')}>
                    <span className="size-3.5 rounded-full border border-current flex items-center justify-center">
                      {validatePassword(password).includes('Pelo menos 8 caracteres') ? (
                        <AlertCircle className="size-2" strokeWidth={2.5} />
                      ) : (
                        <span className="text-[10px] font-bold">✓</span>
                      )}
                    </span>
                    Pelo menos 8 caracteres
                  </p>
                  <p className={cn('flex items-center gap-1.5', validatePassword(password).includes('Pelo menos 1 letra maiúscula') ? 'text-danger' : 'text-success')}>
                    <span className="size-3.5 rounded-full border border-current flex items-center justify-center">
                      {validatePassword(password).includes('Pelo menos 1 letra maiúscula') ? (
                        <AlertCircle className="size-2" strokeWidth={2.5} />
                      ) : (
                        <span className="text-[10px] font-bold">✓</span>
                      )}
                    </span>
                    Pelo menos 1 letra maiúscula
                  </p>
                  <p className={cn('flex items-center gap-1.5', validatePassword(password).includes('Pelo menos 1 número') ? 'text-danger' : 'text-success')}>
                    <span className="size-3.5 rounded-full border border-current flex items-center justify-center">
                      {validatePassword(password).includes('Pelo menos 1 número') ? (
                        <AlertCircle className="size-2" strokeWidth={2.5} />
                      ) : (
                        <span className="text-[10px] font-bold">✓</span>
                      )}
                    </span>
                    Pelo menos 1 número
                  </p>
                  <p className={cn('flex items-center gap-1.5', validatePassword(password).includes('Pelo menos 1 caractere especial (!@#$%^&*...)') ? 'text-danger' : 'text-success')}>
                    <span className="size-3.5 rounded-full border border-current flex items-center justify-center">
                      {validatePassword(password).includes('Pelo menos 1 caractere especial (!@#$%^&*...)') ? (
                        <AlertCircle className="size-2" strokeWidth={2.5} />
                      ) : (
                        <span className="text-[10px] font-bold">✓</span>
                      )}
                    </span>
                    Pelo menos 1 caractere especial (!@#$%^&*...)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Confirmar Senha */}
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className={labelClass}>
              Confirmar senha <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="confirmPassword"
              ref={confirmPasswordRef}
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleConfirmPasswordChange(e.target.value)}
              onBlur={(e) => handleBlur('confirmPassword', e.target.value)}
              placeholder="••••••••"
              required
              disabled={pending}
              aria-invalid={invalidField === 'confirmPassword'}
              aria-describedby={error && invalidField === 'confirmPassword' ? 'form-error' : undefined}
              className={invalidField === 'confirmPassword' ? fieldErrorClass : inputClass}
            />
          </div>

          {/* Mensagem de erro global */}
          {error ? (
            <div
              id="form-error"
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger animate-in slide-in-from-top-2 duration-200"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <p>{error}</p>
            </div>
          ) : null}

          {/* Botão de submit */}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2.5} />
            ) : null}
            {pending ? 'Criando conta…' : 'Criar conta'}
          </Button>
        </div>
      </form>
    </Card>
  );
}