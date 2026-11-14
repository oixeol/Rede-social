'use client';

import { AlertCircle, LoaderCircle, Eye, EyeOff, Mail, Lock, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import type { FormEvent, ChangeEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { ApiError, apiRequest } from '@/lib/api';
import { signUp } from '@/lib/auth-client';
import { getCountries, type Country } from '@/lib/countries';

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
  const fullNameId = useId();
  const usernameId = useId();
  const emailId = useId();
  const countryId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const errorId = useId();

  // Refs
  const fullNameRef = useRef<HTMLInputElement>(null);
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
  const submittingRef = useRef(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');

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
    if (submittingRef.current) return;

    const fields: { field: FieldName; value: string; ref?: React.RefObject<HTMLInputElement | HTMLSelectElement | null> }[] = [
      { field: 'fullName', value: fullName, ref: fullNameRef },
      { field: 'username', value: username, ref: usernameRef },
      { field: 'email', value: email, ref: emailRef },
      { field: 'country', value: country, ref: undefined },
      { field: 'password', value: password, ref: passwordRef },
      { field: 'confirmPassword', value: confirmPassword, ref: confirmPasswordRef },
    ];

    for (const { field, value, ref } of fields) {
      if (!validateField(field, value)) {
        setInvalidField(field);
        setError(getFieldErrorMessage(field, value));
        ref?.current?.focus();
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

    submittingRef.current = true;
    setPending(true);
    setError(null);
    setInvalidField(null);

    try {
      await signUp.email({
        email: email.trim().toLowerCase(),
        password,
        name: fullName.trim(),
        username: username.trim().toLowerCase(),
        country,
        callbackURL: '/inicio',
      } as any);
      submittingRef.current = false;
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

  const selectClass = cn(
    'h-12 w-full rounded-xl border border-[#1A1A1C] bg-[#0D0D0D] pl-11 pr-10 text-[14px] text-white outline-none transition-colors appearance-none [color-scheme:dark]',
    'focus:border-[#FF6A00] focus:ring-2 focus:ring-[#FF6A00]/20',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'bg-no-repeat bg-right pr-10',
    "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")] bg-center"
  );

  const labelClass = 'text-[12.5px] font-medium text-[#D4D4D8]';

  const fieldErrorClass =
    'h-12 w-full rounded-xl border border-[#EF4444] bg-[#0D0D0D] pl-11 pr-4 text-[14px] text-white placeholder:text-[#5F5F67] outline-none transition-colors focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/20 disabled:cursor-not-allowed disabled:opacity-50';

  const iconClass = 'pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#71717A]';
  const iconStroke = { strokeWidth: 1.8 };

  return (
    <div className="flex w-full flex-col">
      <h1 className="font-display text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] text-white sm:text-[34px]">
        Crie sua conta no <span className="text-brand">Orbit!</span>
      </h1>
      <p className="mt-2.5 text-[13.5px] text-[#A1A1AA]">
        Estamos muito animados em te ver por aqui!
      </p>

      <form onSubmit={handleSubmit} noValidate aria-busy={pending} className="mt-7 flex flex-col gap-4">
        {/* Nome Completo */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fullNameId} className={labelClass}>
            Nome completo <span className="text-[#EF4444]" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <Mail aria-hidden="true" className={iconClass} {...iconStroke} />
            <input
              id={fullNameId}
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
              aria-describedby={error && invalidField === 'fullName' ? errorId : undefined}
              className={invalidField === 'fullName' ? fieldErrorClass : inputClass}
            />
          </div>
        </div>

        {/* Nome de usuário */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={usernameId} className={labelClass}>
            Nome de usuário <span className="text-[#EF4444]" aria-hidden="true">*</span>
          </label>
          <div className="relative flex">
            <div 
              className="flex h-12 items-center justify-center rounded-l-xl border border-r-0 border-[#1A1A1C] bg-[#161618] px-3.5 text-[14px] font-semibold text-[#FF6A00] select-none"
              aria-hidden="true"
            >
              @
            </div>
            <div className="relative flex-1">
              <input
                id={usernameId}
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
                  error && (invalidField === 'username' || usernameStatus === 'unavailable') ? errorId : undefined
                )}
                className={cn(
                  'h-12 w-full rounded-r-xl border border-[#1A1A1C] bg-[#0D0D0D] px-4 text-[14px] text-white placeholder:text-[#5F5F67] outline-none transition-colors focus:border-[#FF6A00] focus:ring-2 focus:ring-[#FF6A00]/20 disabled:cursor-not-allowed disabled:opacity-50',
                  invalidField === 'username' || usernameStatus === 'unavailable' ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20' : ''
                )}
              />
              {usernameStatus === 'checking' ? (
                <span className="absolute inset-y-0 right-3.5 flex items-center text-xs text-[#71717A]" id="username-status">
                  verificando…
                </span>
              ) : usernameStatus === 'available' ? (
                <span className="absolute inset-y-0 right-3.5 flex items-center text-xs text-[#22C55E]" id="username-status">
                  disponível ✓
                </span>
              ) : usernameStatus === 'unavailable' ? (
                <span className="absolute inset-y-0 right-3.5 flex items-center text-xs text-[#EF4444]" id="username-status">
                  já está em uso
                </span>
              ) : null}
            </div>
          </div>
          <p className="text-[11px] text-[#71717A]">3–24 caracteres. Apenas letras minúsculas, números, ponto e underline.</p>
        </div>

        {/* E-mail */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className={labelClass}>
            E-mail <span className="text-[#EF4444]" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <Mail aria-hidden="true" className={iconClass} {...iconStroke} />
            <input
              id={emailId}
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
              aria-describedby={error && invalidField === 'email' ? errorId : undefined}
              className={invalidField === 'email' ? fieldErrorClass : inputClass}
            />
          </div>
        </div>

        {/* País */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={countryId} className={labelClass}>
            País <span className="text-[#EF4444]" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <Globe aria-hidden="true" className={iconClass} {...iconStroke} />
            <select
              id={countryId}
              name="country"
              value={country}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setCountry(e.target.value)}
              onBlur={(e) => handleBlur('country', e.target.value)}
              required
              disabled={pending}
              aria-invalid={invalidField === 'country'}
              aria-describedby={error && invalidField === 'country' ? errorId : undefined}
              className={cn(
                selectClass,
                invalidField === 'country' && 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20'
              )}
            >
              <option value="" className="bg-[#0D0D0D] text-white">Selecione seu país</option>
              {countriesList.map((c: Country) => (
                <option key={c.code} value={c.code} className="bg-[#0D0D0D] text-white">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Senha */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={passwordId} className={labelClass}>
            Senha <span className="text-[#EF4444]" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <Lock aria-hidden="true" className={iconClass} {...iconStroke} />
            <input
              id={passwordId}
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
              aria-describedby={error && invalidField === 'password' ? errorId : 'password-requirements'}
              className={cn(
                inputClass,
                'pr-11',
                invalidField === 'password' && 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20'
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#71717A] transition-colors hover:text-white"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff aria-hidden="true" className="size-[17px]" strokeWidth={1.8} /> : <Eye aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />}
            </button>
          </div>
          <div id="password-requirements" className="space-y-1 text-[11px]" aria-live="polite">
            {password.length > 0 && (
              <>
                <p className={cn('flex items-center gap-1.5', validatePassword(password).includes('Pelo menos 8 caracteres') ? 'text-[#EF4444]' : 'text-[#22C55E]')}>
                  <span className="size-3.5 rounded-full border border-current flex items-center justify-center">
                    {validatePassword(password).includes('Pelo menos 8 caracteres') ? (
                      <AlertCircle className="size-2" strokeWidth={2.5} />
                    ) : (
                      <span className="text-[10px] font-bold">✓</span>
                    )}
                  </span>
                  Pelo menos 8 caracteres
                </p>
                <p className={cn('flex items-center gap-1.5', validatePassword(password).includes('Pelo menos 1 letra maiúscula') ? 'text-[#EF4444]' : 'text-[#22C55E]')}>
                  <span className="size-3.5 rounded-full border border-current flex items-center justify-center">
                    {validatePassword(password).includes('Pelo menos 1 letra maiúscula') ? (
                      <AlertCircle className="size-2" strokeWidth={2.5} />
                    ) : (
                      <span className="text-[10px] font-bold">✓</span>
                    )}
                  </span>
                  Pelo menos 1 letra maiúscula
                </p>
                <p className={cn('flex items-center gap-1.5', validatePassword(password).includes('Pelo menos 1 número') ? 'text-[#EF4444]' : 'text-[#22C55E]')}>
                  <span className="size-3.5 rounded-full border border-current flex items-center justify-center">
                    {validatePassword(password).includes('Pelo menos 1 número') ? (
                      <AlertCircle className="size-2" strokeWidth={2.5} />
                    ) : (
                      <span className="text-[10px] font-bold">✓</span>
                    )}
                  </span>
                  Pelo menos 1 número
                </p>
                <p className={cn('flex items-center gap-1.5', validatePassword(password).includes('Pelo menos 1 caractere especial (!@#$%^&*...)') ? 'text-[#EF4444]' : 'text-[#22C55E]')}>
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor={confirmPasswordId} className={labelClass}>
            Confirmar senha <span className="text-[#EF4444]" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <Lock aria-hidden="true" className={iconClass} {...iconStroke} />
            <input
              id={confirmPasswordId}
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
              aria-describedby={error && invalidField === 'confirmPassword' ? errorId : undefined}
              className={invalidField === 'confirmPassword' ? fieldErrorClass : inputClass}
            />
          </div>
        </div>

        {/* Mensagem de erro global */}
        {error ? (
          <div
            id={errorId}
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-[#EF4444]/30 bg-[#3A1414] p-3 text-[13px] text-[#FCA5A5] animate-in slide-in-from-top-2 duration-200"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            <p>{error}</p>
          </div>
        ) : null}

        {/* Botão de submit */}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF8C00] via-[#FF6A00] to-[#FF4500] text-[15px] font-bold text-[#0A0A0A] shadow-[0_10px_30px_rgba(255,106,0,0.28)] transition-[filter,box-shadow] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2.5} /> : null}
          {pending ? 'Criando conta…' : 'Criar conta'}
        </button>

        <div className="my-1 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-[#1A1A1C]" />
          <span className="text-[10px] font-semibold tracking-[0.2em] text-[#71717A] uppercase">ou</span>
          <span className="h-px flex-1 bg-[#1A1A1C]" />
        </div>

        <div className="grid gap-2.5">
          <button
            type="button"
            onClick={() => window.location.href = '/api/auth/sign-in/social?provider=google&callbackURL=/inicio'}
            className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[#2E2E2E] bg-transparent text-[13.5px] font-semibold text-white transition-colors hover:border-[#FF6A00]/50 hover:bg-white/[0.03]"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[17px]">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z" />
            </svg>
            Continuar com Google
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                setPending(true);
                const res = await fetch('/api/auth/sign-in/passkey', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ callbackURL: '/inicio' }),
                });
                if (!res.ok) throw new Error('Falha ao autenticar com Passkey');
                const data = await res.json();
                if (data?.url) window.location.href = data.url;
              } catch {
                setError('Erro ao usar Passkey.');
                setPending(false);
              }
            }}
            disabled={pending}
            className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[#2E2E2E] bg-transparent text-[13.5px] font-semibold text-white transition-colors hover:border-[#FF6A00]/50 hover:bg-white/[0.03]"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[17px] fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round">
              <circle cx="8" cy="12" r="4.5" />
              <path d="M12.5 12v4.5a2 2 0 0 0 4 0V12a4.5 4.5 0 0 0-9 0v2" />
              <path d="M15.5 16.5V18" />
            </svg>
            Entrar com Passkey (Face ID / Touch ID)
          </button>

          <button
            type="button"
            disabled
            className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[#2E2E2E] bg-transparent text-[13.5px] font-semibold text-[#71717A] cursor-not-allowed opacity-50"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[17px] fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            Login com QR Code — Em breve
          </button>
        </div>

        <p className="mt-7 text-center text-[13px] text-[#A1A1AA]">
          Já tem uma conta?{' '}
          <a
            href="/entrar"
            className="font-semibold text-[#FF8C00] transition-colors hover:text-[#FF6A00]"
          >
            Entrar
          </a>
        </p>
      </form>
    </div>
  );
}