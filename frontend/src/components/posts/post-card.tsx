'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Flag,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Repeat,
  Save,
  Share2,
} from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/ui/icon-button';
import { apiRequest, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { isSafeMediaSource } from '@/lib/media';
import type { Post } from '@/lib/types';

interface PostCardProps {
  post: Post;
  /** When true, use compact grid style (profile grid). */
  compact?: boolean;
  /** Optional callback when post is opened. */
  onOpen?: (postId: number) => void;
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

/** Formato de tempo relativo estilo Instagram: "1 sem", "2 h", "3 m", "4 a" */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  if (diffMs < 0) return 'agora';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours} h`;
  if (days < 7) return `${days} d`;
  if (weeks < 5) return `${weeks} sem`;
  if (months < 12) return `${months} m`;
  return `${years} a`;
}

export function PostCard({ post, compact = false, onOpen }: PostCardProps) {
  const router = useRouter();
  const [mediaIndex, setMediaIndex] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [commentsCount, setCommentsCount] = useState(post.comments);
  const [shares, setShares] = useState(post.shares ?? 0);
  const [reposted, setReposted] = useState(post.reposted ?? false);
  const [reposts, setReposts] = useState(post.reposts ?? 0);
  const [saved, setSaved] = useState(post.saved ?? false);
  const [saves, setSaves] = useState(post.saves ?? 0);
  const [authorFollowing, setAuthorFollowing] = useState(post.authorFollowing ?? false);
  const [pendingLike, setPendingLike] = useState(false);
  const [pendingComment, setPendingComment] = useState(false);
  const [pendingShare, setPendingShare] = useState(false);
  const [pendingRepost, setPendingRepost] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const isTextOnly = post.mediaType === 'text' && !post.image;
  const media = post.media?.length
    ? post.media
    : post.image
      ? [{ url: post.image, mediaType: post.mediaType }]
      : [];
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

  async function handleRepost() {
    if (pendingRepost) return;
    setPendingRepost(true);
    const previousReposted = reposted;
    const previousReposts = reposts;
    setReposted(!reposted);
    setReposts(reposted ? reposts - 1 : reposts + 1);
    setActionMessage(null);

    try {
      const response = await apiRequest<{ reposted: boolean; reposts: number }>(
        `/api/posts/${post.id}/repost`,
        { method: 'POST' },
      );
      setReposted(response.reposted);
      setReposts(response.reposts);
    } catch (error) {
      setReposted(previousReposted);
      setReposts(previousReposts);
      setActionMessage(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível repostar.',
      );
    } finally {
      setPendingRepost(false);
    }
  }

  async function handleSave() {
    if (pendingSave) return;
    setPendingSave(true);
    const previousSaved = saved;
    const previousSaves = saves;
    setSaved(!saved);
    setSaves(saved ? saves - 1 : saves + 1);
    setActionMessage(null);

    try {
      const response = await apiRequest<{ saved: boolean; saves: number }>(
        `/api/posts/${post.id}/save`,
        { method: 'POST' },
      );
      setSaved(response.saved);
      setSaves(response.saves);
    } catch (error) {
      setSaved(previousSaved);
      setSaves(previousSaves);
      setActionMessage(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível salvar.',
      );
    } finally {
      setPendingSave(false);
    }
  }

  async function handleShare() {
    if (pendingShare) return;
    setPendingShare(true);
    setActionMessage(null);
    setShareUrl(null);

    const canonicalUrl = new URL(`/publicacoes/${post.id}`, window.location.origin).toString();

    try {
      let shared = false;

      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Publicação no Orbit',
            text: post.caption || 'Veja esta publicação no Orbit.',
            url: canonicalUrl,
          });
          shared = true;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            setActionMessage('Compartilhamento cancelado.');
            return;
          }
        }
      }

      if (!shared) {
        const copied = await copyToClipboard(canonicalUrl);
        if (!copied) {
          setShareUrl(canonicalUrl);
          setActionMessage('Copie o link abaixo para compartilhar a publicação.');
          return;
        }
      }

      try {
        const response = await apiRequest<{ shares: number; link: string }>(
          `/api/posts/${post.id}/share`,
          { method: 'POST' },
        );
        setShares(response.shares);
        setActionMessage(
          shared ? 'Compartilhamento concluído.' : 'Link da publicação copiado.',
        );
      } catch (error) {
        setActionMessage(
          error instanceof ApiError
            ? `Compartilhamento concluído, mas ${error.message.toLowerCase()}`
            : 'Compartilhamento concluído, mas o contador não foi atualizado.',
        );
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

  async function handleFollowAuthor() {
    if (!post.user.username) return;
    try {
      const response = await apiRequest<{
        isFollowing: boolean;
        requested: boolean;
      }>(`/api/users/${encodeURIComponent(post.user.username)}/follow`, {
        method: 'POST',
      });
      setAuthorFollowing(response.isFollowing);
      setActionMessage(
        response.requested
          ? 'Solicitação de follow enviada.'
          : response.isFollowing
            ? `Agora você segue ${post.user.name}.`
            : `Você deixou de seguir ${post.user.name}.`,
      );
    } catch {
      setActionMessage('Não foi possível atualizar o follow.');
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

  function handleMediaPrev() {
    if (mediaIndex > 0) setMediaIndex((i) => i - 1);
  }

  function handleMediaNext() {
    if (mediaIndex < media.length - 1) setMediaIndex((i) => i + 1);
  }

  function openPost() {
    onOpen?.(post.id);
  }

  const postClasses = cn(
    'post-card rounded-card border border-border bg-surface transition-shadow hover:shadow-card',
    compact ? 'relative grid-item overflow-visible' : 'mx-auto w-[470px] max-w-full overflow-hidden',
  );

  /* Compact mode — grid do perfil (preserva comportamento atual). */
  if (compact) {
    return (
      <article className={cn(postClasses, 'group overflow-hidden')}>
        <div className="relative overflow-hidden rounded-t-[inherit]">
          {isTextOnly ? null : (
            <button
              type="button"
              className="relative block aspect-square w-full overflow-hidden bg-surface-subtle"
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
                <Image
                  src={safeMediaUrl}
                  alt={post.caption || `Foto de ${post.user.username}`}
                  fill
                  sizes="(min-width: 1280px) 428px, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
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
          )}

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
            aria-hidden="true"
          />

          <div className="absolute right-2 top-2 z-20">
            <DropdownMenu
              label="Mais opções da publicação"
              items={menuItems}
              align="end"
              trigger={<MoreHorizontal className="size-5 text-foreground drop-shadow-md" />}
            />
          </div>

          <div className="absolute right-2 bottom-2 left-2 z-10 flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => void handleLike()}
              disabled={pendingLike}
              aria-label={liked ? `Descurtir publicação (${likes})` : `Curtir publicação (${likes})`}
              aria-pressed={liked}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-black/55 px-3 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Heart
                aria-hidden="true"
                className={cn('size-4', liked && 'fill-danger text-danger')}
              />
              <strong data-like-count={post.id} aria-live="polite" aria-atomic="true">
                {likes}
              </strong>
            </button>

            <button
              type="button"
              onClick={openPost}
              aria-label={`Comentar publicação, ${commentsCount} comentários`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-black/55 px-3 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/75"
            >
              <MessageSquare aria-hidden="true" className="size-4" />
              <strong data-comment-count={post.id}>{commentsCount}</strong>
            </button>

            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={pendingShare}
              aria-label={`Compartilhar publicação, ${shares} compartilhamentos`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-black/55 px-3 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Share2 aria-hidden="true" className="size-4" />
              <strong data-share-count={post.id}>{shares}</strong>
            </button>
          </div>

          {actionMessage ? (
            <p
              className="absolute inset-x-3 bottom-14 z-10 rounded-lg bg-black/70 px-3 py-2 text-center text-xs leading-5 text-white backdrop-blur-sm"
              role="status"
              aria-live="polite"
            >
              {actionMessage}
            </p>
          ) : null}
        </div>
      </article>
    );
  }

  /* Instagram-style feed card (non-compact) */
  return (
    <article className={postClasses}>
      {/* Header compacto: avatar e informações têm dimensões fixas. */}
      <header className="relative mx-auto h-8 w-[446px] max-w-full">
        <button
          type="button"
          className="absolute left-0 top-0 flex size-8 shrink-0 items-center"
          onClick={() => router.push(`/perfil/${encodeURIComponent(post.user.username)}` as Route)}
          aria-label={`Ver perfil de ${post.user.name}`}
        >
          <span className="relative inline-flex size-8 shrink-0" aria-hidden="true">
            <Avatar
              src={post.user.avatar}
              alt=""
              name={post.user.name}
              size="xs"
              ring
              className="[&>span:first-child]:size-8 [&>span:first-child]:text-xs"
            />
          </span>
        </button>

        <div
          className="absolute left-2 right-2 top-1/2 h-[18px] -translate-y-1/2 overflow-hidden sm:left-10 sm:right-auto sm:w-[370px]"
          data-post-card-author-info
        >
          <div className="flex h-full min-w-0 items-center gap-1.5 overflow-hidden pr-[104px] leading-[18px]">
            <button
              type="button"
              className="min-w-0 truncate text-xs font-semibold text-foreground hover:underline"
              onClick={() => router.push(`/perfil/${encodeURIComponent(post.user.username)}` as Route)}
            >
              {post.user.username}
            </button>
            {post.user.verified ? (
              <BadgeCheck
                className="size-3 shrink-0 text-[var(--vibra-brand-fill)]"
                aria-label="Perfil verificado"
              />
            ) : null}
            <span className="shrink-0 text-[10px] leading-[18px] text-muted">
              · {formatRelativeTime(post.createdAt)}
            </span>
            <span className="min-w-0 truncate text-[10px] leading-[18px] text-muted">
              · {authorFollowing ? 'Seguindo' : 'Sugestões para você'}
            </span>
          </div>
        </div>

        <div className="absolute right-0 top-0 flex h-8 shrink-0 items-center gap-1">
          {!authorFollowing ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleFollowAuthor}
              className="h-8 w-[72px] px-0 text-[10px] whitespace-nowrap justify-center"
            >
              Seguir
            </Button>
          ) : null}
          <DropdownMenu
            label="Mais opções da publicação"
            items={menuItems}
            align="end"
            trigger={<MoreHorizontal className="size-4 text-muted" />}
            triggerClassName="size-7"
          />
        </div>
      </header>

      {/* Mídia / Carrossel */}
      {media.length > 0 && !isTextOnly ? (
        <div className="relative w-full">
          {hasMultiple && (
            <button
              type="button"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 inline-flex size-9 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
              onClick={handleMediaPrev}
              aria-label="Mídia anterior"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            className="relative block w-full overflow-hidden bg-surface-subtle"
            style={{ aspectRatio: '468 / 585' }}
            onClick={openPost}
            aria-label={`Abrir publicação de ${post.user.username}`}
          >
            {isVideo && safeMediaUrl ? (
              <video
                src={safeMediaUrl}
                muted
                playsInline
                preload="metadata"
                className="size-full w-full object-cover"
                aria-label={post.caption || 'Vídeo da publicação'}
              />
            ) : safeMediaUrl ? (
              <Image
                src={safeMediaUrl}
                alt={post.caption || `Foto de ${post.user.username}`}
                fill
                sizes="(min-width: 1280px) 428px, (min-width: 640px) 100vw, 100vw"
                className="object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-sm text-muted" aria-hidden="true">
                Mídia indisponível
              </span>
            )}

            {hasMultiple ? (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {media.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={cn(
                      'size-1.5 rounded-full transition-colors',
                      i === mediaIndex
                        ? 'bg-white w-5'
                        : 'bg-white/50 hover:bg-white/75',
                    )}
                    onClick={() => setMediaIndex(i)}
                    aria-label={`Ver mídia ${i + 1}`}
                  />
                ))}
              </div>
            ) : null}

            {isVideo ? (
              <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-pill bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
                Vídeo
              </span>
            ) : null}
          </button>

          {hasMultiple && (
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 inline-flex size-9 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
              onClick={handleMediaNext}
              aria-label="Próxima mídia"
            >
              <ArrowRight className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : isTextOnly ? (
        <button
          type="button"
          className="w-full aspect-[4/3] flex items-center justify-center bg-surface-subtle p-5 text-center"
          onClick={openPost}
          aria-label={`Abrir publicação de ${post.user.username}`}
        >
          <span className="line-clamp-6 text-sm leading-6 text-foreground">
            {post.caption || 'Publicação somente com texto'}
          </span>
        </button>
      ) : null}

      {/* Ações + Legenda */}
      <div className="flex flex-col gap-2 py-2 px-3">
        {/* Linha de ações com contadores */}
        <div className="flex h-[40px] w-[446px] max-w-full items-center gap-0.5" data-post-card-actions>
          <span className="relative inline-flex">
            <IconButton
              label={liked ? 'Descurtir' : 'Curtir'}
              icon={<Heart className={cn('size-5', liked && 'fill-danger text-danger')} />}
              tone={liked ? 'danger' : 'default'}
              pressed={liked}
              onClick={() => void handleLike()}
              disabled={pendingLike}
              className="size-10"
            />
            {likes > 0 && (
              <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-none text-on-brand">
                {likes > 99 ? '99+' : likes}
              </span>
            )}
          </span>

          <span className="relative inline-flex">
            <IconButton
              label="Comentar"
              icon={<MessageSquare className="size-5" />}
              onClick={() => setCommentOpen(true)}
              className="size-10"
            />
            {commentsCount > 0 && (
              <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold leading-none text-on-brand">
                {commentsCount > 99 ? '99+' : commentsCount}
              </span>
            )}
          </span>

          <span className="relative inline-flex">
            <IconButton
              label={reposted ? 'Desfazer repost' : 'Repostar'}
              icon={<Repeat className={cn('size-5', reposted && 'text-brand')} />}
              tone={reposted ? 'brand' : 'default'}
              pressed={reposted}
              onClick={() => void handleRepost()}
              disabled={pendingRepost}
              className="size-10"
            />
            {reposts > 0 && (
              <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold leading-none text-on-brand">
                {reposts > 99 ? '99+' : reposts}
              </span>
            )}
          </span>

          <div className="flex-1" />

          <IconButton
            label={saved ? 'Remover dos salvos' : 'Salvar'}
            icon={<Save className={cn('size-5', saved && 'text-brand fill-current')} />}
            tone={saved ? 'brand' : 'default'}
            pressed={saved}
            onClick={() => void handleSave()}
            disabled={pendingSave}
            className="size-10"
          />
          <IconButton
            label="Compartilhar"
            icon={<Share2 className="size-5" />}
            onClick={() => void handleShare()}
            disabled={pendingShare}
            className="size-10"
          />
        </div>

        {/* Contadores de engajamento */}
        {(likes > 0 || reposts > 0) && (
          <p className="flex items-baseline gap-2 text-sm text-muted">
            {likes > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="size-3.5 fill-danger text-danger" aria-hidden="true" />
                <strong>{likes}</strong>
                <span>{likes === 1 ? 'curtida' : 'curtidas'}</span>
              </span>
            )}
            {reposts > 0 && (
              <span className="flex items-center gap-1">
                <Repeat className="size-3.5 text-brand" aria-hidden="true" />
                <strong>{reposts}</strong>
                <span>{reposts === 1 ? 'repost' : 'reposts'}</span>
              </span>
            )}
          </p>
        )}

        {/* Legenda */}
        {post.caption ? (
          <div className="flex flex-col gap-1">
            <p
              className="caption min-h-[37px] w-[436px] max-w-full text-sm text-foreground"
              data-post-card-caption
            >
              <button
                type="button"
                className="inline-user font-semibold text-foreground hover:underline"
                onClick={() => router.push(`/perfil/${encodeURIComponent(post.user.username)}` as Route)}
              >
                {post.user.username}
              </button>{' '}
              {captionExpanded ? post.caption : (() => {
                const maxLen = 120;
                if (post.caption.length <= maxLen) return post.caption;
                return post.caption.slice(0, maxLen).trimEnd() + '…';
              })()}
            </p>
            {post.caption.length > 120 && (
              <button
                type="button"
                className="text-xs font-medium text-brand hover:underline self-start"
                onClick={() => setCaptionExpanded(!captionExpanded)}
              >
                {captionExpanded ? 'Mostrar menos' : '... mais'}
              </button>
            )}
          </div>
        ) : null}

        {/* Feedback de ações */}
        {actionMessage ? (
          <p className="text-xs leading-5 text-muted" role="status" aria-live="polite">
            {actionMessage}
          </p>
        ) : null}

        {/* Link copiado */}
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

        {/* Comentários */}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleComment();
                  }
                }}
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

        {commentsCount > 0 && (
          <button
            type="button"
            className="view-comments text-sm font-medium text-brand hover:underline"
            onClick={() => setCommentOpen(true)}
          >
            Ver {commentsCount} {commentsCount === 1 ? 'comentário' : 'comentários'}
          </button>
        )}
      </div>
    </article>
  );
}