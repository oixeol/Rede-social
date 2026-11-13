'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  BadgeCheck,
  Flag,
  Heart,
  LayoutGrid,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Play,
  Send,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';

import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { PostCard } from '@/components/posts/post-card';
import { StatusMenu } from '@/components/profile/status-menu';
import { apiRequest } from '@/lib/api';
import { isFeatureEnabled } from '@/lib/feature-flags';
import type { ProfileTabId, ProfileViewModel } from '@/lib/profile-view-model';
import type { Community, CommunitiesResponse, Presence } from '@/lib/types';
import { cn } from '@/lib/cn';
import { isSafeMediaSource } from '@/lib/media';

/**
 * Tela de PERFIL do Orbit — componentes da coluna central.
 *
 * Estrutura (referência):
 * 1. Banner com ilustração noturna + botão "…"
 * 2. Avatar grande sobreposto com anel coral 3px, glow e ponto verde
 * 3. Nome + selo verificado, @username, bio, botões de ação
 * 4. Estatísticas
 * 5. Abas em container pílula (role="tablist", navegação por teclado)
 * 6. Grade 2 colunas ~2:1 com gap ~16px; cards com overlay e contadores
 */

export interface ProfileHeaderProps {
  profile: ProfileViewModel;
}

export function ProfileBanner({ profile }: ProfileHeaderProps) {
  return (
    <div className="relative h-[200px] w-full overflow-hidden rounded-[24px] border border-border bg-surface-raised">
      {isSafeMediaSource(profile.banner) ? (
        <Image
          src={profile.banner}
          alt={profile.bannerAlt}
          fill
          loading="eager"
          fetchPriority="high"
          unoptimized
          className="object-cover"
          sizes="(min-width: 1280px) 872px, 100vw"
        />
      ) : (
        <div
          className="size-full bg-gradient-to-br from-brand-soft via-surface to-brand-soft relative"
          role="img"
          aria-label={profile.bannerAlt}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--orbit-brand)_0%,_transparent_70%)] opacity-20" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,_var(--orbit-brand-soft)_0%,_transparent_50%,_var(--orbit-surface)_100%)]" />
        </div>
      )}
    </div>
  );
}

export function ProfileIdentity({ profile }: ProfileHeaderProps) {
  const [presence, setPresence] = useState<Presence>(profile.presence ?? 'available');
  const [presenceProp, setPresenceProp] = useState<Presence>(profile.presence ?? 'available');

  /* Sincronização com props do servidor (ajustar state durante o render). */
  if (profile.presence !== presenceProp) {
    setPresenceProp(profile.presence ?? 'available');
    setPresence(profile.presence ?? 'available');
  }

  return (
    <div className="relative w-fit shrink-0">
      <div className="relative">
        {/* Outer glow ring */}
        <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-brand via-brand-hover to-brand blur-lg opacity-40 animate-pulse-slow" aria-hidden="true" />
        {/* Middle ring */}
        <span className="absolute -inset-[2px] rounded-full border border-brand/30 bg-gradient-to-br from-brand/20 to-transparent" aria-hidden="true" />
        {/* Main avatar ring */}
        <span className="relative block size-[104px] rounded-full ring-4 ring-brand bg-surface-raised shadow-[0_0_0_4px_rgb(from_var(--orbit-brand-fill)_r_g_b_/_0.15),0_0_32px_rgb(from_var(--orbit-brand-fill)_r_g_b_/_0.3),0_8px_24px_rgb(0_0_0_/_0.4)] sm:size-[128px]">
          {isSafeMediaSource(profile.avatar) ? (
            <Image
              src={profile.avatar}
              alt={profile.avatarAlt}
              width={120}
              height={120}
              loading="eager"
              fetchPriority="high"
              unoptimized
              className="size-[96px] rounded-full object-cover sm:size-[120px]"
            />
          ) : (
            <span
              role="img"
              aria-label={profile.avatarAlt}
              className="flex size-[96px] items-center justify-center rounded-full bg-gradient-to-br from-brand-fill via-brand to-brand-hover text-3xl font-bold text-on-brand sm:size-[120px]"
            >
              {profile.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase() || '?'}
            </span>
          )}
        </span>
      </div>

      {/* Ponto de status ancorado na borda do avatar (canto inferior direito).
          No próprio perfil, abre o menu de presença.
          `z-30` mantém o menu acima da grade de publicações (z-20). */}
      <span className="absolute right-0 bottom-0 z-30 translate-x-1/3 translate-y-1/3">
        <StatusMenu
          presence={presence}
          editable={profile.isMe}
          onChange={setPresence}
        />
      </span>
    </div>
  );
}

export function ProfileActions({ profile, onFollowerChange }: { profile: ProfileViewModel; onFollowerChange?: (delta: number) => void }) {
  const [followState, setFollowState] = useState({
    isFollowing: profile.isFollowing,
    followRequested: profile.followRequested,
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isOwnProfile = profile.isMe;

  async function handleFollow() {
    if (!profile.id || profile.isMe) return;
    const previous = followState;
    const optimisticIsFollowing = !previous.isFollowing;
    setFollowState({ isFollowing: optimisticIsFollowing, followRequested: false });
    setStatusMessage(null);
    onFollowerChange?.(optimisticIsFollowing ? 1 : -1);
    try {
      const response = await apiRequest<{
        isFollowing: boolean;
        requested: boolean;
        cancelled: boolean;
        stats: { followers: number };
      }>(`/api/users/${encodeURIComponent(profile.username)}/follow`, {
        method: 'POST',
      });
      setFollowState({ isFollowing: response.isFollowing, followRequested: response.requested });
      setStatusMessage(
        response.requested
          ? 'Solicitação de follow enviada.'
          : response.isFollowing
            ? `Agora você segue ${profile.name}.`
            : `Você deixou de seguir ${profile.name}.`,
      );
    } catch {
      setFollowState(previous);
      onFollowerChange?.(optimisticIsFollowing ? -1 : 1);
      setStatusMessage('Não foi possível atualizar o follow.');
    }
  }

  async function handleShareProfile() {
    const url = new URL(`/perfil/${encodeURIComponent(profile.username)}`, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Perfil de ${profile.name} no Orbit`, url });
        setStatusMessage('Perfil compartilhado.');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatusMessage('Link do perfil copiado.');
    } catch {
      setStatusMessage('Não foi possível copiar o link do perfil.');
    }
  }

  async function handleReportProfile() {
    try {
      await apiRequest('/api/reports', {
        method: 'POST',
        body: {
          targetType: 'user',
          targetId: profile.id,
          reason: 'conteúdo impróprio',
          details: '',
        },
      });
      // Optionally show toast, but per spec no external lib.
    } catch {
      // ignore or log
    }
  }

  const menuItems: DropdownMenuItem[] = [
    {
      id: 'copy-link',
      label: 'Copiar link do perfil',
      icon: <Share2 className="size-4" />,
      onSelect: () => void handleShareProfile(),
    },
    ...(!isOwnProfile
      ? [
          {
            id: 'report',
            label: 'Denunciar perfil',
            icon: <Flag className="size-4" />,
            destructive: true,
            onSelect: () => void handleReportProfile(),
          },
        ]
      : []),
  ];

  return (
    <div className="flex shrink-0 items-center gap-2">
      {!isOwnProfile ? (
        <button
          type="button"
          onClick={handleFollow}
          disabled={followState.followRequested}
          className="relative inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden"
          data-following={followState.isFollowing}
          data-requested={followState.followRequested}
        >
          {/* Glow effect */}
          <span className="absolute inset-0 bg-gradient-to-r from-brand via-brand-hover to-brand opacity-0 hover:opacity-100 transition-opacity duration-300" aria-hidden="true" />
          <span className="relative flex items-center gap-2">
            {followState.followRequested ? (
              <>
                <Heart aria-hidden="true" className="size-4 fill-on-brand text-on-brand" />
                Solicitado
              </>
            ) : followState.isFollowing ? (
              <>
                <Heart aria-hidden="true" className="size-4 fill-on-brand text-on-brand" />
                Seguindo
              </>
            ) : (
              <>
                <Heart aria-hidden="true" className="size-4" />
                Seguir
              </>
            )}
          </span>
        </button>
      ) : (
        <Link
          href={'/configuracoes' as Route}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-xs font-semibold text-foreground transition-colors hover:bg-surface-subtle"
        >
          <Pencil aria-hidden="true" className="size-4" />
          Editar perfil
        </Link>
      )}

      <button
        type="button"
        onClick={handleShareProfile}
        aria-label="Compartilhar perfil"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors hover:bg-surface-subtle hover:border-brand/30 hover:shadow-[0_0_12px_rgb(from_var(--orbit-brand)_r_g_b_/_0.15)]"
      >
        <Share2 aria-hidden="true" className="size-4" />
      </button>

      <DropdownMenu
        label="Mais opções do perfil"
        items={menuItems}
        align="end"
        trigger={<MoreHorizontal aria-hidden="true" className="size-[18px]" />}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </div>
  );
}

const TAB_ICONS: Record<ProfileTabId, React.ReactNode> = {
  posts: <LayoutGrid className="size-4" />,
  reels: <Play className="size-4" />,
  communities: <Users className="size-4" />,
  likes: <Heart className="size-4" />,
};

interface ProfileTabsProps {
  active: ProfileTabId;
  onChange: (tab: ProfileTabId) => void;
  profile: ProfileViewModel;
  reelsEnabled: boolean;
}

const PROFILE_TABS = [
  { id: 'posts', label: 'Publicações', icon: TAB_ICONS.posts },
  { id: 'reels', label: 'Instantes', icon: TAB_ICONS.reels },
  { id: 'communities', label: 'Comunidade', icon: TAB_ICONS.communities },
  { id: 'likes', label: 'Curtidas', icon: TAB_ICONS.likes },
] as const;

/** Abas visíveis conforme permissões de interface e conteúdo real do perfil. */
function getAvailableProfileTabs(profile: ProfileViewModel, reelsEnabled: boolean) {
  return PROFILE_TABS.filter((tab) => {
    if (tab.id === 'posts') return true;
    if (tab.id === 'reels') return reelsEnabled;
    if (tab.id === 'communities') return isFeatureEnabled('communities');
    if (tab.id === 'likes') return profile.isMe;
    return false;
  });
}

export function ProfileTabs({ active, onChange, profile, reelsEnabled }: ProfileTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const filteredTabs = getAvailableProfileTabs(profile, reelsEnabled);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % filteredTabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + filteredTabs.length) % filteredTabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = filteredTabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(filteredTabs[nextIndex].id);
    // Focus next button after state update
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLButtonElement>(
        `[role="tab"][data-tab-id="${filteredTabs[nextIndex].id}"]`,
      )?.focus();
    });
  };

  return (
    <div
      role="tablist"
      aria-label="Conteúdo do perfil"
      aria-orientation="horizontal"
      className="relative flex w-full items-center gap-1 rounded-[14px] border border-border bg-surface p-1"
      ref={listRef}
    >
      {/* Active tab indicator with glow */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0.5 rounded-[12px] bg-brand shadow-[0_0_12px_rgb(from_var(--orbit-brand)_r_g_b_/_0.4),0_2px_8px_rgb(from_var(--orbit-brand)_r_g_b_/_0.3)] transition-all duration-300 ease-out"
        style={{
          left: `calc(100% / ${filteredTabs.length} * ${filteredTabs.findIndex(t => t.id === active)})`,
          width: `calc(100% / ${filteredTabs.length})`,
        }}
      />
      {filteredTabs.map((tab, index) => {
        const isActive = tab.id === active;

        return (
          <button
            key={tab.id}
            id={`perfil-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`perfil-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            data-tab-id={tab.id}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'relative flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[12px] px-4 text-[13px] font-semibold transition-colors z-10',
              isActive
                ? 'text-on-brand'
                : 'text-muted hover:bg-surface-subtle hover:text-foreground',
            )}
          >
            <span aria-hidden="true" className="shrink-0">
              {tab.icon}
            </span>
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface ProfileGridProps {
  posts: ProfileViewModel['posts'];
}

function ProfilePostGrid({ posts }: ProfileGridProps) {
  const mediaPosts = posts.filter((p) => p.mediaType === 'image' || p.mediaType === 'video');

  if (mediaPosts.length === 0) {
    return (
      <div className="relative rounded-2xl border border-dashed border-border-strong bg-surface/60 px-5 py-10 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand/5 via-transparent to-brand/5" />
        <p className="relative text-sm text-muted">Nenhuma publicação com mídia.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]" role="list" aria-label="Publicações">
      {mediaPosts.map((post) => (
        <div key={post.id} role="listitem" className="min-w-0 group">
          <PostCard
            post={post}
            compact
          />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-brand/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>
      ))}
    </div>
  );
}

interface ProfileLikesProps {
  username: string;
}

function ProfileLikes({ username }: ProfileLikesProps) {
  const [posts, setPosts] = useState<ProfileViewModel['posts']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const response = await apiRequest<{ posts: ProfileViewModel['posts'] }>(`/api/users/${encodeURIComponent(username)}/likes`);
        if (!cancelled) {
          setPosts(response.posts);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Não foi possível carregar curtidas.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [username]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted">
        Carregando curtidas…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-danger">
        {error}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface/60 px-5 py-10 text-center text-sm text-muted">
        Nenhuma curtida registrada.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" role="list" aria-label="Curtidas">
      {posts.map((post) => (
        <div key={post.id} role="listitem" className="min-w-0">
          <PostCard post={post} compact />
        </div>
      ))}
    </div>
  );
}

interface ProfileCommunitiesProps {
  username: string;
}

function ProfileCommunities({ username }: ProfileCommunitiesProps) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const response = await apiRequest<CommunitiesResponse>(
          `/api/users/${encodeURIComponent(username)}/communities`,
        );
        if (!cancelled) {
          setCommunities(response.communities);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Não foi possível carregar as comunidades.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [username]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted">
        Carregando comunidades…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-danger">
        {error}
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface/60 px-5 py-10 text-center text-sm text-muted">
        Este perfil ainda não participa de nenhuma comunidade.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" role="list" aria-label="Comunidades">
      {communities.map((community) => (
        <div
          key={community.id}
          role="listitem"
          className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-4"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"
          >
            <Users className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{community.name}</p>
            <p className="text-xs text-muted">
              {community.memberCount} {community.memberCount === 1 ? 'membro' : 'membros'}
            </p>
          </div>
          {community.role === 'owner' ? (
            <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand uppercase">
              Criador
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export interface ProfileContentProps {
  profile: ProfileViewModel;
}

export function ProfileContent({ profile }: ProfileContentProps) {
  const [activeTab, setActiveTab] = useState<ProfileTabId>('posts');
  const reelsEnabled = isFeatureEnabled('reels');
  const availableTabs = getAvailableProfileTabs(profile, reelsEnabled);

  // Garante aba inicial disponível sem state update durante render
  const safeActiveTab = availableTabs.some((tab) => tab.id === activeTab) ? activeTab : 'posts';

  const renderPanelContent = (tabId: ProfileTabId) => {
    if (tabId === 'posts') return <ProfilePostGrid posts={profile.posts} />;
    if (tabId === 'reels') {
      return <ProfilePostGrid posts={profile.posts.filter((p) => p.mediaType === 'video')} />;
    }
    if (tabId === 'communities') {
      return <ProfileCommunities username={profile.username} />;
    }
    if (tabId === 'likes' && profile.isMe) {
      return <ProfileLikes username={profile.username} />;
    }
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface/60 px-5 py-10 text-center text-sm text-muted">
        Conteúdo indisponível.
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <ProfileTabs
        active={safeActiveTab}
        onChange={setActiveTab}
        profile={profile}
        reelsEnabled={reelsEnabled}
      />
      {availableTabs.map((tab) => (
        <div
          key={tab.id}
          id={`perfil-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`perfil-tab-${tab.id}`}
          hidden={tab.id !== safeActiveTab}
          tabIndex={0}
        >
          {tab.id === safeActiveTab ? renderPanelContent(tab.id) : null}
        </div>
      ))}
    </div>
  );
}

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck
      aria-label="Verificado"
      className={cn('fill-[#4A92E6] text-white', className)}
      strokeWidth={2.2}
    />
  );
}