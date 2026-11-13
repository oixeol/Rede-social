'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { useMemo } from 'react';
import { Compass, Crown, Hash, Heart, ImageIcon, MessageSquare, Users } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { isSafeMediaSource } from '@/lib/media';
import type { Post, Space } from '@/lib/types';

interface InicioRailProps {
  recommendations: Post[];
  spaces: Space[];
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')} mi`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.0', '')} mil`;
  return String(value);
}

function getMediaPreview(post: Post): { url: string; mediaType: 'image' | 'video' } | null {
  const media = post.media?.find(
    (item) => item.mediaType === 'image' || item.mediaType === 'video',
  );
  const candidate = media?.url || post.image;
  if (!candidate || !isSafeMediaSource(candidate)) return null;
  const mediaType = media?.mediaType === 'video' || post.mediaType === 'video' ? 'video' : 'image';
  return { url: candidate, mediaType };
}

function recommendationTitle(post: Post): string {
  const caption = post.caption.trim();
  if (!caption) return `Publicação de ${post.user.name}`;
  const withoutTags = caption.replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\s+/g, ' ').trim();
  return withoutTags || `Publicação de ${post.user.name}`;
}

export function InicioRail({ recommendations, spaces }: { recommendations: Post[]; spaces: Space[] }) {
  const rankedRecommendations = useMemo(
    () =>
      recommendations
        .filter((post) => getMediaPreview(post) !== null)
        .sort(
          (a, b) =>
            b.likes * 3 + b.comments * 2 + b.shares - (a.likes * 3 + a.comments * 2 + a.shares) ||
            b.createdAt - a.createdAt,
        )
        .slice(0, 2),
    [recommendations],
  );

  return (
    <aside className="w-full space-y-5 xl:sticky xl:top-[calc(4rem+4px)]" aria-label="Recomendações e servidores">
      <Card className="p-4">
        <header className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <Hash className="size-5 text-brand" aria-hidden="true" />
            Meus servidores
          </h2>
          <Link
            href="/mensagens"
            className="text-xs font-medium text-brand hover:underline"
          >
            Ver todos
          </Link>
        </header>
        {spaces.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="Nenhum servidor"
            description="Você ainda não participa de nenhum servidor."
          />
        ) : (
          <ul className="mt-3 space-y-2" role="list">
            {spaces.slice(0, 5).map((space) => (
              <li key={space.id}>
                <Link
                  href={`/mensagens?espaco=${space.id}` as Route}
                  className="flex items-center justify-between rounded-xl p-2.5 transition-colors hover:bg-surface-subtle"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand font-bold text-xs">
                      {space.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-semibold text-foreground">{space.name}</strong>
                      <span className="block truncate text-xs text-muted">{space.memberCount} membro{space.memberCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-display text-lg font-semibold text-foreground">Recomendados para você</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Publicações reais priorizadas por curtidas, comentários e compartilhamentos.
        </p>
        {rankedRecommendations.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="size-5" />}
            title="Nenhuma recomendação"
            description="Publique ou siga mais creators para receber publicações relacionadas."
          />
        ) : (
          <ol className="mt-3 space-y-2" role="list">
            {rankedRecommendations.map((post) => {
              const preview = getMediaPreview(post);
              const title = recommendationTitle(post);
              return (
                <li key={post.id}>
                  <Link
                    href={`/publicacoes/${post.id}` as Route}
                    className="group grid grid-cols-[68px_minmax(0,1fr)] gap-3 rounded-2xl p-2 transition-colors hover:bg-surface-subtle"
                  >
                    <span className="relative aspect-[9/16] overflow-hidden rounded-xl bg-background-secondary">
                      {preview?.mediaType === 'video' ? (
                        <video
                          src={preview.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="size-full object-cover"
                          aria-label={`Miniatura de ${title}`}
                        />
                      ) : preview ? (
                        <Image
                          src={preview.url}
                          alt={`Miniatura de ${title}`}
                          fill
                          sizes="68px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 self-center">
                      <span className="line-clamp-2 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-brand">
                        {title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">@{post.user.username}</span>
                      <span className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
                        <span className="inline-flex items-center gap-1"><Heart className="size-3" /> {formatCount(post.likes)}</span>
                        <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" /> {formatCount(post.comments)}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </aside>
  );
}
