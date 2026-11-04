'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Compass, Users, X } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Pill } from '@/components/ui/pill';
import { PostCard } from '@/components/posts/post-card';
import { SearchField } from '@/components/ui/search-field';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/api';
import type { ExploreResponse, ExplorePerson, ExploreTopic, Post } from '@/lib/types';

interface ExplorarViewProps {
  explore: ExploreResponse;
}

export function ExplorarView({ explore: initialExplore }: ExplorarViewProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const [explore, setExplore] = useState<ExploreResponse>(initialExplore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExplore = useCallback(async (q: string, t: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '12');
      if (q) params.set('q', q);
      if (t) params.set('topic', t);
      const data = await apiRequest<ExploreResponse>(`/api/explore?${params.toString()}`);
      setExplore(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o Explorar.');
    } finally {
      setLoading(false);
    }
  }, []);

  const isFirstRender = useRef(true);

  useEffect(() => {
    // Os dados iniciais já chegam renderizados pelo servidor; só buscamos
    // novamente quando o usuário muda a busca ou o tópico.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      fetchExplore(query, topic);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, topic, fetchExplore]);

  // A API pode devolver uma versão sem `topics`; o front nunca deve quebrar.
  const topics = explore.topics ?? [];
  const people = explore.people ?? [];
  const posts = explore.posts ?? [];

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">Explorar</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl">
            Descubra publicações, pessoas e tópicos
          </h1>
        </div>
        <div className="w-full shrink-0 sm:w-80">
          <SearchField
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar no Explorar…"
            label="Buscar publicações e pessoas"
          />
        </div>
      </header>

      {error ? (
        <ErrorState
          title="Falha ao carregar o Explorar"
          description={error}
          onRetry={() => fetchExplore(query, topic)}
          pending={loading}
        />
      ) : null}

      {/* Tópicos em alta */}
      {topics && topics.length > 0 ? (
        <section aria-label="Tópicos em alta" className="mb-6">
          <h2 className="sr-only">Tópicos em alta</h2>
          <div className="flex flex-wrap gap-2">
            {topics.map((item: ExploreTopic) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={topic === item.id}
                onClick={() => {
                  setTopic(item.id);
                  setQuery('');
                }}
                className={`flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  topic === item.id
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-border bg-surface text-muted hover:border-brand/30 hover:bg-brand-soft/30 hover:text-brand'
                }`}
              >
                <span>{item.label}</span>
                <span className="text-xs text-subtle">({item.count})</span>
              </button>
            ))}
            {topic ? (
              <button
                type="button"
                onClick={() => {
                  setTopic(null);
                  setQuery('');
                }}
                className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-muted hover:border-brand/30 hover:bg-brand-soft/30 hover:text-brand"
              >
                <span>Limpar filtro</span>
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Publicações */}
      <section aria-label="Publicações do Explorar" className="mb-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-live="polite">
            {Array.from({ length: 6 }).map((_, index) => (
              <article key={index} className="post-card overflow-hidden rounded-card border border-border bg-surface animate-pulse">
                <Skeleton className="aspect-video w-full" label="Mídia" />
                <div className="space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-10 rounded-full" label="Reação" />
                    <Skeleton className="size-10 rounded-full" label="Reação" />
                    <Skeleton className="size-10 rounded-full" label="Reação" />
                    <Skeleton className="size-10 rounded-full" label="Reação" />
                  </div>
                  <Skeleton className="h-4 w-24 rounded" label="Contador" />
                  <Skeleton className="h-4 w-3/4 rounded" label="Legenda" />
                  <Skeleton className="h-4 w-1/2 rounded" label="Legenda" />
                </div>
              </article>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<Compass className="size-5" />}
            title="Nenhuma publicação encontrada"
            description={
              topic || query
                ? 'Tente outro termo de busca ou remova o filtro de tópico.'
                : 'Ainda não há publicações públicas visíveis para a sua conta.'
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post: Post) => (
              <PostCard
                key={post.id}
                post={post}
                onOpen={() =>
                  router.push(`/perfil/${encodeURIComponent(post.user.username)}` as Route)
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Pessoas para seguir */}
      {people.length > 0 ? (
        <section aria-label="Pessoas para seguir" className="mb-6">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <Users className="size-5" aria-hidden="true" />
              Pessoas para você
            </h2>
            <span className="text-sm text-muted">
              {people.length} resultado{people.length > 1 ? 's' : ''}
            </span>
          </header>
          <ul className="space-y-3" role="list">
            {people.map((person: ExplorePerson) => (
              <li key={person.id}>
                <Link
                  href={`/perfil/${encodeURIComponent(person.username)}` as Route}
                  className="flex min-w-0 items-center gap-3 rounded-card border border-border bg-surface p-3 transition-colors hover:border-brand/30 hover:bg-surface-subtle"
                >
                  <Avatar src={person.avatar} alt={person.name} name={person.name} size="md" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-foreground">{person.name}</strong>
                    <span className="block truncate text-xs text-muted">@{person.username}</span>
                    {person.sharedInterests.length > 0 ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {person.sharedInterests.slice(0, 3).map((interest) => (
                          <Pill key={interest} tone="brand" className="text-xs">
                            {interest}
                          </Pill>
                        ))}
                        {person.sharedInterests.length > 3 ? (
                          <span className="text-xs text-muted">
                            +{person.sharedInterests.length - 3}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {person.followers} seguidor{person.followers > 1 ? 'es' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}