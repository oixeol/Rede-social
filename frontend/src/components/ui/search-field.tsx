'use client';

import { Search, X } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  onSubmit?: () => void;
  rounded?: 'pill' | 'lg' | 'none';
}

export function SearchField({
  value,
  onValueChange,
  label = 'Buscar no Orbit',
  placeholder = 'Buscar no Orbit...',
  className,
  onSubmit,
  id,
  rounded = 'pill',
  ...props
}: SearchFieldProps) {
  const generatedId = useId();
  const labelId = useId();
  const inputId = id ?? generatedId;

  const roundedClass = rounded === 'pill' ? 'rounded-pill' : rounded === 'lg' ? 'rounded-lg' : '';

  return (
    <form
      role="search"
      className={cn(
        'flex h-10 w-full items-center gap-2 border border-border bg-surface-subtle/75 px-3 transition-colors focus-within:border-border-strong focus-within:bg-surface-raised focus-within:shadow-[0_0_0_3px_rgb(from_var(--vibra-brand-fill)_r_g_b_/_0.14)]',
        roundedClass,
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <Search aria-hidden="true" className="size-4 shrink-0 text-muted" strokeWidth={2} />
      <label id={labelId} className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-labelledby={labelId}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => onValueChange('')}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : (
        <span aria-hidden="true" className="size-11 shrink-0" />
      )}
    </form>
  );
}
