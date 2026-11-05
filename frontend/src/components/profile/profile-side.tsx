'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Crown,
  Gamepad2,
  Info,
  Link as LinkIcon,
  MapPin,
  Music,
  Plane,
} from 'lucide-react';

import { VerifiedBadge } from '@/components/profile/profile-center';
import { Waves } from '@/components/ui/waves';
import type { MockProfile, ProfileHighlight } from '@/lib/profile-mock';
import { cn } from '@/lib/cn';

/**
 * Coluna direita da tela de PERFIL (referência):
 * 1. Card "Sobre mim" — info, linhas Brasil / Entrou em 2026 / vibra.app + ondas
 * 2. Card "Destaques" — 4 círculos com anel laranja + Ver todos →
 * 3. Card "Sugestões para você" — 3 linhas + botão "Seguir"
 */

const HIGHLIGHT_ICONS: Record<ProfileHighlight['icon'], React.ReactNode> = {
  crown: <Crown className="size-[18px]" />,
  gamepad: <Gamepad2 className="size-[18px]" />,
  music: <Music className="size-[18px]" />,
  plane: <Plane className="size-[18px]" />,
};

export function AboutCard({ profile }: { profile: MockProfile }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
      <Waves className="-right-10 -bottom-6 h-[130px] w-[260px]" opacity={0.45} />

      <header className="relative flex items-center gap-2">
        <h2 className="text-[15px] font-bold text-foreground">Sobre mim</h2>
        <Info aria-hidden="true" className="size-4 text-muted" />
      </header>

      <ul className="relative mt-4 space-y-2.5">
        <li className="flex items-center gap-2.5 text-[13px] text-muted">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          {profile.about.location}
        </li>
        <li className="flex items-center gap-2.5 text-[13px] text-muted">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          {profile.about.joined}
        </li>
        <li className="flex items-center gap-2.5 text-[13px] text-muted">
          <LinkIcon aria-hidden="true" className="size-4 shrink-0" />
          <a
            href={`https://${profile.about.link}`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-brand hover:underline"
          >
            {profile.about.link}
          </a>
        </li>
      </ul>
    </section>
  );
}

export function HighlightsCard({ profile }: { profile: MockProfile }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <header className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">Destaques</h2>
        <a
          href="#destaques"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
        >
          Ver todos
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </a>
      </header>

      <ul className="mt-4 grid grid-cols-4 gap-2" role="list">
        {profile.highlights.map((highlight) => (
          <li key={highlight.id} className="flex flex-col items-center gap-2">
            <button
              type="button"
              aria-label={`Destaque ${highlight.label}`}
              className="flex size-[60px] items-center justify-center rounded-full border-2 border-brand bg-surface-raised text-brand transition-colors hover:bg-brand-soft"
            >
              {HIGHLIGHT_ICONS[highlight.icon]}
            </button>
            <span className="text-center text-[11px] leading-4 text-muted">{highlight.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SuggestionsCard({ profile }: { profile: MockProfile }) {
  const [followed, setFollowed] = useState<string[]>([]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <header className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">Sugestões para você</h2>
        <a
          href="#sugestoes"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
        >
          Ver todos
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </a>
      </header>

      <ul className="mt-4 space-y-3.5" role="list">
        {profile.suggestions.map((suggestion) => {
          const isFollowing = followed.includes(suggestion.id);
          return (
            <li key={suggestion.id} className="flex items-center gap-3">
              <span className="shrink-0">
                <Image
                  src={suggestion.avatar}
                  alt={suggestion.alt}
                  width={40}
                  height={40}
                  unoptimized
                  className="size-10 rounded-full object-cover"
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-[13px] font-bold text-foreground">
                  {suggestion.name}
                  {suggestion.verified ? <VerifiedBadge className="size-4 shrink-0" /> : null}
                </p>
                <p className="truncate text-[12px] text-muted">{suggestion.reason}</p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setFollowed((current) =>
                    current.includes(suggestion.id)
                      ? current.filter((id) => id !== suggestion.id)
                      : [...current, suggestion.id],
                  )
                }
                className={cn(
                  'shrink-0 rounded-pill px-4 py-1.5 text-[12px] font-bold transition-colors',
                  isFollowing
                    ? 'bg-surface-subtle text-muted'
                    : 'bg-[var(--vibra-follow-bg)] text-[var(--vibra-follow-text)] hover:brightness-95',
                )}
              >
                {isFollowing ? 'Seguindo' : 'Seguir'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
