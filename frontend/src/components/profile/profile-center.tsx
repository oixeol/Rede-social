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
  Image as ImageIcon,
} from 'lucide-react';

import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { PostCard } from '@/components/posts/post-card';
import { apiRequest } from '@/lib/api';
import { isFeatureEnabled } from '@/lib/feature-flags';
import type { ProfileTabId, ProfileViewModel } from '@/lib/profile-view-model';
import { cn } from '@/lib/cn';
import { isSafeMediaSource } from '@/lib/media';

/**
 * Tela de PERFIL do Vibra — componentes da coluna central.
 *
 * Estrutura (referência):
 * 1. Banner com ilustração noturna + botão "…"
 * 2. Avatar grande sobreposto com anel laranja 3px, glow e ponto verde
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
    <div className="relative h-[207px] overflow-hidden rounded-[22px] border border-border bg-surface-raised">
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
          className="size-full bg-gradient-to-br from-brand-soft via-surface to-accent-soft"
          role="img"
          aria-label={profile.bannerAlt}
        />
      )}
    </div>
  );
}

export function ProfileIdentity({ profile }: ProfileHeaderProps) {
  return (
    <div className="relative shrink-0">
      <span className="block size-[166px] rounded-full border-[3px] border-brand bg-surface-raised shadow-[0_0_0_3px_rgb(from_var(--vibra-brand-fill)_r_g_b_/_0.15)]">
        {isSafeMediaSource(profile.avatar) ? (
          <Image
            src={profile.avatar}
            alt={profile.avatarAlt}
            width={160}
            height={160}
            loading="eager"
            fetchPriority="high"
            unoptimized
            className="size-[160px] rounded-full object-cover"
          />
        ) : (
          <span
            role="img"
            aria-label={profile.avatarAlt}
            className="flex size-[160px] items-center justify-center rounded-full bg-gradient-to-br from-brand-fill to-accent text-3xl font-bold text-on-brand"
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
        await navigator.share({ title: `Perfil de ${profile.name} no Vibra`, url });
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
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
          data-following={followState.isFollowing}
          data-requested={followState.followRequested}
        >
          {followState.followRequested ? (
            <>
              <Heart aria-hidden="true" className="size-4 fill-brand text-brand" />
              Solicitado
            </>
          ) : followState.isFollowing ? (
            <>
              <Heart aria-hidden="true" className="size-4 fill-muted text-muted" />
              Seguindo
            </>
          ) : (
            <>
              <Heart aria-hidden="true" className="size-4" />
              Seguir
            </>
          )}
        </button>
      ) : (
        <Link
          href={'/configuracoes' as Route}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface-subtle"
        >
          <Pencil aria-hidden="true" className="size-4" />
          Editar perfil
        </Link>
      )}

      <button
        type="button"
        onClick={handleShareProfile}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface-subtle"
      >
        <Share2 aria-hidden="true" className="size-4" />
        Compartilhar
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

export function ProfileStats({ profile, followersOverride }: { profile: ProfileViewModel; followersOverride?: number }) {
  const followers = followersOverride ?? profile.stats.followers;
  const items = [
    { value: profile.stats.posts, label: 'publicações' },
    { value: followers, label: 'seguidores' },
    { value: profile.stats.following, label: 'seguindo' },
  ];

  return (
    <dl className="flex flex-wrap items-start gap-x-8 gap-y-1" aria-label="Estatísticas do perfil">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col items-start">
          <dd className="text-[20px] leading-[26px] font-bold text-foreground">{item.value}</dd>
          <dt className="text-[13px] leading-[18px] text-muted">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}

const TAB_ICONS: Record<ProfileTabId, React.ReactNode> = {
  posts: <LayoutGrid className="size-4" />,
  reels: <Play className="size-4" />,
  photos: <ImageIcon className="size-4" />,
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
  { id: 'reels', label: 'Reels', icon: TAB_ICONS.reels },
  { id: 'photos', label: 'Fotos', icon: TAB_ICONS.photos },
  { id: 'likes', label: 'Curtidas', icon: TAB_ICONS.likes },
] as const;

/** Abas visíveis conforme permissões de interface e conteúdo real do perfil. */
function getAvailableProfileTabs(profile: ProfileViewModel, reelsEnabled: boolean) {
  return PROFILE_TABS.filter((tab) => {
    if (tab.id === 'posts') return true;
    if (tab.id === 'reels') return reelsEnabled;
    if (tab.id === 'photos') return profile.posts.some((p) => p.mediaType === 'image');
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
      className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1"
      ref={listRef}
    >
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
              'relative flex min-h-11 items-center justify-center gap-2 rounded-pill px-3 text-[12px] font-semibold transition-colors',
              isActive
                ? 'bg-surface-raised text-foreground shadow-sm'
                : 'text-muted hover:bg-surface-subtle hover:text-foreground',
            )}
          >
            <span aria-hidden="true" className={isActive ? 'text-brand' : undefined}>
              {tab.icon}
            </span>
            <span className="truncate">{tab.label}</span>
            {isActive && (
              <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />
            )}
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
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface/60 px-5 py-10 text-center">
        <p className="text-sm text-muted">Nenhuma publicação com mídia.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" role="list" aria-label="Publicações">
      {mediaPosts.map((post) => (
        <div key={post.id} role="listitem" className="min-w-0">
          <PostCard
            post={post}
            compact
          />
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
    if (tabId === 'photos') {
      return <ProfilePostGrid posts={profile.posts.filter((p) => p.mediaType === 'image')} />;
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
      className={cn('fill-brand text-surface', className)}
      strokeWidth={2.2}
    />
  );
}