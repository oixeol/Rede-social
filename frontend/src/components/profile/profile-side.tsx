'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Crown,
  Gamepad2,
  Info,
  Music,
  Plane,
} from 'lucide-react';

import { VerifiedBadge } from '@/components/profile/profile-center';
import { Avatar } from '@/components/ui/avatar';
import { Waves } from '@/components/ui/waves';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { ProfileHighlight, ProfileViewModel } from '@/lib/profile-view-model';

const HIGHLIGHT_ICONS: Record<ProfileHighlight['icon'], React.ReactNode> = {
  crown: <Crown className="size-[18px]" />,
  gamepad: <Gamepad2 className="size-[18px]" />,
  music: <Music className="size-[18px]" />,
  plane: <Plane className="size-[18px]" />,
};

export function AboutCard({ profile }: { profile: ProfileViewModel }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
      <Waves className="-right-10 -bottom-6 h-[130px] w-[260px]" opacity={0.45} />

      <header className="relative flex items-center gap-2">
        <h2 className="text-[15px] font-bold text-foreground">Sobre mim</h2>
        <Info aria-hidden="true" className="size-4 text-muted" />
      </header>

      {profile.about.bio ? (
        <p className="relative mt-3 text-[13px] leading-5 text-muted">{profile.about.bio}</p>
      ) : (
        <p className="relative mt-3 text-[13px] leading-5 text-muted">
          Este perfil ainda não adicionou uma bio.
        </p>
      )}

      {profile.about.joined ? (
        <ul className="relative mt-4 space-y-2.5">
          <li className="flex items-center gap-2.5 text-[13px] text-muted">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
            {profile.about.joined}
          </li>
        </ul>
      ) : null}
    </section>
  );
}

export function HighlightsCard({ profile }: { profile: ProfileViewModel }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <header className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">Destaques</h2>
        {profile.highlights.length > 0 ? (
          <Link
            href={'/explorar' as Route}
            className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
          >
            Ver todos
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : null}
      </header>

      {profile.highlights.length > 0 ? (
        <ul className="mt-4 grid grid-cols-4 gap-2" role="list">
          {profile.highlights.map((highlight) => (
            <li key={highlight.id} className="flex flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className="flex size-[60px] items-center justify-center rounded-full border-2 border-brand bg-surface-raised text-brand"
              >
                {HIGHLIGHT_ICONS[highlight.icon]}
              </span>
              <span className="max-w-full truncate text-center text-[11px] leading-4 text-muted">
                {highlight.label}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 flex min-h-[88px] items-center justify-center rounded-xl border border-dashed border-border-strong px-4 text-center text-xs leading-5 text-muted">
          Nenhum destaque publicado.
        </div>
      )}
    </section>
  );
}

interface FollowResponse {
  isFollowing: boolean;
  requested: boolean;
}

export function SuggestionsCard({ profile }: { profile: ProfileViewModel }) {
  const [states, setStates] = useState<Record<string, FollowResponse>>(() =>
    Object.fromEntries(
      profile.suggestions.map((suggestion) => [
        suggestion.id,
        {
          isFollowing: suggestion.isFollowing,
          requested: suggestion.followRequested,
        },
      ]),
    ),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFollow(id: string, username: string) {
    if (pendingId) return;

    const previous = states[id];
    if (!previous) return;

    setPendingId(id);
    setMessage(null);
    setStates((current) => ({
      ...current,
      [id]: {
        isFollowing: !previous.isFollowing,
        requested: previous.isFollowing ? previous.requested : false,
      },
    }));

    try {
      const response = await apiRequest<FollowResponse>(
        `/api/users/${encodeURIComponent(username)}/follow`,
        { method: 'POST' },
      );
      setStates((current) => ({
        ...current,
        [id]: {
          isFollowing: response.isFollowing,
          requested: response.requested,
        },
      }));
    } catch {
      setStates((current) => ({ ...current, [id]: previous }));
      setMessage('Não foi possível atualizar o follow.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <header className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">Sugestões para você</h2>
        <Link
          href={'/explorar' as Route}
          className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
        >
          Ver todos
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </header>

      {profile.suggestions.length > 0 ? (
        <ul className="mt-4 space-y-3.5" role="list">
          {profile.suggestions.map((suggestion) => {
            const state = states[suggestion.id];
            const isFollowing = state?.isFollowing ?? suggestion.isFollowing;
            const isRequested = state?.requested ?? suggestion.followRequested;
            const isPending = pendingId === suggestion.id;

            return (
              <li key={suggestion.id} className="flex items-center gap-3">
                <Link
                  href={`/perfil/${encodeURIComponent(suggestion.username)}` as Route}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  aria-label={`Abrir perfil de ${suggestion.name}`}
                >
                  <Avatar
                    src={suggestion.avatar}
                    alt={suggestion.alt}
                    name={suggestion.name}
                    size="md"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-[13px] font-bold text-foreground">
                    {suggestion.name}
                    {suggestion.verified ? <VerifiedBadge className="size-4 shrink-0" /> : null}
                  </p>
                  <p className="truncate text-[12px] text-muted">{suggestion.reason}</p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleFollow(suggestion.id, suggestion.username)}
                  disabled={isPending}
                  aria-label={`${isFollowing || isRequested ? 'Deixar de seguir' : 'Seguir'} ${suggestion.name}`}
                  className={cn(
                    'min-h-11 shrink-0 rounded-pill px-4 text-[12px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    isFollowing || isRequested
                      ? 'bg-surface-subtle text-muted'
                      : 'bg-[var(--vibra-follow-bg)] text-[var(--vibra-follow-text)] hover:brightness-95',
                  )}
                >
                  {isRequested ? 'Solicitado' : isFollowing ? 'Seguindo' : 'Seguir'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4 flex min-h-[88px] items-center justify-center rounded-xl border border-dashed border-border-strong px-4 text-center text-xs leading-5 text-muted">
          Nenhuma sugestão disponível.
        </div>
      )}

      {message ? (
        <p className="mt-3 text-xs leading-5 text-danger" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
