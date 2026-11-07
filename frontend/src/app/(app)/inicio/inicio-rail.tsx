'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState, useEffect } from 'react';
import { Compass, Users, Sparkles, Info, ExternalLink } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/api';
import type { SuggestionUser, ExploreTopic } from '@/lib/types';

interface InicioRailProps {
  suggestions: SuggestionUser[];
}

export function InicioRail({ suggestions: initialSuggestions }: InicioRailProps) {
  const [suggestions, setSuggestions] = useState<SuggestionUser[]>(initialSuggestions);
  const [trending, setTrending] = useState<ExploreTopic[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchTrending() {
      try {
        const res = await apiRequest<{ topics: ExploreTopic[] }>('/api/explore?limit=10');
        if (!active) return;
        setTrending(res.topics.slice(0, 5));
      } catch {
        /* silencioso */
      } finally {
        if (active) setLoadingTrending(false);
      }
    }
    fetchTrending();
    return () => { active = false; };
  }, []);

  async function handleFollow(username: string, currentlyFollowing: boolean) {
    try {
      const res = await apiRequest<{
        isFollowing: boolean;
        requested: boolean;
        cancelled: boolean;
        isPrivate: boolean;
        stats: { followers: number };
      }>(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'POST' });
      setSuggestions((prev) =>
        prev.map((u) =>
          u.username === username
            ? { ...u, isFollowing: res.isFollowing, followRequested: res.requested, followers: res.stats.followers }
            : u,
        ),
      );
    } catch (err) {
      console.error('Erro ao seguir:', err);
    }
  }

  return (
    <aside className="hidden xl:block w-full max-w-xs sticky top-20 space-y-5" aria-label="Painel lateral">
      {/* Sugestões para seguir */}
      <Card className="p-4 space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">Quem seguir</h2>
          <a
            href="/explorar"
            className="text-xs font-medium text-brand hover:underline flex items-center gap-1"
            aria-label="Ver todas as sugestões"
          >
            Ver tudo
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </header>
        {suggestions.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="Você já segue todo mundo"
            description="Não há sugestões no momento."
          />
        ) : (
          <ul className="space-y-3" role="list">
            {suggestions.slice(0, 5).map((user) => (
              <li key={user.id} className="flex items-center gap-3">
                <Link
                  href={`/perfil/${encodeURIComponent(user.username)}` as Route}
                  className="flex items-center gap-2 shrink-0"
                  aria-label={`Perfil de ${user.name}`}
                >
                  <Avatar src={user.avatar} alt={user.name} name={user.name} size="sm" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/perfil/${encodeURIComponent(user.username)}` as Route}
                    className="flex items-center gap-1 truncate"
                  >
                    <strong className="text-foreground truncate block">{user.name}</strong>
                    <span className="text-xs text-muted truncate block">@{user.username}</span>
                  </Link>
                  {user.sharedInterests.length && (
                    <p className="text-xs text-muted truncate mt-0.5">
                      {user.sharedInterests.slice(0, 3).map((i) => `#${i}`).join(' · ')}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={user.isFollowing || user.followRequested ? 'secondary' : 'primary'}
                  onClick={() => handleFollow(user.username, user.isFollowing)}
                  disabled={user.isFollowing}
                >
                  {user.followRequested ? 'Solicitado' : user.isFollowing ? 'Seguindo' : 'Seguir'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Assuntos em alta */}
      <Card className="p-4 space-y-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Sparkles className="size-5 text-brand" aria-hidden="true" />
          Assuntos em alta
        </h2>
        {loadingTrending ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-pill" label="Assunto" />
          ))
        ) : trending.length === 0 ? (
          <EmptyState icon={<Compass className="size-5" />} title="Sem assuntos no momento" description="Volte mais tarde para ver o que está em alta." />
        ) : (
          <ul className="space-y-2" role="list">
            {trending.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={`/explorar?topic=${encodeURIComponent(topic.id)}` as Route}
                  className="flex items-center justify-between px-2 py-1.5 rounded-xl text-sm transition-colors hover:bg-surface-subtle"
                >
                  <span className="truncate font-medium text-foreground">#{topic.label}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted">{topic.count} {topic.count === 1 ? 'publicação' : 'publicações'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Sobre o Vibra */}
      <Card className="p-4 space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <Info className="size-5 text-brand" aria-hidden="true" />
          Sobre o Vibra
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          O Vibra é uma rede social brasileira focada em comunidades, conversas autênticas e descoberta de interesses.
          Sem algoritmos invasivos, sem anúncios, só pessoas.
        </p>
        <p className="text-xs leading-5 text-muted">
          Políticas, termos e diretrizes da comunidade ainda não estão publicados.
        </p>
      </Card>
    </aside>
  );
}