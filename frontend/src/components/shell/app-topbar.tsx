'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';

import { Avatar } from '@/components/ui/avatar';
import { SearchField } from '@/components/ui/search-field';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { apiRequest } from '@/lib/api';
import type { SearchResponse } from '@/lib/types';

/**
 * Topbar do Vibra (visual da referência).
 *
 * Layout:
 * - Campo de busca pill alinhado ao início da coluna central
 * - Canto direito: sol (tema), sino com ponto vermelho, avatar pequeno
 *
 * Altura: 72px (h-[72px])
 * Conteúdo segue a grade `grid-cols-[minmax(0,1fr)_355px] gap-6`
 */

interface AppTopbarProps {
  me: {
    user: {
      id: number;
      username: string;
      name: string;
      avatar: string | null;
    };
    stats: { verified: 0 | 1 };
    unreadNotifications: number;
    unreadMessages: number;
  };
}

export function AppTopbar({ me }: AppTopbarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse['users']>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
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
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  function goToProfile(username: string) {
    setOpen(false);
    setQuery('');
    router.push(`/perfil/${encodeURIComponent(username)}` as Route);
  }

  return (
    <header
      className="sticky top-0 z-30 flex h-[72px] items-center border-b border-border bg-surface/90 backdrop-blur-md"
    >
      <div
        className="mx-auto grid w-full max-w-[1291px] items-center gap-3 px-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_355px] xl:gap-6"
      >
        <div className="flex items-center gap-3">
          <div ref={containerRef} className="relative w-full max-w-[520px]">
            <SearchField
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                debouncedSearch(value);
                setOpen(true);
              }}
              onSubmit={() => {
                if (results[0]) goToProfile(results[0].username);
              }}
              placeholder="Buscar no Vibra..."
              label="Buscar no Vibra"
              aria-expanded={open}
              aria-controls="busca-resultados"
              aria-autocomplete="list"
            />

            {open && query.trim().length >= 2 ? (
              <div
                id="busca-resultados"
                role="listbox"
                aria-label="Resultados da busca"
                className="absolute top-[calc(100%+0.5rem)] left-0 z-50 w-full overflow-hidden rounded-2xl border border-border bg-surface-raised p-1.5 shadow-float"
              >
                {loading ? (
                  <p className="px-3 py-4 text-center text-sm text-muted" role="status">
                    Buscando…
                  </p>
                ) : results.length ? (
                  results.slice(0, 6).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onClick={() => goToProfile(user.username)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-subtle"
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
        </div>

        <div className="flex items-center justify-end gap-2 xl:col-start-2">
          <ThemeToggle />
          <span className="relative inline-flex size-10 items-center justify-center text-muted transition-colors hover:bg-surface-subtle hover:text-foreground">
            <Bell aria-hidden="true" className="size-5" />
            {me.unreadNotifications > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -top-1.5 -right-1.5 size-3.5 rounded-full bg-danger"
              />
            ) : null}
          </span>
          <Link
            href={`/perfil/${encodeURIComponent(me.user.username)}` as Route}
            aria-label="Ver meu perfil"
          >
            <Avatar
              src={me.user.avatar}
              alt={me.user.name}
              name={me.user.name}
              size="sm"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}