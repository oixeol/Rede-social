'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import {
  ArrowRight,
  Award,
  CalendarDays,
  Camera,
  Check,
  Compass,
  Heart,
  Image as ImageIcon,
  Info,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';

import { VerifiedBadge } from '@/components/profile/profile-center';
import { Avatar } from '@/components/ui/avatar';
import { Waves } from '@/components/ui/waves';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { ProfileHighlight, ProfileViewModel } from '@/lib/profile-view-model';
import type { Badge } from '@/lib/types';
import { INTERESTS } from '@/lib/interests';
import { HIGHLIGHT_ICONS, HighlightIcon } from '@/components/profile/highlight-icons';
import { highlightIconFor } from '@/lib/profile-view-model';

const BADGE_ICONS: Record<string, React.ReactNode> = {
  camera: <Camera className="size-[18px]" />,
  image: <ImageIcon className="size-[18px]" />,
  spark: <Sparkles className="size-[18px]" />,
  users: <Users className="size-[18px]" />,
  heart: <Heart className="size-[18px]" />,
  compass: <Compass className="size-[18px]" />,
  message: <MessageCircle className="size-[18px]" />,
  shield: <Shield className="size-[18px]" />,
  check: <Check className="size-[18px]" />,
};

export function AboutCard({ profile }: { profile: ProfileViewModel }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
      <Waves className="-right-10 -bottom-6 h-[130px] w-[260px]" opacity={0.45} />

      <header className="relative flex items-center gap-2">
        <h2 className="text-[15px] font-bold text-foreground">Sobre mim</h2>
        <Info aria-hidden="true" className="size-4 text-muted" />
      </header>

      <ul className="relative mt-4 space-y-2.5">
        {profile.about.joined ? (
          <li className="flex items-center gap-2.5 text-[13px] text-muted">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
            {profile.about.joined}
          </li>
        ) : null}
        {profile.about.country ? (
          <li className="flex items-center gap-2.5 text-[13px] text-muted">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            {profile.about.country}
          </li>
        ) : null}
        <li className="flex items-center gap-2.5 text-[13px] text-muted">
          <Sparkles aria-hidden="true" className="size-4 shrink-0 text-brand" />
          <span>{profile.about.points}</span>
          <span className="text-muted/60">Pontos</span>
        </li>
      </ul>
    </section>
  );
}

/**
 * Insígnias conquistadas pelo perfil. Renderiza apenas quando há ao menos uma.
 */
export function BadgesCard({ badges }: { badges: Badge[] }) {
  const [openBadgeId, setOpenBadgeId] = useState<string | null>(null);

  if (badges.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <header className="flex items-center gap-2">
        <h2 className="text-[15px] font-bold text-foreground">Insígnias</h2>
        <Award aria-hidden="true" className="size-4 text-muted" />
      </header>

      <ul className="mt-4 grid grid-cols-3 gap-3" role="list">
        {badges.map((badge) => {
          const tooltipId = `badge-tooltip-${badge.id}`;
          const isOpen = openBadgeId === badge.id;

          return (
            <li key={badge.id} className="relative flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenBadgeId(isOpen ? null : badge.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpenBadgeId(null);
                }}
                aria-describedby={tooltipId}
                aria-expanded={isOpen}
                className="group relative flex size-[52px] items-center justify-center rounded-full border-2 border-brand bg-surface-raised text-brand transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {BADGE_ICONS[badge.icon] ?? <Award className="size-[18px]" />}
                <span
                  id={tooltipId}
                  role="tooltip"
                  className={cn(
                    'pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max min-w-[160px] max-w-[240px] translate-x-[-50%] rounded-lg border border-border bg-foreground px-3 py-2 text-center text-[11px] leading-4 whitespace-normal text-background shadow-lg transition-opacity duration-150',
                    isOpen
                      ? 'visible opacity-100'
                      : 'invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100',
                  )}
                >
                  {badge.description}
                </span>
              </button>
              <span className="max-w-full truncate text-center text-[11px] leading-4 text-muted">
                {badge.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function HighlightsCard({ profile }: { profile: ProfileViewModel }) {
  const isOwnProfile = profile.isMe;
  const [editing, setEditing] = useState(false);
  const [highlights, setHighlights] = useState(profile.highlights);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const availableInterests = INTERESTS.filter(
    (i) => !highlights.some((h) => h.id === i.id),
  );

  const filteredInterests = availableInterests.filter((i) =>
    i.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.group.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  async function saveHighlights() {
    try {
      await apiRequest('/api/me', {
        method: 'PATCH',
        body: { interests: highlights.map((h) => h.id) },
      });
      setEditing(false);
    } catch {
      // Error handling - could add toast
    }
  }

  function handleAddInterest(interestId: string) {
    const interest = INTERESTS.find((i) => i.id === interestId);
    if (!interest) return;
    const icon = highlightIconFor(interest.id);
    setHighlights((prev) => [
      ...prev,
      { id: interest.id, label: interest.label, icon },
    ]);
    setSelectedInterests((prev) => prev.filter((id) => id !== interestId));
  }

  function handleRemoveHighlight(highlightId: string) {
    setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
  }

  function handleToggleSelect(interestId: string) {
    setSelectedInterests((prev) =>
      prev.includes(interestId)
        ? prev.filter((id) => id !== interestId)
        : [...prev, interestId],
    );
  }

  function handleAddSelected() {
    selectedInterests.forEach((id) => handleAddInterest(id));
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <header className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">Destaques</h2>
        {isOwnProfile ? (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-subtle"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveHighlights}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--vibra-brand-fill)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--vibra-brand-fill-hover)]"
                >
                  Salvar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--vibra-brand-fill)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--vibra-brand-fill-hover)]"
              >
                <Plus aria-hidden="true" className="size-4" />
                Adicionar
              </button>
            )}
          </div>
        ) : profile.highlights.length > 0 ? (
          <Link
            href={'/explorar' as Route}
            className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
          >
            Ver todos
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : null}
      </header>

      {editing ? (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="highlight-search" className="sr-only">
              Buscar interesses
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" aria-hidden="true" />
              <input
                id="highlight-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar interesses…"
                className="w-full min-h-11 rounded-xl border border-border bg-background px-10 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2" role="list" aria-label="Destaques atuais">
            {highlights.map((highlight) => (
              <li key={highlight.id} className="relative group flex flex-col items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex size-[60px] items-center justify-center rounded-full border-2 border-brand bg-surface-raised text-brand"
                >
                  <HighlightIcon icon={highlight.icon} />
                </span>
                <span className="max-w-full truncate text-center text-[11px] leading-4 text-muted">
                  {highlight.label}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveHighlight(highlight.id)}
                  aria-label={`Remover destaque ${highlight.label}`}
                  className="absolute -top-2 -right-2 inline-flex size-7 items-center justify-center rounded-full bg-danger/90 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
            {highlights.length < 12 && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Adicionar destaque"
                className="flex flex-col items-center gap-2 rounded-full border-2 border-dashed border-border-strong bg-surface-raised p-4 text-brand transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Plus aria-hidden="true" className="size-6" />
                <span className="text-[11px] leading-4 text-center">Adicionar</span>
              </button>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface-raised p-4 max-h-64 overflow-y-auto">
            <p className="mb-3 text-xs font-semibold text-muted uppercase tracking-wide">
              Interesses disponíveis
            </p>
            <div className="space-y-3">
              {Object.entries(
                filteredInterests.reduce((acc, interest) => {
                  const group = interest.group || 'Outros';
                  if (!acc[group]) acc[group] = [];
                  acc[group].push(interest);
                  return acc;
                }, {} as Record<string, typeof INTERESTS[number][]>),
              ).map(([group, interests]) => (
                <div key={group} className="space-y-2">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide px-1">
                    {group}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {interests.map((interest) => (
                      <label
                        key={interest.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-subtle cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedInterests.includes(interest.id)}
                          onChange={() => handleToggleSelect(interest.id)}
                          className="size-4 rounded border-border text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          aria-label={`Adicionar ${interest.label}`}
                        />
                        <span>{interest.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedInterests.length > 0 && (
            <button
              type="button"
              onClick={handleAddSelected}
              className="w-full min-h-11 rounded-xl bg-[var(--vibra-brand-fill)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--vibra-brand-fill-hover)]"
            >
              Adicionar {selectedInterests.length} selecionado{selectedInterests.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      ) : highlights.length > 0 ? (
        <ul className="mt-4 grid grid-cols-4 gap-2" role="list">
          {highlights.map((highlight) => (
            <li key={highlight.id} className="flex flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className="flex size-[60px] items-center justify-center rounded-full border-2 border-brand bg-surface-raised text-brand"
              >
                <HighlightIcon icon={highlight.icon} />
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
                      : 'bg-[var(--vibra-brand-fill)] text-white hover:bg-[var(--vibra-brand-fill-hover)]',
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
