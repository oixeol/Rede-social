'use client';

import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  Flag,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Repeat,
  Share2,
} from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/ui/icon-button';
import { Pill } from '@/components/ui/pill';
import { apiRequest, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Post } from '@/lib/types';

interface PostCardProps {
  post: Post;
  /** When true, use compact grid style (profile grid). */
  compact?: boolean;
  /** Optional callback when post is opened. */
  onOpen?: (postId: number) => void;
}

function isSafeMediaSource(src: string | null | undefined): src is string {
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

export function PostCard({ post, compact = false, onOpen }: PostCardProps) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [commentsCount, setCommentsCount] = useState(post.comments);
  const [shares, setShares] = useState(post.shares ?? 0);
  const [pendingLike, setPendingLike] = useState(false);
  const [pendingShare, setPendingShare] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [pendingComment, setPendingComment] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const media = post.media?.length
    ? post.media
    : [{ url: post.image, mediaType: post.mediaType }];
  const firstMedia = media[0];
  const safeMediaUrl = isSafeMediaSource(firstMedia?.url) ? firstMedia.url : null;
  const isVideo = firstMedia?.mediaType === 'video';
  const hasMultiple = media.length > 1;

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
        error instanceof ApiError
          ? error.message
          : 'Não foi possível atualizar a curtida.',
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

      const canonicalUrl = new URL(`/publicacoes/${post.id}`, window.location.origin).toString();
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
        setActionMessage('Link da publicação copiado.');
      } else {
        setShareUrl(canonicalUrl);
        setActionMessage('Copie o link abaixo para compartilhar a publicação.');
      }
    } catch (error) {
      setActionMessage(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível compartilhar a publicação.',
      );
    } finally {
      setPendingShare(false);
    }
  }

  async function handleComment() {
    const text = commentText.trim();
    if (!text || pendingComment) return;
    setPendingComment(true);
    setActionMessage(null);

    try {
      const response = await apiRequest<{
        comment: {
          id: number;
          text: string;
          createdAt: number;
          user: {
            id: number;
            username: string;
            name: string;
            avatar: string | null;
          };
        };
        comments: number;
      }>(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        body: { text },
      });
      setCommentsCount(response.comments);
      setCommentText('');
      setCommentOpen(false);
      setActionMessage('Comentário publicado.');
      commentInputRef.current?.blur();
    } catch (error) {
      setActionMessage(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível publicar o comentário.',
      );
    } finally {
      setPendingComment(false);
    }
  }

  function handleCommentKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleComment();
    }
  }

  function openPost() {
    onOpen?.(post.id);
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
      setActionMessage('Publicação denunciada para moderação.');
    } catch (error) {
      setActionMessage(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível denunciar a publicação.',
      );
    }
  }

  async function blockAuthor() {
    const shouldBlock = window.confirm(
      `Bloquear @${post.user.username}? As interações futuras com este perfil serão impedidas.`,
    );
    if (!shouldBlock) return;

    setActionMessage(null);
    try {
      await apiRequest(`/api/users/${encodeURIComponent(post.user.username)}/block`, {
        method: 'PUT',
        body: { blocked: true },
      });
      setActionMessage('Usuário bloqueado.');
      window.setTimeout(() => router.push('/inicio' as Route), 500);
    } catch (error) {
      setActionMessage(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível bloquear o usuário.',
      );
    }
  }

  const menuItems: DropdownMenuItem[] = [
    {
      id: 'report',
      label: 'Denunciar publicação',
      icon: <Flag className="size-4" />,
      onSelect: () => void reportPost(),
    },
    {
      id: 'block',
      label: `Bloquear @${post.user.username}`,
      icon: <MoreHorizontal className="size-4" />,
      description: 'Impede interações futuras',
      destructive: true,
      onSelect: () => void blockAuthor(),
    },
    {
      id: 'mute',
      label: 'Silenciar usuário',
      icon: <MessageSquare className="size-4" />,
      description: 'Em breve',
      disabled: true,
    },
    {
      id: 'boost',
      label: 'Impulsionar publicação',
      icon: <Repeat className="size-4" />,
      description: 'Em breve',
      disabled: true,
    },
  ];

  const postClasses = cn(
    'post-card rounded-card border border-border bg-surface transition-shadow hover:shadow-card',
    compact ? 'relative grid-item overflow-visible' : 'overflow-hidden',
  );

  const mediaContent = (
    <button
      type="button"
      className={cn(
        'relative block w-full overflow-hidden bg-surface-subtle',
        compact ? 'aspect-square' : 'aspect-[4/3]',
      )}
      onClick={openPost}
      aria-label={`Abrir publicação de ${post.user.username}`}
    >
      {safeMediaUrl && isVideo ? (
        <video
          src={safeMediaUrl}
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
          aria-label={post.caption || 'Vídeo da publicação'}
        />
      ) : safeMediaUrl ? (
        <img
          src={safeMediaUrl}
          alt={post.caption || `Foto de ${post.user.username}`}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-sm text-muted" aria-hidden="true">
          Mídia indisponível
        </span>
      )}
      {hasMultiple ? (
        <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-pill bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground">
          <span aria-hidden="true">+{media.length - 1}</span>
        </span>
      ) : null}
      {isVideo ? (
        <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-pill bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground">
          Vídeo
        </span>
      ) : null}
    </button>
  );

  if (compact) {
    return (
      <article className={postClasses}>
        <div className="overflow-hidden rounded-t-[inherit]">
          {mediaContent}
        </div>
        <div className="gallery-foot p-3">
          <div className="flex items-center gap-1">
            <IconButton
              label={liked ? 'Descurtir' : 'Curtir'}
              icon={<Heart className={cn('size-5', liked && 'text-danger')} />}
              tone={liked ? 'danger' : 'default'}
              pressed={liked}
              onClick={() => void handleLike()}
              disabled={pendingLike}
            />
            <IconButton
              label="Comentar"
              icon={<MessageSquare className="size-5" />}
              onClick={openPost}
            />
            <IconButton
              label="Repostar — em breve"
              icon={<Repeat className="size-5" />}
              disabled
            />
            <IconButton
              label="Compartilhar"
              icon={<Share2 className="size-5" />}
              onClick={() => void handleShare()}
              disabled={pendingShare}
            />
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Heart className="size-3.5" aria-hidden="true" />
              <strong data-like-count={post.id}>{likes}</strong>
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3.5" aria-hidden="true" />
              <strong data-comment-count={post.id}>{commentsCount}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Share2 className="size-3.5" aria-hidden="true" />
              <strong data-share-count={post.id}>{shares}</strong>
            </span>
          </div>
          <DropdownMenu
            className="absolute right-2 top-2 z-20"
            label="Mais opções da publicação"
            items={menuItems}
            align="end"
            trigger={<MoreHorizontal className="size-5 text-foreground drop-shadow-md" />}
          />
          {actionMessage ? (
            <p className="mt-2 text-xs leading-5 text-muted" role="status">
              {actionMessage}
            </p>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className={postClasses}>
      <header className="flex items-start gap-3 p-4">
        <button
          type="button"
          className="user-link flex shrink-0 items-center gap-2"
          onClick={() => router.push(`/perfil/${encodeURIComponent(post.user.username)}` as Route)}
          aria-label={`Perfil de ${post.user.username}`}
        >
          <Avatar src={post.user.avatar} alt={post.user.name} name={post.user.name} size="md" />
          <span className="user-meta min-w-0 text-left">
            <strong className="block truncate text-foreground">{post.user.username}</strong>
            <small className="block text-xs text-muted">
              {new Date(post.createdAt).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </small>
          </span>
        </button>
        <div className="ml-auto flex items-center gap-1">
          {isVideo ? <Pill tone="brand">Vídeo</Pill> : null}
          <DropdownMenu
            label="Mais opções da publicação"
            items={menuItems}
            trigger={<MoreHorizontal className="size-5 text-muted" />}
            align="end"
          />
        </div>
      </header>

      {mediaContent}

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <IconButton
            label={liked ? 'Descurtir' : 'Curtir'}
            icon={<Heart className={cn('size-5', liked && 'text-danger')} />}
            tone={liked ? 'danger' : 'default'}
            pressed={liked}
            onClick={() => void handleLike()}
            disabled={pendingLike}
          />
          <IconButton
            label="Comentar"
            icon={<MessageSquare className="size-5" />}
            onClick={() => setCommentOpen(true)}
          />
          <IconButton
            label="Repostar — em breve"
            icon={<Repeat className="size-5" />}
            disabled
          />
          <IconButton
            label="Compartilhar"
            icon={<Share2 className="size-5" />}
            onClick={() => void handleShare()}
            disabled={pendingShare}
          />
        </div>

        <p className="flex items-baseline gap-1 text-sm text-muted">
          <strong data-like-count={post.id}>{likes}</strong>
          <span data-like-label={post.id}>{likes === 1 ? 'curtida' : 'curtidas'}</span>
        </p>

        {post.caption ? (
          <p className="caption text-sm text-foreground">
            <button
              type="button"
              className="inline-user font-semibold text-foreground hover:underline"
              onClick={() => router.push(`/perfil/${encodeURIComponent(post.user.username)}` as Route)}
            >
              {post.user.username}
            </button>{' '}
            {post.caption}
          </p>
        ) : null}

        {actionMessage ? (
          <p className="text-xs leading-5 text-muted" role="status" aria-live="polite">
            {actionMessage}
          </p>
        ) : null}

        {shareUrl ? (
          <label className="block text-xs text-muted">
            <span className="mb-1 block font-semibold text-foreground">Link da publicação</span>
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="h-10 w-full rounded-pill border border-border bg-surface-subtle px-3 text-sm text-foreground"
            />
          </label>
        ) : null}

        {commentOpen ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleComment();
            }}
            className="flex gap-2"
          >
            <Avatar src={null} alt="Você" name="Você" size="sm" />
            <div className="flex flex-1 flex-col gap-1">
              <input
                ref={commentInputRef}
                type="text"
                placeholder="Escreva um comentário…"
                maxLength={500}
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                onKeyDown={handleCommentKeyDown}
                className="h-10 flex-1 rounded-pill border border-border bg-surface-subtle/75 px-3 text-sm focus:border-brand focus:bg-surface focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--vibra-brand-fill)_14%,transparent)]"
                autoFocus
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => void handleComment()}
                  disabled={pendingComment || !commentText.trim()}
                >
                  {pendingComment ? 'Enviando…' : 'Enviar'}
                </Button>
              </div>
            </div>
          </form>
        ) : null}

        {commentsCount > 0 ? (
          <button
            type="button"
            className="view-comments text-sm font-medium text-brand hover:underline"
            onClick={() => setCommentOpen(true)}
          >
            Ver {commentsCount} {commentsCount === 1 ? 'comentário' : 'comentários'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
