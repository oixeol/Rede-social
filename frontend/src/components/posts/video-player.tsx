'use client';

import { useEffect, useRef, useState, useCallback, useId } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import {
  Heart,
  MessageSquare,
  Share2,
  Save,
  MoreHorizontal,
  Play,
  Volume2,
  VolumeX,
  Music,
  Flag,
  X,
  Send,
  LoaderCircle,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { apiRequest, ApiError } from '@/lib/api';
import { isSafeMediaSource } from '@/lib/media';
import type { Post } from '@/lib/types';

export interface VideoPlayerProps {
  post: Post;
  index: number;
  isActive: boolean;
  autoplay?: boolean;
  onNext: () => void;
  onClose?: () => void;
  onPostChange?: (post: Post) => void;
}

export function VideoPlayer({
  post,
  index,
  isActive,
  autoplay = true,
  onNext,
  onClose,
  onPostChange,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [prevPostId, setPrevPostId] = useState(post.id);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [commentsCount, setCommentsCount] = useState(post.comments);
  const [sharesCount, setSharesCount] = useState(post.shares ?? 0);
  const [saved, setSaved] = useState(post.saved ?? false);
  const [saves, setSaves] = useState(post.saves ?? 0);
  const [followState, setFollowState] = useState<'idle' | 'requested' | 'following'>(
    post.authorFollowing ? 'following' : post.authorFollowRequested ? 'requested' : 'idle',
  );
  const [showComments, setShowComments] = useState(false);
  const [pendingLike, setPendingLike] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [pendingFollow, setPendingFollow] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Sync internal state during render when post prop changes
  if (post.id !== prevPostId) {
    setPrevPostId(post.id);
    setLiked(post.liked);
    setLikes(post.likes);
    setCommentsCount(post.comments);
    setSharesCount(post.shares ?? 0);
    setSaved(post.saved ?? false);
    setSaves(post.saves ?? 0);
    setFollowState(
      post.authorFollowing ? 'following' : post.authorFollowRequested ? 'requested' : 'idle',
    );
  }

  // Autoplay management: ONLY active video plays when autoplay prop is true.
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isActive && autoplay) {
      vid.playsInline = true;
      const attempt = vid.play();
      if (attempt) {
        attempt
          .then(() => setPlaying(true))
          .catch(() => {
            // Browser blocked audible autoplay: retry muted.
            vid.muted = true;
            setMuted(true);
            const retry = vid.play();
            if (retry) {
              retry.then(() => setPlaying(true)).catch(() => setPlaying(false));
            }
          });
      }
    } else {
      // Pausing triggers the `pause` event, which keeps `playing` in sync.
      vid.pause();
    }
  }, [isActive, autoplay]);

  useEffect(() => {
    const vid = videoRef.current;
    if (vid) vid.muted = muted;
  }, [muted]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const handleTimeUpdate = () => {
      setCurrentTime(vid.currentTime);
      if (vid.duration > 0) {
        setProgress((vid.currentTime / vid.duration) * 100);
      }
    };
    const handleLoadedMetadata = () => {
      setDuration(vid.duration);
    };
    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);

    vid.addEventListener('timeupdate', handleTimeUpdate);
    vid.addEventListener('loadedmetadata', handleLoadedMetadata);
    vid.addEventListener('play', handlePlay);
    vid.addEventListener('pause', handlePause);

    /* Metadata pode ter carregado antes do listener. Sincroniza estado inicial. */
    if (vid.readyState >= 1) handleLoadedMetadata();
    if (vid.readyState >= 2) handleTimeUpdate();
    if (!vid.paused) handlePlay();

    return () => {
      vid.removeEventListener('timeupdate', handleTimeUpdate);
      vid.removeEventListener('loadedmetadata', handleLoadedMetadata);
      vid.removeEventListener('play', handlePlay);
      vid.removeEventListener('pause', handlePause);
    };
  }, []);

  const notifyChange = useCallback(
    (overrides: Partial<Post>) => {
      if (!onPostChange) return;
      onPostChange({
        ...post,
        liked,
        likes,
        comments: commentsCount,
        shares: sharesCount,
        saved,
        saves,
        authorFollowing: followState === 'following',
        authorFollowRequested: followState === 'requested',
        ...overrides,
      });
    },
    [onPostChange, post, liked, likes, commentsCount, sharesCount, saved, saves, followState],
  );

  const togglePlay = useCallback(() => {
    if (!isActive) return;
    const vid = videoRef.current;
    if (!vid) return;
    if (playing) {
      vid.pause();
      setPlaying(false);
    } else {
      vid
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }, [isActive, playing]);

  const toggleMute = useCallback(() => {
    if (!isActive) return;
    const vid = videoRef.current;
    if (!vid) return;
    const nextMuted = !muted;
    vid.muted = nextMuted;
    setMuted(nextMuted);
  }, [isActive, muted]);

  const handleLike = async () => {
    if (!isActive || pendingLike) return;
    setPendingLike(true);
    const prevLiked = liked;
    const prevLikes = likes;
    const nextLiked = !liked;
    const nextLikes = liked ? Math.max(0, likes - 1) : likes + 1;

    setActionMessage(null);
    setLiked(nextLiked);
    setLikes(nextLikes);

    try {
      const res = await apiRequest<{ liked: boolean; likes: number }>(`/api/posts/${post.id}/like`, {
        method: 'POST',
      });
      setLiked(res.liked);
      setLikes(res.likes);
      notifyChange({ liked: res.liked, likes: res.likes });
    } catch (error) {
      setLiked(prevLiked);
      setLikes(prevLikes);
      setActionMessage(error instanceof ApiError ? error.message : 'Não foi possível atualizar a curtida.');
    } finally {
      setPendingLike(false);
    }
  };

  const handleSave = async () => {
    if (!isActive || pendingSave) return;
    setPendingSave(true);
    const prevSaved = saved;
    const prevSaves = saves;
    const nextSaved = !saved;
    const nextSaves = saved ? Math.max(0, saves - 1) : saves + 1;

    setActionMessage(null);
    setSaved(nextSaved);
    setSaves(nextSaves);

    try {
      const res = await apiRequest<{ saved: boolean; saves: number }>(`/api/posts/${post.id}/save`, {
        method: 'POST',
      });
      setSaved(res.saved);
      setSaves(res.saves);
      notifyChange({ saved: res.saved, saves: res.saves });
    } catch (error) {
      setSaved(prevSaved);
      setSaves(prevSaves);
      setActionMessage(error instanceof ApiError ? error.message : 'Não foi possível salvar a publicação.');
    } finally {
      setPendingSave(false);
    }
  };

  const handleFollowAuthor = async () => {
    if (!isActive || !post.user.username || pendingFollow) return;
    setPendingFollow(true);
    const prevFollowState = followState;
    setActionMessage(null);

    try {
      const res = await apiRequest<{
        isFollowing: boolean;
        requested: boolean;
        cancelled?: boolean;
      }>(`/api/users/${encodeURIComponent(post.user.username)}/follow`, {
        method: 'POST',
      });

      let nextState: 'idle' | 'requested' | 'following' = 'idle';
      if (res.requested) nextState = 'requested';
      else if (res.isFollowing) nextState = 'following';

      setFollowState(nextState);
      notifyChange({
        authorFollowing: res.isFollowing,
        authorFollowRequested: res.requested,
      });

      setActionMessage(
        res.requested
          ? 'Solicitação de follow enviada.'
          : res.cancelled
          ? 'Solicitação de follow cancelada.'
          : res.isFollowing
          ? `Agora você segue ${post.user.name}.`
          : `Você deixou de seguir ${post.user.name}.`,
      );
    } catch (error) {
      setFollowState(prevFollowState);
      setActionMessage(error instanceof ApiError ? error.message : 'Não foi possível atualizar o follow.');
    } finally {
      setPendingFollow(false);
    }
  };

  const handleShare = async () => {
    if (!isActive) return;
    setActionMessage(null);
    const canonicalUrl = new URL(`/publicacoes/${post.id}`, window.location.origin).toString();

    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Publicação no Orbit',
            text: post.caption || 'Veja esta publicação no Orbit.',
            url: canonicalUrl,
          });
          const res = await apiRequest<{ shares: number }>(`/api/posts/${post.id}/share`, {
            method: 'POST',
          });
          setSharesCount(res.shares);
          notifyChange({ shares: res.shares });
          setActionMessage('Compartilhamento concluído.');
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === 'AbortError') {
            setActionMessage('Compartilhamento cancelado.');
            return;
          }
        }
      }

      if (!navigator.clipboard || !window.isSecureContext) {
        throw new Error('Clipboard indisponível.');
      }
      await navigator.clipboard.writeText(canonicalUrl);
      const res = await apiRequest<{ shares: number }>(`/api/posts/${post.id}/share`, {
        method: 'POST',
      });
      setSharesCount(res.shares);
      notifyChange({ shares: res.shares });
      setActionMessage('Link da publicação copiado.');
    } catch (error) {
      setActionMessage(error instanceof ApiError ? error.message : 'Não foi possível compartilhar a publicação.');
    }
  };

  const reportPost = async () => {
    if (!isActive) return;
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
      setActionMessage(error instanceof ApiError ? error.message : 'Não foi possível denunciar a publicação.');
    }
  };

  const media = post.media?.length
    ? post.media
    : post.image
    ? [{ url: post.image, mediaType: post.mediaType }]
    : [];
  const visualMedia = media.find(
    (item) => item.mediaType === 'image' || item.mediaType === 'video',
  );
  const mediaUrl = visualMedia?.url;
  const safeMediaUrl = mediaUrl && isSafeMediaSource(mediaUrl) ? mediaUrl : null;
  const isVideo = visualMedia?.mediaType === 'video';

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const moreMenuItems: DropdownMenuItem[] = [
    {
      id: 'share',
      label: 'Compartilhar publicação',
      icon: <Share2 className="size-4" />,
      disabled: !isActive,
      onSelect: () => void handleShare(),
    },
    {
      id: 'report',
      label: 'Denunciar conteúdo',
      icon: <Flag className="size-4" />,
      disabled: !isActive,
      onSelect: () => void reportPost(),
    },
  ];

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative mx-auto flex max-w-full items-center justify-center',
        'aspect-[9/16] overflow-hidden bg-background',
      )}
      style={{ width: 'min(100%, calc((100dvh - 196px) * 9 / 16))' }}
      role="region"
      aria-label={`Publicação ${index + 1}`}
    >
      {safeMediaUrl ? (
        isVideo ? (
          <video
            ref={videoRef}
            src={safeMediaUrl}
            className="size-full object-cover"
            playsInline
            muted={muted}
            onClick={togglePlay}
            onEnded={onNext}
            aria-label={post.caption || 'Publicação'}
          />
        ) : (
          <Image
            src={safeMediaUrl}
            alt={post.caption || `Foto da publicação de ${post.user.name}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 620px"
            className="object-cover"
            priority={index < 2}
            unoptimized
          />
        )
      ) : (
        <div
          className="size-full bg-surface-subtle"
          role="img"
          aria-label={`Mídia indisponível na publicação de ${post.user.name}`}
        />
      )}

      {isVideo && (
        <>
          <div className="absolute top-4 right-4 z-20">
            <IconButton
              label={muted ? 'Ativar som' : 'Desativar som'}
              icon={muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              onClick={toggleMute}
              disabled={!isActive}
              className="bg-black/40 text-white hover:bg-black/60 backdrop-blur-md"
            />
          </div>

          <div
            className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-brand transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="absolute bottom-2 left-4 right-4 flex justify-between text-xs text-white/80 px-2 z-20 pointer-events-none">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </>
      )}

      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-5 z-20">
        <span className="relative inline-flex flex-col items-center gap-1.5">
          <IconButton
            label={liked ? 'Descurtir' : 'Curtir'}
            icon={<Heart className={cn('size-7', liked && 'fill-danger text-danger')} />}
            tone={liked ? 'danger' : 'default'}
            pressed={liked}
            onClick={handleLike}
            disabled={!isActive || pendingLike}
            className="drop-shadow-lg text-white hover:text-white"
          />
          {likes > 0 && (
            <span className="text-white font-semibold text-xs drop-shadow">
              {likes > 999 ? `${(likes / 1000).toFixed(1)}k` : likes}
            </span>
          )}
        </span>

        <span className="relative inline-flex flex-col items-center gap-1.5">
          <IconButton
            label="Comentários"
            icon={<MessageSquare className="size-7" />}
            onClick={() => setShowComments(true)}
            disabled={!isActive}
            className="drop-shadow-lg text-white hover:text-white"
          />
          {commentsCount > 0 && (
            <span className="text-white font-semibold text-xs drop-shadow">
              {commentsCount > 999 ? `${(commentsCount / 1000).toFixed(1)}k` : commentsCount}
            </span>
          )}
        </span>

        <span className="relative inline-flex flex-col items-center gap-1.5">
          <IconButton
            label="Compartilhar"
            icon={<Share2 className="size-7" />}
            onClick={handleShare}
            disabled={!isActive}
            className="drop-shadow-lg text-white hover:text-white"
          />
          {sharesCount > 0 && (
            <span className="text-white font-semibold text-xs drop-shadow">
              {sharesCount > 999 ? `${(sharesCount / 1000).toFixed(1)}k` : sharesCount}
            </span>
          )}
        </span>

        <span className="relative inline-flex flex-col items-center gap-1.5">
          <IconButton
            label={saved ? 'Remover dos salvos' : 'Salvar'}
            icon={<Save className={cn('size-7', saved && 'text-brand fill-current')} />}
            tone={saved ? 'brand' : 'default'}
            pressed={saved}
            onClick={handleSave}
            disabled={!isActive || pendingSave}
            className="drop-shadow-lg text-white hover:text-white"
          />
          {saves > 0 && (
            <span className="text-white font-semibold text-xs drop-shadow">
              {saves}
            </span>
          )}
        </span>

        <DropdownMenu
          label="Mais opções"
          items={moreMenuItems}
          align="end"
          disabled={!isActive}
          trigger={<MoreHorizontal className="size-7 text-white drop-shadow-lg" />}
          triggerClassName={cn('size-11', !isActive && 'pointer-events-none opacity-50')}
        />
      </div>

      <div className="absolute bottom-12 left-4 right-20 flex flex-col gap-2 z-20 max-w-[320px]">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href={`/perfil/${encodeURIComponent(post.user.username)}` as Route}
            className={cn('flex items-center gap-2 group', !isActive && 'pointer-events-none')}
            aria-label={`Ver perfil de ${post.user.name}`}
            tabIndex={isActive ? 0 : -1}
          >
            <Avatar src={post.user.avatar} alt="" name={post.user.name} size="sm" ring />
            <div className="flex flex-col min-w-0">
              <span className="text-white font-semibold text-sm truncate max-w-[160px] group-hover:underline">
                {post.user.name}
              </span>
              <span className="text-white/70 text-xs truncate max-w-[160px]">
                @{post.user.username}
              </span>
            </div>
          </Link>

          <Button
            size="sm"
            variant={followState === 'idle' ? 'primary' : 'secondary'}
            onClick={handleFollowAuthor}
            disabled={!isActive || pendingFollow}
            className={cn(
              'h-7 px-3 text-xs whitespace-nowrap',
              followState === 'idle'
                ? 'bg-brand text-on-brand hover:bg-brand-fill-hover'
                : 'bg-white/15 border-white/20 text-white hover:bg-white/25',
            )}
          >
            {pendingFollow
              ? '...'
              : followState === 'requested'
              ? 'Solicitado'
              : followState === 'following'
              ? 'Seguindo'
              : 'Seguir'}
          </Button>
        </div>

        {post.caption ? (
          <p className="text-white text-sm leading-relaxed max-h-[3.5rem] overflow-hidden text-balance">
            {post.caption}
          </p>
        ) : null}

        {isVideo ? (
          <div className="flex items-center gap-2 text-white/75 text-xs">
            <Music className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate max-w-[200px]">
              {post.topic ? `Áudio: ${post.topic}` : 'Áudio não identificado'}
            </span>
          </div>
        ) : null}
      </div>

      {actionMessage ? (
        <div
          className="absolute top-24 inset-x-4 z-30 rounded-xl bg-black/80 px-4 py-2 text-center text-xs text-white backdrop-blur-md shadow-lg"
          role="status"
          aria-live="polite"
        >
          {actionMessage}
        </div>
      ) : null}

      {isVideo && !playing && (
        <button
          type="button"
          disabled={!isActive}
          className="absolute inset-0 flex items-center justify-center bg-black/30 z-10 w-full h-full cursor-pointer disabled:cursor-not-allowed"
          onClick={togglePlay}
          aria-label="Reproduzir publicação"
        >
          <Play className="size-16 text-white/90 drop-shadow-xl" aria-hidden="true" />
        </button>
      )}

      {showComments && (
        <CommentsModal
          postId={post.id}
          onClose={() => setShowComments(false)}
          onCountChange={(count) => {
            setCommentsCount(count);
            notifyChange({ comments: count });
          }}
        />
      )}
    </div>
  );
}

function CommentsModal({
  postId,
  onClose,
  onCountChange,
}: {
  postId: number;
  onClose: () => void;
  onCountChange: (count: number) => void;
}) {
  const [comments, setComments] = useState<
    Array<{
      id: number;
      text: string;
      createdAt: number;
      user: { id: number; username: string; name: string; avatar: string | null };
    }>
  >([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const onCountChangeRef = useRef(onCountChange);
  const titleId = useId();

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || !modal.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;

    apiRequest<{ comments: typeof comments }>(`/api/posts/${postId}/comments`)
      .then((res) => {
        if (!active) return;
        setComments(res.comments);
        onCountChangeRef.current(res.comments.length);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setLoading(false);
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os comentários.');
      });

    return () => {
      active = false;
    };
  }, [postId, reloadToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newComment.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await apiRequest<{
        comment: (typeof comments)[0];
        comments: number;
      }>(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: { text },
      });

      setComments((prev) => [res.comment, ...prev]);
      onCountChange(res.comments);
      setNewComment('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o comentário.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md md:max-w-lg h-[75vh] md:h-[80vh] bg-surface rounded-t-[1.5rem] md:rounded-[1.25rem] shadow-float flex flex-col overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 id={titleId} className="font-display text-base font-semibold text-foreground">
            Comentários
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-surface-raised flex items-center justify-center text-foreground hover:bg-surface-subtle transition-colors"
            aria-label="Fechar comentários"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4" role="list" aria-label="Lista de comentários">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Carregando comentários…
            </div>
          ) : error ? (
            <div className="p-4 text-center text-sm text-danger flex flex-col items-center gap-3" role="alert">
              {error}
              <Button variant="secondary" size="sm" onClick={() => { setLoading(true); setError(null); setReloadToken((v) => v + 1); }}>
                Tentar novamente
              </Button>
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">Nenhum comentário ainda. Seja o primeiro a comentar!</p>
          ) : (
            comments.map((c) => (
              <article key={c.id} className="flex gap-3" role="listitem">
                <Link href={`/perfil/${encodeURIComponent(c.user.username)}` as Route} className="shrink-0">
                  <Avatar src={c.user.avatar} alt="" name={c.user.name} size="sm" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/perfil/${encodeURIComponent(c.user.username)}` as Route}
                      className="font-semibold text-xs text-foreground hover:underline truncate"
                    >
                      {c.user.name}
                    </Link>
                    <span className="text-[11px] text-muted truncate">@{c.user.username}</span>
                  </div>
                  <p className="text-xs text-foreground mt-0.5 leading-relaxed break-words">{c.text}</p>
                </div>
              </article>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-border p-3 space-y-2 bg-surface-raised">
          {error && comments.length > 0 ? (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <label htmlFor="comment-input" className="sr-only">
              Escreva um comentário
            </label>
            <input
              ref={inputRef}
              id="comment-input"
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Adicione um comentário…"
              className="flex-1 h-9 px-3.5 rounded-pill bg-surface-subtle border border-border text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
              disabled={sending}
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={!newComment.trim() || sending}
              className="h-9 px-3"
              leadingIcon={sending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            >
              {sending ? 'Enviando' : 'Enviar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
