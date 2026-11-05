'use client';

import Image from 'next/image';
import { useState } from 'react';
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
import { apiRequest } from '@/lib/api';
import type { MockProfile, ProfilePost, ProfileTabId } from '@/lib/profile-mock';
import { PROFILE_TABS } from '@/lib/profile-mock';
import { cn } from '@/lib/cn';

/**
 * Tela de PERFIL do Vibra — componentes da coluna central.
 *
 * Estrutura (referência):
 * 1. Banner com ilustração noturna + botão "…"
 * 2. Avatar grande sobreposto com anel laranja e status verde
 * 3. Nome + selo verificado, @username, bio, botões de ação
 * 4. Estatísticas (128 publicações / 24 seguidores / 3 seguindo)
 * 5. Abas em barra arredondada
 * 6. Grade 2x2 de publicações
 */

export interface ProfileHeaderProps {
  profile: MockProfile;
}

export function ProfileBanner({ profile }: ProfileHeaderProps) {
  return (
    <div className="relative h-[248px] overflow-hidden rounded-2xl border border-border bg-surface-raised sm:h-[300px]">
      <Image
        src={profile.banner}
        alt={profile.bannerAlt}
        fill
        priority
        unoptimized
        className="object-cover"
        sizes="(min-width: 1280px) 840px, 100vw"
      />
      <button
        type="button"
        aria-label="Mais opções da capa"
        className="absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-full bg-background/45 text-foreground backdrop-blur-sm transition-colors hover:bg-background/65"
      >
        <MoreHorizontal aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}

export function ProfileIdentity({ profile }: ProfileHeaderProps) {
  return (
    <div className="relative shrink-0">
      <span className="block rounded-full border-4 border-brand">
        <Image
          src={profile.avatar}
          alt={profile.avatarAlt}
          width={136}
          height={136}
          unoptimized
          className="size-[104px] rounded-full object-cover sm:size-[136px]"
        />
      </span>
      {profile.online ? (
        <span
          aria-label="Online"
          role="status"
          className="absolute right-1 bottom-1 block size-5 rounded-full border-[3px] border-surface bg-success sm:right-2 sm:bottom-2 sm:size-6"
        />
      ) : null}
    </div>
  );
}

export function ProfileActions({ profile }: ProfileHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {profile.isMe === false ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-pill bg-[var(--vibra-follow-bg)] px-4 py-2 text-sm font-bold text-[var(--vibra-follow-text)] transition-[filter] hover:brightness-95"
        >
          <Heart aria-hidden="true" className="size-4" />
          Seguir
        </button>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-pill border border-border-strong bg-transparent px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-subtle"
        >
          <Pencil aria-hidden="true" className="size-4" />
          Editar perfil
        </button>
      )}

      <button
        type="button"
        aria-label="Compartilhar perfil"
        className="inline-flex size-10 items-center justify-center rounded-xl border border-border-strong text-foreground transition-colors hover:bg-surface-subtle"
      >
        <Share2 aria-hidden="true" className="size-[18px]" />
      </button>

      <button
        type="button"
        aria-label="Mais opções do perfil"
        className="inline-flex size-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
      >
        <MoreHorizontal aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}

export function ProfileStats({ profile }: ProfileHeaderProps) {
  const items = [
    { value: profile.stats.posts, label: 'publicações' },
    { value: profile.stats.followers, label: 'seguidores' },
    { value: profile.stats.following, label: 'seguindo' },
  ];

  return (
    <dl className="flex flex-wrap items-center gap-x-8 gap-y-1" aria-label="Estatísticas do perfil">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <dd className="text-[15px] font-bold text-foreground">{item.value}</dd>
          <dt className="text-[13px] text-muted">{item.label}</dt>
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

export interface ProfileTabsProps {
  active: ProfileTabId;
  onChange: (tab: ProfileTabId) => void;
}

export function ProfileTabs({ active, onChange }: ProfileTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Conteúdo do perfil"
      className="flex items-center gap-1 rounded-2xl border border-border bg-surface p-1"
    >
      {PROFILE_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-surface-raised text-foreground'
                : 'text-muted hover:text-foreground',
            )}
          >
            <span aria-hidden="true" className={isActive ? 'text-brand' : undefined}>
              {TAB_ICONS[tab.id]}
            </span>
            {tab.label}
            {isActive ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Formata contagens no padrão da referência: 1.2k, 892, 2.1k. */
export function formatCount(value: number): string {
  if (value >= 1000) {
    const thousands = value / 1000;
    const rounded = Math.round(thousands * 10) / 10;
    return `${rounded}k`;
  }
  return String(value);
}

function ProfileGridItem({ post }: { post: ProfilePost }) {
  const router = useRouter();
  const [liked, setLiked] = useState(Boolean(post.liked));
  const [likes, setLikes] = useState(post.likesValue ?? 0);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const postPath = post.apiId ? (`/publicacoes/${post.apiId}` as Route) : null;

  async function toggleLike() {
    if (!post.apiId || pending) return;
    setPending(true);
    const previousLiked = liked;
    const previousLikes = likes;
    setLiked(!liked);
    setLikes(liked ? likes - 1 : likes + 1);

    try {
      const response = await apiRequest<{ liked: boolean; likes: number }>(
        `/api/posts/${post.apiId}/like`,
        { method: 'POST' },
      );
      setLiked(response.liked);
      setLikes(response.likes);
    } catch {
      setLiked(previousLiked);
      setLikes(previousLikes);
      setFeedback('Não foi possível atualizar a curtida.');
    } finally {
      setPending(false);
    }
  }

  async function sharePost() {
    const url = postPath
      ? new URL(postPath, window.location.origin).toString()
      : window.location.origin;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Publicação no Vibra', url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setFeedback('Link copiado.');
    } catch {
      setFeedback('Não foi possível copiar o link.');
    }
  }

  async function reportPost() {
    if (!post.apiId) return;
    try {
      await apiRequest('/api/reports', {
        method: 'POST',
        body: {
          targetType: 'post',
          targetId: post.apiId,
          reason: 'conteúdo impróprio',
          details: '',
        },
      });
      setFeedback('Publicação denunciada.');
    } catch {
      setFeedback('Não foi possível denunciar a publicação.');
    }
  }

  async function deletePost() {
    if (!post.apiId) return;
    if (!window.confirm('Apagar publicação? Essa ação não pode ser desfeita.')) return;
    try {
      await apiRequest(`/api/posts/${post.apiId}`, { method: 'DELETE' });
      router.refresh();
    } catch {
      setFeedback('Não foi possível apagar a publicação.');
    }
  }

  const menuItems: DropdownMenuItem[] = [
    ...(postPath
      ? [
          {
            id: 'open',
            label: 'Abrir publicação',
            icon: <Heart className="size-4" />,
            onSelect: () => router.push(postPath),
          },
        ]
      : []),
    {
      id: 'share',
      label: 'Compartilhar',
      icon: <Share2 className="size-4" />,
      onSelect: () => void sharePost(),
    },
    ...(post.apiId
      ? [
          {
            id: 'report',
            label: 'Denunciar publicação',
            icon: <Flag className="size-4" />,
            onSelect: () => void reportPost(),
          },
        ]
      : []),
    ...(post.apiId && post.mine
      ? [
          {
            id: 'delete',
            label: 'Apagar publicação',
            icon: <Trash2 className="size-4" />,
            destructive: true,
            onSelect: () => void deletePost(),
          },
        ]
      : []),
  ];

  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-surface-raised">
      <div className="relative aspect-square w-full">
        <Image
          src={post.image}
          alt={post.alt}
          fill
          unoptimized
          className="object-cover"
          sizes="(min-width: 1280px) 420px, 50vw"
        />

        <DropdownMenu
          label={`Mais opções da publicação ${post.id}`}
          items={menuItems}
          align="end"
          className="absolute top-2 right-2 z-20 [&>button]:bg-background/45 [&>button]:text-foreground [&>button]:backdrop-blur-sm hover:[&>button]:bg-background/65"
          trigger={<MoreHorizontal className="size-4" />}
        />

        <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 bg-gradient-to-t from-background/85 to-transparent px-3 pt-8 pb-2.5 text-foreground">
          <button
            type="button"
            onClick={() => void toggleLike()}
            disabled={!post.apiId || pending}
            aria-pressed={liked}
            aria-label={liked ? 'Descurtir publicação' : 'Curtir publicação'}
            className="inline-flex items-center gap-1.5 text-xs font-semibold disabled:cursor-default"
          >
            <Heart
              aria-hidden="true"
              className={cn('size-4', liked && 'fill-danger text-danger')}
            />
            {post.apiId ? formatCount(likes) : post.likes}
          </button>

          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <MessageCircle aria-hidden="true" className="size-4" />
            {post.apiId ? formatCount(post.commentsValue ?? 0) : post.comments}
          </span>

          <button
            type="button"
            onClick={() => void sharePost()}
            aria-label="Compartilhar publicação"
            className="inline-flex items-center gap-1.5 text-xs font-semibold"
          >
            <Send aria-hidden="true" className="size-4" />
          </button>
        </div>

        {feedback ? (
          <p
            role="status"
            className="absolute right-2 bottom-16 left-2 z-30 rounded-xl border border-border bg-surface-raised px-2 py-1.5 text-[11px] text-foreground shadow-float"
          >
            {feedback}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export interface ProfileGridProps {
  profile: MockProfile;
}

export function ProfilePostGrid({ profile }: ProfileGridProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5" role="list" aria-label="Publicações">
      {profile.posts.map((post) => (
        <div key={post.id} role="listitem" className="min-w-0">
          <ProfileGridItem post={post} />
        </div>
      ))}
    </div>
  );
}

/** Componente cliente que coordena abas + grade. */
export function ProfileContent({ profile }: ProfileGridProps) {
  const [activeTab, setActiveTab] = useState<ProfileTabId>('posts');

  return (
    <div className="space-y-4">
      <ProfileTabs active={activeTab} onChange={setActiveTab} />
      {activeTab === 'posts' ? <ProfilePostGrid profile={profile} /> : null}
      {activeTab !== 'posts' ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted">
          {activeTab === 'reels'
            ? 'Nenhum reel publicado ainda.'
            : activeTab === 'photos'
              ? 'Nenhuma foto publicada ainda.'
              : 'Nenhuma curtida ainda.'}
        </div>
      ) : null}
    </div>
  );
}

/** Selo de verificado usado no nome e nas sugestões. */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck
      aria-label="Verificado"
      className={cn('fill-brand text-surface', className)}
      strokeWidth={2.2}
    />
  );
}
