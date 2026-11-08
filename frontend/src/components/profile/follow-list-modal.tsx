'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { apiRequest } from '@/lib/api';
import type { FollowListResponse, FollowListUser } from '@/lib/types';

export type FollowListKind = 'followers' | 'following';

interface FollowListModalProps {
  kind: FollowListKind;
  username: string;
  isMe: boolean;
  onClose: () => void;
  onCountChange: (delta: number) => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; users: FollowListUser[] }
  | { status: 'error'; message: string };

/** Modal de seguidores/seguindo: busca por nome, @username ou bio. */
export function FollowListModal({
  kind,
  username,
  isMe,
  onClose,
  onCountChange,
}: FollowListModalProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  const title = kind === 'followers' ? 'Seguidores' : 'Seguindo';
  const searchLabel = kind === 'followers' ? 'Buscar seguidor' : 'Buscar pessoa seguida';
  const emptyLabel =
    kind === 'followers' ? 'Nenhum seguidor encontrado.' : 'Nenhuma pessoa seguida encontrada.';

  const filteredUsers = useMemo(() => {
    const source = state.status === 'ready' ? state.users : [];
    const query = search.trim().toLowerCase();
    if (!query) return source;
    return source.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.bio.toLowerCase().includes(query),
    );
  }, [state, search]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    apiRequest<FollowListResponse>(`/api/users/${encodeURIComponent(username)}/${kind}`)
      .then((response) => {
        if (requestIdRef.current !== requestId) return;
        setState({ status: 'ready', users: response.users });
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Não foi possível carregar a lista.',
        });
      });

    return () => {
      requestIdRef.current += 1;
    };
  }, [kind, username]);

  useEffect(() => {
    searchInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  async function handleRemove(user: FollowListUser) {
    setRemoving(user.username);
    const endpoint =
      kind === 'followers'
        ? `/api/users/${encodeURIComponent(username)}/followers/${encodeURIComponent(user.username)}`
        : `/api/users/${encodeURIComponent(username)}/following/${encodeURIComponent(user.username)}`;

    try {
      await apiRequest<{ removed: boolean }>(endpoint, { method: 'DELETE' });
      setState((previous) =>
        previous.status === 'ready'
          ? { status: 'ready', users: previous.users.filter((item) => item.id !== user.id) }
          : previous,
      );
      onCountChange(-1);
    } catch {
      setState((previous) =>
        previous.status === 'ready'
          ? previous
          : { status: 'error', message: 'Não foi possível remover.' },
      );
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-list-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(640px,88vh)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-float">
        <header className="relative flex items-center justify-center border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar lista"
            className="absolute left-3 inline-flex size-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
          <h2 id="follow-list-title" className="text-[15px] font-bold text-foreground">
            {title}
          </h2>
        </header>

        <div className="px-4 py-3">
          <label htmlFor="follow-list-search" className="sr-only">
            {searchLabel}
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <input
              ref={searchInputRef}
              id="follow-list-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchLabel}
              autoComplete="off"
              className="w-full rounded-xl border border-border bg-surface-subtle py-2.5 pr-3 pl-9 text-[14px] text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {state.status === 'loading' ? (
            <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Carregando…
            </p>
          ) : state.status === 'error' ? (
            <p className="px-3 py-10 text-center text-[13px] text-danger">{state.message}</p>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-[13px] text-muted">{emptyLabel}</p>
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-[13px] font-semibold text-brand hover:underline"
                >
                  Limpar busca
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-0.5" role="list">
              {filteredUsers.map((user) => (
                <li key={user.id}>
                  <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-subtle">
                    <Link
                      href={`/perfil/${encodeURIComponent(user.username)}` as Route}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <Avatar
                        src={user.avatar}
                        alt={`Foto de perfil de ${user.name}`}
                        name={user.name}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-foreground">
                          {user.name}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          {user.bio || `@${user.username}`}
                        </span>
                      </span>
                    </Link>

                    {isMe ? (
                      <button
                        type="button"
                        disabled={removing === user.username}
                        onClick={() => handleRemove(user)}
                        aria-label={`Remover ${user.name}`}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        {removing === user.username ? (
                          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                        ) : (
                          'Remover'
                        )}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
