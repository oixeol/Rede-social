'use client';

import { AlertCircle, LoaderCircle, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import type { FormEvent, ChangeEvent } from 'react';
import { useEffect, useId, useRef, useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { apiRequest, ApiError } from '@/lib/api';
import { getCountries, getStatesByCountry, type Country, type State } from '@/lib/countries';

interface SignupResponse {
  user: unknown;
  stats: unknown;
}

type FieldName =
  | 'firstName'
  | 'lastName'
  | 'username'
  | 'email'
  | 'birthDate'
  | 'gender'
  | 'country'
  | 'state'
  | 'password'
  | 'confirmPassword';

export const GENDER_OPTIONS = [
  { value: 'cis_man', label: 'Homem Cis' },
  { value: 'cis_woman', label: 'Mulher Cis' },
  { value: 'trans_man', label: 'Homem Trans' },
  { value: 'trans_woman', label: 'Mulher Trans' },
  { value: 'non_binary', label: 'Não-binário' },
  { value: 'genderfluid', label: 'Gênero-fluido' },
  { value: 'agender', label: 'Agênero' },
  { value: 'other', label: 'Outros / Prefiro não informar' },
] as const;

export type GenderValue = (typeof GENDER_OPTIONS)[number]['value'];

function calculateAge(birthDate: string): number | null {
  const today = new Date();
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function validatePassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) {
    errors.push('Pelo menos 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Pelo menos 1 letra maiúscula');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Pelo menos 1 número');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Pelo menos 1 caractere especial (!@#$%^&*...)');
  }
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

  // Refs para foco
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const birthDateRef = useRef<HTMLInputElement>(null);
  const genderRef = useRef<HTMLSelectElement>(null);
  const countryRef = useRef<HTMLSelectElement>(null);
  const stateRef = useRef<HTMLSelectElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // Estados do formulário
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<GenderValue | ''>('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<FieldName | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [submittingRef, setSubmittingRef] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle'|'checking'|'available'|'unavailable'>('idle');

  // Estados/regiões derivados do país selecionado (sem efeito colateral)
  const states = useMemo<State[]>(
    () => (country ? getStatesByCountry(country) : []),
    [country]
  );

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
      if (caught.status >= 400 && caught.status < 500) {
        return caught.message;
      }
      return 'Não foi possível criar sua conta agora. Tente novamente em instantes.';
    }
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }

  function validateField(field: FieldName, value: string): boolean {
    switch (field) {
      case 'firstName':
        return value.trim().length >= 1;
      case 'lastName':
        return value.trim().length >= 1;
      case 'username':
        return validateUsername(value.trim().toLowerCase());
      case 'email':
        return validateEmail(value);
      case 'birthDate': {
        const age = calculateAge(value);
        return age !== null && age >= 12;
      }
      case 'gender':
        return GENDER_OPTIONS.some((g) => g.value === value);
      case 'country':
        return countriesList.some((c) => c.code === value);
      case 'state':
        return states.some((s) => s.code === value);
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
      case 'firstName':
        return 'Informe seu primeiro nome.';
      case 'lastName':
        return 'Informe seu sobrenome.';
      case 'username':
        return 'Use de 3 a 24 caracteres: letras minúsculas, números, ponto ou underline.';
      case 'email':
        return 'Informe um e-mail válido.';
      case 'birthDate': {
        const age = calculateAge(value);
        if (age === null) return 'Data de nascimento inválida.';
        if (age < 12) return 'Você deve ter pelo menos 12 anos para se cadastrar.';
        return '';
      }
      case 'gender':
        return 'Selecione seu gênero.';
      case 'country':
        return 'Selecione seu país.';
      case 'state':
        return 'Selecione seu estado/região.';
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

    // Validar todos os campos
    const fields: {
      field: FieldName;
      value: string;
      ref: React.RefObject<HTMLInputElement | HTMLSelectElement | null>;
    }[] = [
      { field: 'firstName', value: firstName, ref: firstNameRef },
      { field: 'lastName', value: lastName, ref: lastNameRef },
      { field: 'username', value: username, ref: usernameRef },
      { field: 'email', value: email, ref: emailRef },
      { field: 'birthDate', value: birthDate, ref: birthDateRef },
      { field: 'gender', value: gender, ref: genderRef },
      { field: 'country', value: country, ref: countryRef },
      { field: 'state', value: state, ref: stateRef },
      { field: 'password', value: password, ref: passwordRef },
      { field: 'confirmPassword', value: confirmPassword, ref: confirmPasswordRef },
    ];

    for (const { field, value, ref } of fields) {
      if (!validateField(field, value)) {
        setInvalidField(field);
        setError(getFieldErrorMessage(field, value));
        ref.current?.focus();
        return;
      }
    }

    if (usernameStatus === 'unavailable') {
      setInvalidField('username');
      setError('Esse nome de usuário já está em uso. Escolha outro.');
      usernameRef.current?.focus();
      return;
    }

    // Verificar senhas conferem
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

    try {
      await apiRequest<SignupResponse>('/api/register', {
        method: 'POST',
        body: {
          username: username.trim().toLowerCase(),
          name: `${firstName.trim()} ${lastName.trim()}`,
          email: email.trim().toLowerCase(),
          birthDate,
          gender,
          country,
          state,
          password,
        },
      });
      router.push('/inicio' as Route);
      router.refresh();
    } catch (caught) {
      setError(messageFromError(caught));
      setPending(false);
      setSubmittingRef(false);
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
          {/* Nome e Sobrenome */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="firstName" className={labelClass}>
                Primeiro nome <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="firstName"
                ref={firstNameRef}
                type="text"
                name="firstName"
                autoComplete="given-name"
                value={firstName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                onBlur={(e) => handleBlur('firstName', e.target.value)}
                placeholder="João"
                required
                disabled={pending}
                aria-invalid={invalidField === 'firstName'}
                aria-describedby={error && invalidField === 'firstName' ? 'form-error' : undefined}
                className={invalidField === 'firstName' ? fieldErrorClass : inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="lastName" className={labelClass}>
                Sobrenome <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="lastName"
                ref={lastNameRef}
                type="text"
                name="lastName"
                autoComplete="family-name"
                value={lastName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
                onBlur={(e) => handleBlur('lastName', e.target.value)}
                placeholder="Silva"
                required
                disabled={pending}
                aria-invalid={invalidField === 'lastName'}
                aria-describedby={error && invalidField === 'lastName' ? 'form-error' : undefined}
                className={invalidField === 'lastName' ? fieldErrorClass : inputClass}
              />
            </div>
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
                <span
                  className="absolute inset-y-0 right-4 flex items-center text-xs text-muted"
                  id="username-status"
                >
                  verificando…
                </span>
              ) : usernameStatus === 'available' ? (
                <span
                  className="absolute inset-y-0 right-4 flex items-center text-xs text-success"
                  id="username-status"
                >
                  disponível ✓
                </span>
              ) : usernameStatus === 'unavailable' ? (
                <span
                  className="absolute inset-y-0 right-4 flex items-center text-xs text-danger"
                  id="username-status"
                >
                  já está em uso
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted">
              3–24 caracteres. Apenas letras minúsculas, números, ponto e underline.
            </p>
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

          {/* Data de nascimento */}
          <div className="space-y-1.5">
            <label htmlFor="birthDate" className={labelClass}>
              Data de nascimento <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="birthDate"
              ref={birthDateRef}
              type="date"
              name="birthDate"
              value={birthDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setBirthDate(e.target.value)}
              onBlur={(e) => handleBlur('birthDate', e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
              disabled={pending}
              aria-invalid={invalidField === 'birthDate'}
              aria-describedby={error && invalidField === 'birthDate' ? 'form-error' : undefined}
              className={invalidField === 'birthDate' ? fieldErrorClass : inputClass}
            />
            <p className="text-xs text-muted">Você deve ter pelo menos 12 anos para se cadastrar.</p>
          </div>

          {/* Gênero */}
          <div className="space-y-1.5">
            <label htmlFor="gender" className={labelClass}>
              Gênero <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <select
              id="gender"
              ref={genderRef}
              name="gender"
              value={gender}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setGender(e.target.value as GenderValue)}
              onBlur={(e) => handleBlur('gender', e.target.value)}
              required
              disabled={pending}
              aria-invalid={invalidField === 'gender'}
              aria-describedby={error && invalidField === 'gender' ? 'form-error' : undefined}
              className={cn(selectClass, invalidField === 'gender' && 'border-danger focus:border-danger focus:ring-danger/20')}
            >
              <option value="" className="bg-[#0D0D0D] text-white">Selecione</option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#0D0D0D] text-white">
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Localização - País e Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="country" className={labelClass}>
                País <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <select
                id="country"
                ref={countryRef}
                name="country"
                value={country}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  setCountry(e.target.value);
                  setState(''); // Estado não é válido para outro país
                }}
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

            <div className="space-y-1.5">
              <label htmlFor="state" className={labelClass}>
                Estado / Região <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <select
                id="state"
                ref={stateRef}
                name="state"
                value={state}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setState(e.target.value)}
                onBlur={(e) => handleBlur('state', e.target.value)}
                required
                disabled={pending || states.length === 0}
                aria-invalid={invalidField === 'state'}
                aria-describedby={error && invalidField === 'state' ? 'form-error' : undefined}
                className={cn(
                  selectClass,
                  invalidField === 'state' && 'border-danger focus:border-danger focus:ring-danger/20',
                  states.length === 0 && 'opacity-50 cursor-not-allowed'
                )}
              >
                <option value="" className="bg-[#0D0D0D] text-white">Selecione o país primeiro</option>
                {states.map((s) => (
                  <option key={s.code} value={s.code} className="bg-[#0D0D0D] text-white">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
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