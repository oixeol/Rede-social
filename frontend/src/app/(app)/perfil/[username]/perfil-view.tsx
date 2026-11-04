'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  BadgeCheck,
  CalendarDays,
  Camera,
  Heart,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Share2,
  Sparkles,
  UserPlus,
  Users,
  Flag,
} from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { Tabs } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/api';
import type { Post, ProfileResponse, SuggestionUser, StoryGroup } from '@/lib/types';

import { ProfilePostGrid } from './profile-post-grid';

interface PerfilViewProps {
  profile: ProfileResponse;
}

type ProfileTab = 'posts' | 'reels' | 'photos' | 'likes';

const PROFILE_TABS_ALL: ProfileTab[] = ['posts', 'reels', 'photos', 'likes'];

function formatCount(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} mes${months === 1 ? '' : 'es'}`;
  const years = Math.floor(months / 12);
  return `há ${years} ano${years === 1 ? '' : 's'}`;
}
function isSafeImageSource(src: string | null | undefined): src is string {
  return Boolean(src && src.startsWith('/uploads/') && !src.includes('..') && !src.includes('\\'));
}

async function copyToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function shareProfile(url: string, name: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title: `${name} no Vibra`, url });
      return;
    } catch {
      // fall through to clipboard
    }
  }
  await copyToClipboard(url);
}

export function PerfilView({ profile: initialProfile }: PerfilViewProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [likes, setLikes] = useState<Post[]>([]);
  const [likesState, setLikesState] = useState<'loading' | 'idle' | 'error'>('loading');
  const [likesReloadKey, setLikesReloadKey] = useState(0);
  const [followPending, setFollowPending] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionUser[]>([]);
  const [suggestionsState, setSuggestionsState] = useState<'loading' | 'idle' | 'error'>('loading');
  const [storiesGroups, setStoriesGroups] = useState<StoryGroup[]>([]);
  const [storiesState, setStoriesState] = useState<'loading' | 'idle' | 'error'>('loading');

  // Load suggestions with abort on unmount/profile change
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    apiRequest<{ users: SuggestionUser[] }>('/api/suggestions', { signal: controller.signal })
      .then((response) => {
        if (cancelled) return;
        setSuggestions(
          response.users.filter((user) => user.id !== profile.user.id).slice(0, 3),
        );
        setSuggestionsState('idle');
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSuggestionsState('error');
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [profile.user.id]);

  // Load likes only on own profile when tab is active
  useEffect(() => {
    if (!profile.isMe || activeTab !== 'likes') return;
    let cancelled = false;
    const controller = new AbortController();
    apiRequest<{ posts: Post[] }>(
      `/api/users/${encodeURIComponent(profile.user.username)}/likes`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (cancelled) return;
        setLikes(response.posts);
        setLikesState('idle');
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLikesState('error');
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [profile.isMe, activeTab, profile.user.username, likesReloadKey]);

  // Load stories for Destaques (target user's visible stories)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    apiRequest<{ groups: StoryGroup[] }>('/api/stories', { signal: controller.signal })
      .then((response) => {
        if (cancelled) return;
        const userGroups = response.groups.filter((g) => g.user.id === profile.user.id);
        setStoriesGroups(userGroups);
        setStoriesState('idle');
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStoriesState('error');
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [profile.user.id]);

  const tabPosts = useMemo(() => {
    if (activeTab === 'reels') return profile.posts.filter((post) => post.mediaType === 'video');
    if (activeTab === 'photos') return profile.posts.filter((post) => post.mediaType !== 'video');
    if (activeTab === 'likes') return likes;
    return profile.posts;
  }, [activeTab, likes, profile.posts]);

  const tabsToShow = profile.isMe ? PROFILE_TABS_ALL : PROFILE_TABS_ALL.filter((t) => t !== 'likes');

  const cover = profile.posts.find((post) => post.mediaType !== 'video') ?? profile.posts[0];
  const banner = isSafeImageSource(profile.user.banner)
    ? profile.user.banner
    : isSafeImageSource(cover?.image)
      ? cover.image
      : null;

  async function handleFollow() {
    if (followPending) return;
    setFollowPending(true);
    try {
      const response = await apiRequest<{
        isFollowing: boolean;
        requested: boolean;
        cancelled: boolean;
        isPrivate: boolean;
        stats: ProfileResponse['stats'];
      }>(`/api/users/${encodeURIComponent(profile.user.username)}/follow`, {
        method: 'POST',
      });
      setProfile((current) => ({
        ...current,
        isFollowing: response.isFollowing,
        followRequested: response.requested,
        stats: response.stats,
        canViewContent: response.isFollowing || !current.user.isPrivate,
      }));
    } finally {
      setFollowPending(false);
    }
  }

  async function handleShareProfile() {
    const url = window.location.href;
    await shareProfile(url, profile.user.name);
  }

  async function handleSuggestionFollow(username: string) {
    try {
      const response = await apiRequest<{ isFollowing: boolean; requested: boolean }>(
        `/api/users/${encodeURIComponent(username)}/follow`,
        { method: 'POST' },
      );
      setSuggestions((current) =>
        current.map((user) =>
          user.username === username
            ? { ...user, isFollowing: response.isFollowing, followRequested: response.requested }
            : user,
        ),
      );
    } catch {
      // error handled by toast? silent for now
    }
  }

  async function openConversation() {
    try {
      const res = await apiRequest<{ conversationId: number }>('/api/conversations', {
        method: 'POST',
        body: { username: profile.user.username },
      });
      router.push(`/mensagens?conversation=${res.conversationId}` as Route);
    } catch {
      // fallback
      router.push('/mensagens' as Route);
    }
  }

  async function handleEditProfile() {
    router.push('/configuracoes' as Route);
  }

  async function handleEditCover() {
    router.push('/configuracoes' as Route);
  }

  async function handleEditAvatar() {
    router.push('/configuracoes' as Route);
  }

  async function handleNewStory() {
    // No dedicated route yet; open modal or navigate when implemented
    router.push('/stories/novo' as Route);
  }

  const menuItems: DropdownMenuItem[] = [
    ...(profile.isMe
      ? []
      : [
          {
            id: 'report',
            label: 'Denunciar perfil',
            icon: <Flag className="size-4" />,
            onSelect: async () => {
              try {
                await apiRequest('/api/reports', {
                  method: 'POST',
                  body: {
                    targetType: 'user',
                    targetId: profile.user.id,
                    reason: 'perfil inadequado',
                    details: '',
                  },
                });
              } catch {
                // ignore
              }
            },
          } satisfies DropdownMenuItem,
          {
            id: 'block',
            label: 'Bloquear usuário',
            icon: <MoreHorizontal className="size-4" />,
            destructive: true,
            onSelect: async () => {
              try {
                await apiRequest(`/api/users/${encodeURIComponent(profile.user.username)}/block`, {
                  method: 'PUT',
                  body: { blocked: true },
                });
                router.push('/inicio' as Route);
              } catch {
                // ignore
              }
            },
          } satisfies DropdownMenuItem,
        ]),
    {
      id: 'settings',
      label: 'Configurações',
      icon: <Users className="size-4" />,
      onSelect: () => router.push('/configuracoes' as Route),
    },
  ];

  const followLabel = profile.followRequested
    ? 'Solicitação enviada'
    : profile.isFollowing
      ? 'Seguindo'
      : profile.user.isPrivate
        ? 'Solicitar para seguir'
        : 'Seguir';

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0" aria-label="Perfil">
          <div className="relative h-48 overflow-hidden rounded-[26px] border border-border bg-gradient-to-br from-brand via-brand-fill to-accent sm:h-60 xl:h-[250px]">
            {banner ? (
              <img src={banner} alt={`Capa de ${profile.user.name}`} className="size-full object-cover" />
            ) : null}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            {profile.isMe ? (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Camera className="size-3.5" />}
                className="absolute right-4 bottom-4 border-white/40 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60"
                onClick={handleEditCover}
              >
                Editar capa
              </Button>
            ) : null}
          </div>

          <div className="relative z-10 -mt-12 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 px-4 sm:-mt-16 sm:px-6">
            <div className="relative">
              <Avatar
                src={profile.user.avatar}
                alt={profile.user.name}
                name={profile.user.name}
                size="xl"
                ring
                verified={profile.stats.verified === 1}
                className="rounded-full border-4 border-surface"
              />
              {profile.isMe ? (
                <button
                  type="button"
                  className="absolute right-0 bottom-0 inline-flex size-8 items-center justify-center rounded-full border-2 border-surface bg-brand-fill text-on-brand shadow-card"
                  aria-label="Editar foto de perfil"
                  onClick={handleEditAvatar}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div className="min-w-0 pt-12 sm:pt-16">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="flex items-center gap-1.5 font-display text-2xl font-bold tracking-[-0.025em] text-foreground sm:text-[27px]">
                    <span className="truncate">{profile.user.name}</span>
                    {profile.stats.verified === 1 ? (
                      <BadgeCheck className="size-5 shrink-0 fill-accent text-surface" aria-label="Perfil verificado" />
                    ) : null}
                    {profile.user.isPrivate ? <Pill tone="neutral">Privado</Pill> : null}
                  </h1>
                  <p className="mt-1 text-sm font-semibold text-muted">@{profile.user.username}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {profile.isMe ? (
                    <>
                      <Button variant="primary" leadingIcon={<Pencil className="size-3.5" />} onClick={handleEditProfile}>
                        Editar perfil
                      </Button>
                      <Button variant="ghost" size="sm" leadingIcon={<Camera className="size-3.5" />} className="mt-2 sm:mt-0" onClick={handleNewStory}>
                        Publicar story
                      </Button>
                      <IconButton label="Compartilhar perfil" icon={<Share2 className="size-5" />} onClick={handleShareProfile} />
                    </>
                  ) : (
                    <>
                      <Button
                        variant={profile.isFollowing || profile.followRequested ? 'secondary' : 'primary'}
                        leadingIcon={profile.isFollowing ? <BadgeCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
                        onClick={handleFollow}
                        disabled={followPending || profile.followRequested}
                      >
                        {followPending ? 'Atualizando…' : followLabel}
                      </Button>
                      {profile.canMessage ? (
                        <Button variant="secondary" leadingIcon={<MessageSquare className="size-3.5" />} onClick={openConversation}>
                          Mensagem
                        </Button>
                      ) : null}
                      <IconButton label="Compartilhar perfil" icon={<Share2 className="size-5" />} onClick={handleShareProfile} />
                    </>
                  )}
                  <DropdownMenu label="Mais opções do perfil" items={menuItems} align="end" />
                </div>
              </div>

              <p className="mt-4 max-w-xl text-sm leading-6 text-foreground">
                {profile.user.bio || 'Esta pessoa ainda não escreveu uma bio.'}
              </p>

              <nav className="mt-5 flex flex-wrap gap-x-6 gap-y-2" aria-label="Estatísticas do perfil">
                <button type="button" className="flex items-baseline gap-1.5 text-sm text-muted hover:text-foreground">
                  <strong className="text-base text-foreground">{formatCount(profile.stats.posts)}</strong>
                  <span>publicações</span>
                </button>
                <button type="button" className="flex items-baseline gap-1.5 text-sm text-muted hover:text-foreground">
                  <strong className="text-base text-foreground" data-profile-followers>
                    {formatCount(profile.stats.followers)}
                  </strong>
                  <span>seguidores</span>
                </button>
                <button type="button" className="flex items-baseline gap-1.5 text-sm text-muted hover:text-foreground">
                  <strong className="text-base text-foreground">{formatCount(profile.stats.following)}</strong>
                  <span>seguindo</span>
                </button>
              </nav>
            </div>
          </div>

          <div className="mt-8 px-4 sm:px-6">
            <Tabs
              label="Conteúdo do perfil"
              items={tabsToShow.map((t) => ({ id: t, label: t === 'posts' ? 'Publicações' : t === 'reels' ? 'Reels' : t === 'photos' ? 'Fotos' : 'Curtidas' }))}
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as ProfileTab)}
            >
              {!profile.canViewContent ? (
                <EmptyState
                  icon={<Lock className="size-5" />}
                  title="Este perfil é privado"
                  description={
                    profile.followRequested
                      ? 'Sua solicitação está aguardando aprovação. Enquanto isso, as publicações e stories ficam ocultos.'
                      : 'Envie uma solicitação para seguir. Quando aprovada, você poderá ver as publicações e stories deste perfil.'
                  }
                  action={
                    profile.followRequested ? (
                      <Button variant="secondary" onClick={handleFollow} disabled={followPending}>
                        Cancelar solicitação
                      </Button>
                    ) : (
                      <Button variant="primary" onClick={handleFollow} disabled={followPending}>
                        Solicitar para seguir
                      </Button>
                    )
                  }
                />
              ) : activeTab === 'likes' && likesState === 'loading' ? (
                <div className="grid grid-cols-2 gap-4" aria-label="Carregando curtidas">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="aspect-[4/5] w-full rounded-card" label="Curtida" />
                  ))}
                </div>
              ) : activeTab === 'likes' && likesState === 'error' ? (
                <ErrorState
                  title="Não foi possível carregar as curtidas"
                  description="Essa lista é privada e só fica disponível para a conta autenticada."
                  onRetry={() => {
                    setLikesState('loading');
                    setLikesReloadKey((current) => current + 1);
                  }}
                />
              ) : (
                <ProfilePostGrid
                  posts={tabPosts}
                  tab={activeTab}
                  isMe={profile.isMe}
                  onRetry={() => router.refresh()}
                />
              )}
            </Tabs>
          </div>
        </section>

        <aside className="hidden space-y-4 xl:sticky xl:top-20 xl:block" aria-label="Informações do perfil">
          <Card className="p-4">
            <header className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">Sobre mim</h2>
              <span className="inline-flex size-8 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Users className="size-4" aria-hidden="true" />
              </span>
            </header>
            <p className="mt-3 text-sm leading-6 text-muted">
              {profile.user.bio || 'Esta pessoa ainda não escreveu uma bio.'}
            </p>
            {profile.user.createdAt ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                <CalendarDays className="size-4" aria-hidden="true" />
                Entrou em {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(profile.user.createdAt))}
              </p>
            ) : null}
            {profile.user.interests.length ? (
              <div className="mt-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Interesses</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.user.interests.map((interest) => (
                    <Pill key={interest} tone="brand">{interest}</Pill>
                  ))}
                </div>
              </div>
            ) : null}
            {profile.badges.length ? (
              <div className="mt-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Selos</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.badges.map((badge) => (
                    <Pill key={badge.id} tone="accent" className="gap-1">
                      <Sparkles className="size-3" aria-hidden="true" />
                      {badge.label}
                    </Pill>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="p-4">
            <header className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">Destaques</h2>
              <span className="inline-flex size-8 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
            </header>
            {storiesState === 'loading' ? (
              <div className="mt-4 grid grid-cols-4 gap-2" aria-label="Carregando destaques">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-square rounded-xl" label="Destaque" />
                ))}
              </div>
            ) : storiesState === 'error' ? (
              <p className="mt-3 text-sm leading-6 text-muted">Não foi possível carregar os destaques.</p>
            ) : storiesGroups.length ? (
              <div className="mt-4 grid grid-cols-4 gap-2" role="list" aria-label="Destaques do perfil">
                {storiesGroups.flatMap((group) =>
                  group.stories.slice(0, 1).map((story) => (
                    <button
                      key={story.id}
                      type="button"
                      className="relative aspect-square rounded-xl overflow-hidden border border-border bg-surface-subtle"
                      aria-label={`Ver story ${group.user.name}`}
                    >
                      {isSafeImageSource(story.image) && (
                        <img src={story.image} alt="" loading="lazy" className="size-full object-cover" />
                      )}
                      <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" aria-hidden="true" />
                    </button>
                  )),
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">
                {profile.isMe
                  ? 'Você ainda não tem stories. Publique o primeiro para guardar seus momentos aqui.'
                  : 'Esta pessoa não tem destaques visíveis no momento.'}
              </p>
            )}
            {profile.isMe ? (
              <Button variant="ghost" size="sm" leadingIcon={<Camera className="size-3.5" />} className="mt-4 w-full" onClick={handleNewStory}>
                Publicar story
              </Button>
            ) : null}
          </Card>

          <Card className="p-4">
            <header className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">Sugestões para você</h2>
              <span className="inline-flex size-8 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Users className="size-4" aria-hidden="true" />
              </span>
            </header>
            {suggestionsState === 'loading' ? (
              <div className="mt-4 space-y-3" aria-label="Carregando sugestões">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" label="Avatar" />
                    <Skeleton className="h-8 flex-1 rounded-xl" label="Sugestão" />
                  </div>
                ))}
              </div>
            ) : suggestionsState === 'error' ? (
              <p className="mt-3 text-sm text-muted">Não foi possível carregar as sugestões.</p>
            ) : suggestions.length ? (
              <ul className="mt-4 space-y-3" role="list">
                {suggestions.map((user) => (
                  <li key={user.id} className="flex items-center gap-3">
                    <Avatar src={user.avatar} alt={user.name} name={user.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-foreground">{user.name}</strong>
                      <span className="block truncate text-xs text-muted">@{user.username}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={user.isFollowing || user.followRequested ? 'secondary' : 'primary'}
                      disabled={user.isFollowing || user.followRequested}
                      onClick={() => handleSuggestionFollow(user.username)}
                    >
                      {user.followRequested ? 'Solicitado' : user.isFollowing ? 'Seguindo' : 'Seguir'}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">Você já está conectado às pessoas certas por aqui.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}