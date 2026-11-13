'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Bell, MessageSquare } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { SearchField } from '@/components/ui/search-field';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { SearchResponse } from '@/lib/types';

import { OrbitLogo } from '@/components/shell/orbit-logo';
import { UserMenu } from '@/components/shell/user-menu';
import type { NavigationItem } from '@/components/shell/navigation';

/**
 * Topbar fixa: logo + navegação primária à esquerda (desktop), busca no Explorar,
 * e ações do usuário (mensagens, notificações, avatar) à direita.
 */
export function AppTopbar({
  currentPath,
  primaryNavigation,
  unreadNotifications,
  unreadMessages,
  user,
}: {
  currentPath: string;
  primaryNavigation: NavigationItem[];
  unreadNotifications: number;
  unreadMessages: number;
  user: { name: string; username: string; avatar: string | null; presence: 'available' | 'away' | 'dnd' | 'invisible' };
}) {
  const isExplore = currentPath === '/explorar';

  return (
    <header className="fixed top-0 right-0 left-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-full items-center gap-4 px-4 sm:px-6">
        {/* Logo + Navegação primária (desktop) */}
        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/inicio"
            aria-label="Orbit — página inicial"
            className="shrink-0"
          >
            <OrbitLogo compact />
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Navegação principal">
            {primaryNavigation.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={currentPath === item.href || currentPath.startsWith(`${item.href}/`) ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  currentPath === item.href || currentPath.startsWith(`${item.href}/`)
                    ? 'text-foreground'
                    : 'text-muted hover:text-foreground hover:bg-surface-subtle',
                )}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>

        {/* Busca (apenas Explorar) */}
        {isExplore ? (
          <div className="mr-auto w-full max-w-md">
            <TopbarSearch />
          </div>
        ) : (
          <div className="mr-auto" />
        )}

        {/* Ações do usuário à direita */}
        <TopbarActions
          unreadNotifications={unreadNotifications}
          unreadMessages={unreadMessages}
          user={user}
        />
      </div>
    </header>
  );
}

interface TopbarSearchProps {
  onNavigate?: (username: string) => void;
}

function TopbarSearch({ onNavigate }: TopbarSearchProps) {
  const router = useRouter();
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
    const timer = window.setTimeout(() => {
      setLoading(true);
      apiRequest<SearchResponse>(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((response) => {
          setResults(response.users);
          setActiveResultIndex(-1);
        })
        .catch((error) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            setResults([]);
            setActiveResultIndex(-1);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    cleanupRef.current = () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveResultIndex(-1);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  function navigateToResult(username: string) {
    setOpen(false);
    setQuery('');
    setResults([]);
    setActiveResultIndex(-1);
    if (onNavigate) {
      onNavigate(username);
      return;
    }
    router.push(`/perfil/${encodeURIComponent(username)}` as Route);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!visibleResults.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveResultIndex((current) => (current + 1) % visibleResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveResultIndex((current) =>
        current <= 0 ? visibleResults.length - 1 : current - 1,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected =
        activeResultIndex >= 0
          ? visibleResults[activeResultIndex]
          : visibleResults[0];
      if (selected) navigateToResult(selected.username);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveResultIndex(-1);
    }
  }

  const activeDescendant =
    open && query.trim().length >= 2 && activeResultIndex >= 0
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
        placeholder="Buscar no Orbit..."
        label="Buscar no Orbit"
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

interface TopbarActionsProps {
  unreadNotifications: number;
  unreadMessages: number;
  user: { name: string; username: string; avatar: string | null; presence: 'available' | 'away' | 'dnd' | 'invisible' };
}

/** Ações do topo: mensagens, notificações e menu do usuário no canto superior direito. */
export function TopbarActions({ unreadNotifications, unreadMessages, user }: TopbarActionsProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1">
      <IconAction
        href="/mensagens"
        label="Mensagens"
        badge={unreadMessages}
        icon={<MessageSquare className="size-5" />}
        onClick={() => router.push('/mensagens' as Route)}
      />
      <IconAction
        href="/notificacoes"
        label="Notificações"
        badge={unreadNotifications}
        icon={<Bell className="size-5" />}
        onClick={() => router.push('/notificacoes' as Route)}
      />
      <UserMenu
        name={user.name}
        username={user.username}
        avatar={user.avatar}
        presence={user.presence}
        onLogout={() => router.push('/entrar' as Route)}
      />
    </div>
  );
}

function IconAction({
  href,
  label,
  badge,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  badge: number;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={badge > 0 ? `${label} (${badge})` : label}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
    >
      <span aria-hidden="true">{icon}</span>
      {badge > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 py-0.5 text-[10px] font-bold leading-4 text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  );
}