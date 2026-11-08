'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

import { Avatar } from '@/components/ui/avatar';
import { SearchField } from '@/components/ui/search-field';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { SearchResponse } from '@/lib/types';

interface AppTopbarProps {
  currentPath: string;
  /** Sidebar expandida: o topbar acompanha o mesmo deslocamento do conteúdo. */
  sidebarExpanded?: boolean;
}

/** Topbar enxuto: apenas o campo de busca. */
export function AppTopbar({ currentPath, sidebarExpanded = false }: AppTopbarProps) {
  const router = useRouter();
  const isProfilePage = currentPath.startsWith('/perfil/');

  return (
    <header className="relative z-30 bg-transparent">
      <div
        className={cn(
          'transition-[padding] duration-200 motion-reduce:transition-none',
          sidebarExpanded ? 'md:pl-[248px]' : 'md:pl-[72px]',
        )}
      >
        <div
          className={cn(
            'mx-auto grid h-16 w-full max-w-[1288px] items-center gap-3 px-4 sm:px-5',
            isProfilePage
              ? 'xl:grid-cols-[minmax(0,872px)_354px] xl:gap-[22px]'
              : 'grid-cols-[minmax(0,1fr)_auto]',
          )}
        >
          <div className="min-w-0">
            <TopbarSearch
              onNavigate={(username) => {
                router.push(`/perfil/${encodeURIComponent(username)}` as Route);
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

interface TopbarSearchProps {
  onNavigate: (username: string) => void;
}

function TopbarSearch({ onNavigate }: TopbarSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse['users']>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const searchId = useId();
  const inputId = `busca-input-${searchId}`;
  const resultsId = `busca-resultados-${searchId}`;

  const visibleResults = results.slice(0, 6);

  const debouncedSearch = useCallback((value: string) => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setActiveResultIndex(-1);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await apiRequest<SearchResponse>(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        setResults(response.users);
        setActiveResultIndex(response.users.length > 0 ? 0 : -1);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setResults([]);
          setActiveResultIndex(-1);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    cleanupRef.current = () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveResultIndex(-1);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      cleanupRef.current?.();
    };
  }, []);

  function navigateToResult(username: string) {
    setOpen(false);
    setQuery('');
    setResults([]);
    setActiveResultIndex(-1);
    onNavigate(username);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!visibleResults.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveResultIndex((index) => (index + 1) % visibleResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveResultIndex((index) =>
        index <= 0 ? visibleResults.length - 1 : index - 1,
      );
    } else if (event.key === 'Enter' && activeResultIndex >= 0) {
      event.preventDefault();
      const selected = visibleResults[activeResultIndex];
      if (selected) navigateToResult(selected.username);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveResultIndex(-1);
    }
  }

  const activeDescendant =
    open && activeResultIndex >= 0
      ? `${resultsId}-opcao-${activeResultIndex}`
      : undefined;

  return (
    <div ref={rootRef} className="relative w-full">
      <SearchField
        id={inputId}
        value={query}
        onValueChange={(value) => {
          setQuery(value);
          debouncedSearch(value);
          setOpen(true);
          setActiveResultIndex(-1);
        }}
        onSubmit={() => {
          const selected =
            activeResultIndex >= 0
              ? visibleResults[activeResultIndex]
              : visibleResults[0];
          if (selected) navigateToResult(selected.username);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Buscar no Vibra..."
        label="Buscar no Vibra"
        className="h-11 border-border-strong"
        rounded="pill"
        role="combobox"
        aria-expanded={open && query.trim().length >= 2}
        aria-controls={resultsId}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant}
      />

      {open && query.trim().length >= 2 ? (
        <div
          id={resultsId}
          role="listbox"
          aria-label="Resultados da busca"
          className="absolute top-[calc(100%+0.5rem)] left-0 z-50 w-full overflow-hidden rounded-2xl border border-border bg-surface-raised p-1.5 shadow-float"
        >
          {loading ? (
            <p className="px-3 py-4 text-center text-sm text-muted" role="status">
              Buscando…
            </p>
          ) : visibleResults.length ? (
            visibleResults.map((user, index) => (
              <button
                key={user.id}
                id={`${resultsId}-opcao-${index}`}
                type="button"
                role="option"
                aria-selected={activeResultIndex === index}
                onMouseEnter={() => setActiveResultIndex(index)}
                onClick={() => navigateToResult(user.username)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                  activeResultIndex === index
                    ? 'bg-surface-subtle'
                    : 'hover:bg-surface-subtle',
                )}
              >
                <Avatar src={user.avatar} alt={user.name} name={user.name} size="sm" />
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-foreground">{user.name}</strong>
                  <span className="block truncate text-xs text-muted">@{user.username}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-sm text-muted">Nenhuma pessoa encontrada.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
