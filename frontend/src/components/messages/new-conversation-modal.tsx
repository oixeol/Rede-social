'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Loader2, Search, X } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { SearchUser } from '@/lib/types';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: number) => void;
}

export function NewConversationModal({ isOpen, onClose, onConversationCreated }: NewConversationModalProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const searchId = useId();

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  const debouncedSearch = (value: string) => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      apiRequest<{ users: SearchUser[] }>(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => {
          setResults(res.users);
          setLoading(false);
        })
        .catch((err) => {
          if (!(err instanceof DOMException && err.name === 'AbortError')) {
            setResults([]);
            setLoading(false);
          }
        });
    }, 200);

    cleanupRef.current = () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setError(null);
    debouncedSearch(value);
  };

  async function handleCreate(username: string) {
    setCreating(username);
    setError(null);
    try {
      const res = await apiRequest<{ conversation: { id: number } }>('/api/conversations', {
        method: 'POST',
        body: { username },
      });
      onConversationCreated(res.conversation.id);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível iniciar a conversa.';
      setError(msg);
    } finally {
      setCreating(null);
    }
  }

  const visibleResults = results.slice(0, 8);

  return (
    <div
      className={cn('fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm', !isOpen && 'hidden')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-conv-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(640px,88vh)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-float">
        <header className="relative flex items-center justify-center border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute left-3 inline-flex size-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X className="size-5" />
          </button>
          <h2 id="new-conv-title" className="text-[15px] font-bold text-foreground">
            Nova conversa
          </h2>
        </header>

        <div className="px-4 py-3">
          <label htmlFor={`new-conv-search-${searchId}`} className="sr-only">
            Buscar usuário
          </label>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              id={`new-conv-search-${searchId}`}
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por nome ou @usuário..."
              autoComplete="off"
              className="w-full rounded-xl border border-border bg-surface-subtle py-2.5 pr-3 pl-9 text-[14px] text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />
          </div>
          {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted">
              <Loader2 className="size-4 animate-spin" />
              Buscando…
            </p>
          ) : visibleResults.length === 0 && search.trim().length >= 2 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-[13px] text-muted">Nenhuma pessoa encontrada.</p>
            </div>
          ) : visibleResults.length > 0 ? (
            <ul className="space-y-0.5" role="list">
              {visibleResults.map((user) => (
                <li key={user.id}>
                  <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-subtle">
                    <Link
                      href={`/perfil/${encodeURIComponent(user.username)}` as Route}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <Avatar src={user.avatar} alt={user.name} name={user.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-foreground">{user.name}</span>
                        <span className="block truncate text-[12px] text-muted">@{user.username}</span>
                      </span>
                    </Link>
                    {!user.isMe && user.canMessage ? (
                      <button
                        type="button"
                        disabled={creating === user.username}
                        onClick={() => handleCreate(user.username)}
                        aria-label={`Iniciar conversa com ${user.name}`}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        {creating === user.username ? <Loader2 className="size-4 animate-spin" /> : 'Conversar'}
                      </button>
                    ) : (
                      <span className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-3 text-[12px] font-semibold text-muted">
                        {user.isMe ? 'Você' : 'Não pode conversar'}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-10 text-center text-[13px] text-muted">
              Digite ao menos 2 caracteres para buscar usuários.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}