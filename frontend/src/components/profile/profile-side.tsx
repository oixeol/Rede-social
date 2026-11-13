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
  Crown,
  Heart,
  Image as ImageIcon,
  Info,
  MapPin,
  MessageCircle,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';

import { VerifiedBadge } from '@/components/profile/profile-center';
import { Avatar, initials } from '@/components/ui/avatar';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { ProfileViewModel } from '@/lib/profile-view-model';
import type { Badge, ProfileHighlight, ProfileHighlightIcon } from '@/lib/types';
import {
  HIGHLIGHT_ICON_LABELS,
  HIGHLIGHT_ICON_OPTIONS,
  HIGHLIGHT_ICONS,
  HighlightIcon,
} from '@/components/profile/highlight-icons';

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
      <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-transparent pointer-events-none" />
      <header className="relative flex items-center gap-2">
        <h2 className="text-[15px] font-bold text-foreground">Sobre mim</h2>
        <Info aria-hidden="true" className="size-4 text-muted" />
      </header>

      <ul className="relative mt-4 space-y-3">
        {profile.about.joined ? (
          <li className="flex items-center gap-2.5 text-[13px] text-muted">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-brand/60" />
            {profile.about.joined}
          </li>
        ) : null}
        {profile.about.country ? (
          <li className="flex items-center gap-2.5 text-[13px] text-muted">
            <MapPin aria-hidden="true" className="size-4 shrink-0 text-brand/60" />
            {profile.about.country}
          </li>
        ) : null}
        <li className="flex items-center gap-2.5 text-[13px] text-muted">
          <Sparkles aria-hidden="true" className="size-4 shrink-0 text-brand" />
          <span>{profile.about.points}</span>
          <span className="text-muted">Pontos</span>
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
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
      <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-transparent pointer-events-none" />
      <header className="relative flex items-center gap-2">
        <h2 className="text-[15px] font-bold text-foreground">Insígnias</h2>
        <Award aria-hidden="true" className="size-4 text-brand/60" />
      </header>

      <ul className="relative mt-4 grid grid-cols-3 gap-3" role="list">
        {badges.map((badge) => {
          const tooltipId = `badge-tooltip-${badge.id}`;
          const isOpen = openBadgeId === badge.id;

          return (
            <li key={badge.id} className="relative flex flex-col items-center gap-2 group">
              <button
                type="button"
                onClick={() => setOpenBadgeId(isOpen ? null : badge.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpenBadgeId(null);
                }}
                aria-label={badge.label}
                aria-describedby={tooltipId}
                aria-expanded={isOpen}
                className="group relative flex size-[52px] items-center justify-center rounded-full border-2 border-brand bg-surface-raised text-brand transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgb(from_var(--orbit-brand)_r_g_b_/_0.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
              <span className="max-w-full truncate text-center text-[11px] leading-4 text-muted group-hover:text-brand/80 transition-colors">
                {badge.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const MAX_HIGHLIGHTS = 12;
const MAX_HIGHLIGHT_LABEL = 24;

/**
 * Card de upsell do Orbit Premium — exibido apenas para usuários não-premium.
 * Props: compact = versão menor para sidebar (padrão: false)
 */
export function PremiumUpsellCard({
  isOwnProfile,
  compact = false,
}: { isOwnProfile: boolean; compact?: boolean }) {
  if (!isOwnProfile) return null;

  if (compact) {
    return (
      <Link
        href={'/orbit-premium' as Route}
        className="group relative block overflow-hidden rounded-xl border border-border bg-surface p-3 transition-all hover:border-brand/30 hover:shadow-[0_0_16px_rgb(from_var(--orbit-brand)_r_g_b_/_0.15)]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-brand/5 pointer-events-none" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand via-brand-hover to-brand shadow-[0_0_12px_rgb(from_var(--orbit-brand)_r_g_b_/_0.3)]">
              <Crown className="size-4 text-on-brand" aria-hidden="true" />
            </div>
            <h2 className="truncate text-[13px] font-bold text-foreground group-hover:text-brand transition-colors">
              Orbit Premium
            </h2>
          </div>
          <ArrowRight className="size-4 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
      </Link>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
      <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-brand/5 pointer-events-none" />
      <div className="relative space-y-4">
        <div className="flex items-start gap-3">
          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand via-brand-hover to-brand">
            <Crown className="size-6 text-on-brand" aria-hidden="true" />
            <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand via-brand-hover to-brand opacity-0 hover:opacity-100 transition-opacity duration-300 animate-pulse-slow" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="text-[15px] font-bold text-foreground">Orbit Premium</h2>
            <p className="mt-1 text-[13px] text-muted">
              Desbloqueie temas personalizados, badge exclusivo e mais.
            </p>
          </div>
        </div>

        <ul className="space-y-2 text-[13px] text-muted" role="list">
          <li className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-brand/60" aria-hidden="true" />
            Paletas de cores personalizadas
          </li>
          <li className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-brand/60" aria-hidden="true" />
            Badge Premium no perfil
          </li>
          <li className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-brand/60" aria-hidden="true" />
            Suporte prioritário
          </li>
        </ul>

        <Link
          href={'/orbit-premium' as Route}
          className="relative inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand via-brand-hover to-brand px-4 py-3 text-[13px] font-bold text-on-brand transition-all duration-200 hover:shadow-[0_0_20px_rgb(from_var(--orbit-brand)_r_g_b_/_0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand overflow-hidden"
        >
          <span className="relative z-10">Assinar Orbit Premium</span>
          <ArrowRight className="size-4 shrink-0 relative z-10" aria-hidden="true" />
          <span className="absolute inset-0 bg-gradient-to-r from-brand via-brand-hover to-brand opacity-0 hover:opacity-100 transition-opacity duration-300" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

interface HighlightsResponse {
  user: { highlights: ProfileHighlight[] };
}

/**
 * Card de destaques do perfil.
 *
 * Destaques são livres: não vêm de um catálogo de interesses. O usuário escolhe
 * o nome e o ícone de cada um. A lista inteira é persistida via PATCH /api/me.
 */
export function HighlightsCard({ profile }: { profile: ProfileViewModel }) {
  const isOwnProfile = profile.isMe;
  const [highlights, setHighlights] = useState<ProfileHighlight[]>(profile.highlights);
  const [formOpen, setFormOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState<ProfileHighlightIcon>('sparkles');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function persist(next: ProfileHighlight[]): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    try {
      const response = await apiRequest<HighlightsResponse>('/api/me', {
        method: 'PATCH',
        body: {
          highlights: next.map((highlight) => ({
            id: highlight.id,
            label: highlight.label,
            icon: highlight.icon,
          })),
        },
      });
      setHighlights(response.user.highlights);
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Não foi possível salvar os destaques.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openForm() {
    setLabel('');
    setIcon('sparkles');
    setMessage(null);
    setFormOpen(true);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    if (highlights.length >= MAX_HIGHLIGHTS) {
      setMessage(`Máximo de ${MAX_HIGHLIGHTS} destaques.`);
      return;
    }

    const next: ProfileHighlight[] = [
      ...highlights,
      { id: `hl-${Date.now().toString(36)}`, label: trimmed, icon },
    ];
    const saved = await persist(next);
    if (saved) {
      setFormOpen(false);
      setLabel('');
    }
  }

  async function handleRemove(highlightId: string) {
    const next = highlights.filter((highlight) => highlight.id !== highlightId);
    await persist(next);
  }

  const canCreate = formOpen && label.trim().length > 0 && highlights.length < MAX_HIGHLIGHTS;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
      <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-transparent pointer-events-none" />
      <header className="relative flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-foreground">Momentos</h2>
        {isOwnProfile ? (
          <button
            type="button"
            onClick={openForm}
            disabled={highlights.length >= MAX_HIGHLIGHTS}
            className="relative inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60 overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-brand via-brand-hover to-brand opacity-0 hover:opacity-100 transition-opacity duration-300" aria-hidden="true" />
            <span className="relative flex items-center gap-2">
              <Plus aria-hidden="true" className="size-4" />
              Adicionar
            </span>
          </button>
        ) : highlights.length > 0 ? (
          <Link
            href={'/explorar' as Route}
            className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
          >
            Ver todos
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : null}
      </header>

      {formOpen ? (
        <form onSubmit={handleCreate} className="relative mt-4 space-y-4 rounded-xl border border-border bg-surface-raised p-4">
          <div className="space-y-1.5">
            <label htmlFor="highlight-label" className="block text-[13px] font-semibold text-foreground">
              Nome do destaque
            </label>
            <input
              id="highlight-label"
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={MAX_HIGHLIGHT_LABEL}
              required
              autoFocus
              placeholder="Ex.: Viagens, Música, Receitas…"
              className="w-full min-h-11 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />
            <p className="text-xs text-muted">
              {label.trim().length}/{MAX_HIGHLIGHT_LABEL} caracteres
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-foreground">Ícone</legend>
            <div className="grid grid-cols-5 gap-2">
              {HIGHLIGHT_ICON_OPTIONS.map((option) => (
                <label key={option} className="cursor-pointer">
                  <input
                    type="radio"
                    name="highlight-icon"
                    value={option}
                    checked={icon === option}
                    onChange={() => setIcon(option)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-all duration-200 peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand hover:border-brand/30 hover:shadow-[0_0_8px_rgb(from_var(--orbit-brand)_r_g_b_/_0.2)]"
                  >
                    {HIGHLIGHT_ICONS[option]}
                  </span>
                  <span className="sr-only">{HIGHLIGHT_ICON_LABELS[option]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!canCreate || saving}
              className="relative inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60 overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-brand via-brand-hover to-brand opacity-0 hover:opacity-100 transition-opacity duration-300" aria-hidden="true" />
              <span className="relative flex items-center gap-2">
                <Plus aria-hidden="true" className="size-4" />
                {saving ? 'Salvando…' : 'Criar destaque'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-subtle"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {highlights.length > 0 ? (
        <ul className="relative mt-4 grid grid-cols-4 gap-2" role="list">
          {highlights.map((highlight) => (
            <li key={highlight.id} className="group relative flex flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className="relative flex size-[60px] items-center justify-center rounded-full border-2 border-brand bg-surface-raised text-brand transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgb(from_var(--orbit-brand)_r_g_b_/_0.4)] group-hover:border-brand-hover"
              >
                <HighlightIcon icon={highlight.icon} />
              </span>
              <span className="max-w-full truncate text-center text-[11px] leading-4 text-muted group-hover:text-brand/80 transition-colors">
                {highlight.label}
              </span>
              {isOwnProfile ? (
                <button
                  type="button"
                  onClick={() => void handleRemove(highlight.id)}
                  disabled={saving}
                  aria-label={`Remover destaque ${highlight.label}`}
                  className="absolute -top-1 -right-1 inline-flex size-6 items-center justify-center rounded-full bg-danger/90 text-white opacity-100 transition-opacity focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                >
                  <Trash2 aria-hidden="true" className="size-2.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="relative mt-4 flex min-h-[88px] items-center justify-center rounded-xl border border-dashed border-border-strong bg-gradient-to-br from-brand/5 via-transparent to-transparent px-4 text-center text-xs leading-5 text-muted">
          Nenhum destaque publicado.
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
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
      <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-transparent pointer-events-none" />
      <header className="relative flex items-center justify-between">
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
        <ul className="relative mt-4 space-y-3.5" role="list">
          {profile.suggestions.map((suggestion) => {
            const state = states[suggestion.id];
            const isFollowing = state?.isFollowing ?? suggestion.isFollowing;
            const isRequested = state?.requested ?? suggestion.followRequested;
            const isPending = pendingId === suggestion.id;

            return (
              <li key={suggestion.id} className="relative flex items-center gap-3 group">
                <Link
                  href={`/perfil/${encodeURIComponent(suggestion.username)}` as Route}
                  className="relative flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  aria-label={`${initials(suggestion.name)} — ${suggestion.name}`}
                >
                  <Avatar
                    src={suggestion.avatar}
                    alt={suggestion.alt}
                    name={suggestion.name}
                    size="md"
                  />
                  <span className="absolute inset-0 rounded-full border-2 border-brand opacity-0 group-hover:opacity-20 transition-opacity" aria-hidden="true" />
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-[13px] font-bold text-foreground group-hover:text-brand transition-colors">
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
                    'relative min-h-11 shrink-0 rounded-pill px-4 text-[12px] font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 overflow-hidden',
                    isFollowing || isRequested
                      ? 'bg-surface-subtle text-muted hover:bg-surface/80'
                      : 'bg-brand text-on-brand hover:bg-brand-hover hover:shadow-[0_0_16px_rgb(from_var(--orbit-brand)_r_g_b_/_0.3)]',
                  )}
                >
                  <span className="relative z-10">{isRequested ? 'Solicitado' : isFollowing ? 'Seguindo' : 'Seguir'}</span>
                  {!isFollowing && !isRequested && (
                    <span className="absolute inset-0 bg-gradient-to-r from-brand via-brand-hover to-brand opacity-0 hover:opacity-100 transition-opacity duration-300" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="relative mt-4 flex min-h-[88px] items-center justify-center rounded-xl border border-dashed border-border-strong bg-gradient-to-br from-brand/5 via-transparent to-transparent px-4 text-center text-xs leading-5 text-muted">
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
