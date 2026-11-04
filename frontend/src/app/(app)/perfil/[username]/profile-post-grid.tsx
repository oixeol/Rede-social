'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  Flag,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Repeat2,
  Share2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { apiRequest, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Post } from '@/lib/types';

interface ProfilePostGridProps {
  posts: Post[];
  tab: 'posts' | 'reels' | 'photos' | 'likes';
  isMe: boolean;
  onRetry?: () => void;
}

function isSafeMediaSource(src: string | null | undefined): src is string {
  return Boolean(src && src.startsWith('/uploads/') && !src.includes('..') && !src.includes('\\'));
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
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

function ProfileGridItem({
  post,
  tab,
  isMe,
  onDeleted,
}: {
  post: Post;
  tab: ProfilePostGridProps['tab'];
  isMe: boolean;
  onDeleted: (postId: number) => void;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [commentsCount, setCommentsCount] = useState(post.comments);
  const [shares, setShares] = useState(post.shares ?? 0);
  const [pendingLike, setPendingLike] = useState(false);
  const [pendingShare, setPendingShare] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const firstMedia = post.media?.length
    ? post.media[0]
    : { url: post.image, mediaType: post.mediaType };
  const safeMediaUrl = isSafeMediaSource(firstMedia.url) ? firstMedia.url : null;
  const isVideo = firstMedia.mediaType === 'video';
  const hasMultiple = (post.media?.length ?? 0) > 1;
  const postPath = `/publicacoes/${post.id}`;
  /**
   * Montado sob demanda: o componente é renderizado no servidor (SSR), onde
   * `window` não existe. O evento de compartilhamento só roda no cliente.
   */
  const getCanonicalUrl = () => new URL(postPath, window.location.origin).toString();

  async function handleLike() {
    if (pendingLike) return;
    setPendingLike(true);
    const previousLiked = liked;
    const previousLikes = likes;
    setLiked(!liked);
    setLikes(liked ? likes - 1 : likes + 1);
    setActionMessage(null);

    try {
      const response = await apiRequest<{ liked: boolean; likes: number }>(
        `/api/posts/${post.id}/like`,
        { method: 'POST' },
      );
      setLiked(response.liked);
      setLikes(response.likes);
    } catch (error) {
      setLiked(previousLiked);
      setLikes(previousLikes);
      setActionMessage(
        error instanceof ApiError ? error.message : 'Não foi possível atualizar a curtida.',
      );
    } finally {
      setPendingLike(false);
    }
  }

  async function handleShare() {
    if (pendingShare) return;
    setPendingShare(true);
    setActionMessage(null);
    setShareUrl(null);

    try {
      const response = await apiRequest<{ shares: number; link: string }>(
        `/api/posts/${post.id}/share`,
        { method: 'POST' },
      );
      setShares(response.shares);

      const canonicalUrl = getCanonicalUrl();
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Publicação no Vibra',
            text: post.caption || 'Veja esta publicação no Vibra.',
            url: canonicalUrl,
          });
          setActionMessage('Compartilhamento concluído.');
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            setActionMessage('Compartilhamento cancelado.');
            return;
          }
        }
      }

      if (await copyToClipboard(canonicalUrl)) {
        setActionMessage('Link copiado.');
      } else {
        setShareUrl(canonicalUrl);
        setActionMessage('Copie o link abaixo para compartilhar.');
      }
    } catch (error) {
      setActionMessage(
        error instanceof ApiError ? error.message : 'Não foi possível compartilhar a publicação.',
      );
    } finally {
      setPendingShare(false);
    }
  }

  async function reportPost() {
    setActionMessage(null);
    try {
      await apiRequest('/api/reports', {
        method: 'POST',
        body: {
          targetType: 'post',
          targetId: post.id,
          reason: 'conteúdo impróprio',
          details: '',
        },
      });
      setActionMessage('Publicação denunciada.');
    } catch (error) {
      setActionMessage(
        error instanceof ApiError ? error.message : 'Não foi possível denunciar a publicação.',
      );
    }
  }

  async function deletePost() {
    if (!window.confirm('Apagar publicação? Essa ação não pode ser desfeita.')) return;
    setActionMessage(null);
    try {
      await apiRequest(`/api/posts/${post.id}`, { method: 'DELETE' });
      onDeleted(post.id);
    } catch (error) {
      setActionMessage(
        error instanceof ApiError ? error.message : 'Não foi possível apagar a publicação.',
      );
    }
  }

  const menuItems: DropdownMenuItem[] = [
    {
      id: 'open',
      label: 'Abrir publicação',
      icon: <Heart className="size-4" />,
      onSelect: () => router.push(postPath as Route),
    },
    {
      id: 'share',
      label: 'Compartilhar',
      icon: <Share2 className="size-4" />,
      onSelect: () => void handleShare(),
    },
    {
      id: 'report',
      label: 'Denunciar publicação',
      icon: <Flag className="size-4" />,
      onSelect: () => void reportPost(),
    },
    ...(isMe
      ? [
          {
            id: 'delete',
            label: 'Apagar publicação',
            icon: <MoreHorizontal className="size-4" />,
            destructive: true,
            onSelect: () => void deletePost(),
          },
        ]
      : []),
  ];

  return (
    <article className="group relative aspect-[4/5] overflow-visible rounded-[20px] border border-border bg-surface transition-shadow hover:shadow-card">
      <button
        type="button"
        className="absolute inset-0 size-full overflow-hidden rounded-[inherit] bg-surface-subtle"
        aria-label={`Abrir ${tab === 'reels' ? 'reel' : 'publicação'} de ${post.user.username}`}
        onClick={() => router.push(postPath as Route)}
      >
        {safeMediaUrl ? (
          isVideo ? (
            <video
              src={safeMediaUrl}
              muted
              playsInline
              preload="metadata"
              className="size-full object-cover"
              aria-label={post.caption || 'Vídeo da publicação'}
            />
          ) : (
            <img
              src={safeMediaUrl}
              alt={post.caption || `Foto de ${post.user.username}`}
              loading="lazy"
              className="size-full object-cover"
            />
          )
        ) : (
          <span className="flex size-full items-center justify-center text-sm text-muted" aria-hidden="true">
            Mídia indisponível
          </span>
        )}
        {hasMultiple ? (
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-pill bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            +{post.media.length - 1}
          </span>
        ) : null}
        {isVideo ? (
          <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-pill bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            <Repeat2 className="size-3" aria-hidden="true" />
            Reel
          </span>
        ) : null}
      </button>

      <DropdownMenu
        label="Mais opções da publicação"
        items={menuItems}
        align="end"
        className="absolute right-2 top-2 z-20 [&>button]:bg-black/45 [&>button]:text-white [&>button]:backdrop-blur-sm"
        trigger={<MoreHorizontal className="size-5" />}
      />

      <footer className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-3 pt-10 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <IconButton
              label={liked ? 'Descurtir' : 'Curtir'}
              icon={<Heart className={cn('size-4', liked && 'text-danger')} />}
              tone={liked ? 'danger' : 'default'}
              pressed={liked}
              onClick={() => void handleLike()}
              disabled={pendingLike}
              className="size-8 text-white hover:bg-white/15 hover:text-white"
            />
            <IconButton
              label="Comentar"
              icon={<MessageSquare className="size-4" />}
              onClick={() => router.push(postPath as Route)}
              className="size-8 text-white hover:bg-white/15 hover:text-white"
            />
            <IconButton
              label="Repostar — em breve"
              icon={<Repeat2 className="size-4" />}
              disabled
              className="size-8 text-white"
            />
            <IconButton
              label="Compartilhar"
              icon={<Share2 className="size-4" />}
              onClick={() => void handleShare()}
              disabled={pendingShare}
              className="size-8 text-white hover:bg-white/15 hover:text-white"
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <span className="flex items-center gap-1" aria-label={`${likes} curtidas`}>
              <Heart className="size-3.5" aria-hidden="true" />
              {formatCount(likes)}
            </span>
            <span className="flex items-center gap-1" aria-label={`${commentsCount} comentários`}>
              <MessageSquare className="size-3.5" aria-hidden="true" />
              {formatCount(commentsCount)}
            </span>
          </div>
        </div>
      </footer>

      {actionMessage || shareUrl ? (
        <div className="absolute right-2 bottom-16 left-2 z-30 rounded-xl border border-border bg-surface-raised p-2 text-xs text-foreground shadow-float">
          {actionMessage ? <p role="status">{actionMessage}</p> : null}
          {shareUrl ? (
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-1 h-8 w-full rounded-pill border border-border bg-surface-subtle px-2 text-xs text-foreground"
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function ProfilePostGrid({ posts, tab, isMe, onRetry }: ProfilePostGridProps) {
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const visiblePosts = posts.filter((post) => !deletedIds.includes(post.id));

  function handleDeleted(postId: number) {
    setDeletedIds((current) => (current.includes(postId) ? current : [...current, postId]));
  }

  if (!visiblePosts.length) {
    const empty = {
      posts: {
        title: 'Nenhuma publicação',
        own: 'Suas fotos e vídeos aparecerão aqui.',
        other: 'Quando publicar, as fotos e vídeos aparecem aqui.',
      },
      reels: {
        title: 'Nenhum reel',
        own: 'Suas fotos e vídeos aparecerão aqui.',
        other: 'Quando publicar, os vídeos aparecem aqui.',
      },
      photos: {
        title: 'Nenhuma foto',
        own: 'Suas fotos e vídeos aparecerão aqui.',
        other: 'Quando publicar, as fotos aparecem aqui.',
      },
      likes: {
        title: 'Nenhuma curtida',
        own: 'As publicações que você curtir aparecem aqui.',
        other: 'As publicações que você curtiu aparecem aqui.',
      },
    }[tab];

    return (
      <EmptyState
        icon={<Heart className="size-5" />}
        title={empty.title}
        description={isMe ? empty.own : empty.other}
        action={
          isMe && (tab === 'posts' || tab === 'reels' || tab === 'photos') ? (
            <Button variant="primary" onClick={onRetry}>
              Criar publicação
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:gap-4"
      role="list"
      aria-label={
        tab === 'likes'
          ? 'Publicações curtidas'
          : tab === 'reels'
            ? 'Reels'
            : tab === 'photos'
              ? 'Fotos'
              : 'Publicações'
      }
    >
      {visiblePosts.map((post) => (
        <div key={post.id} role="listitem" className="min-w-0">
          <ProfileGridItem post={post} tab={tab} isMe={isMe} onDeleted={handleDeleted} />
        </div>
      ))}
    </div>
  );
}
