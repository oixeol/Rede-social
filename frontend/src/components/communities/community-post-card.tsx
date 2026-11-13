'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { useRef, useState } from 'react';
import {
  Heart,
  MessageSquare,
  Repeat,
  Share2,
  MoreHorizontal,
  Flag,
  Trash2,
  Edit,
  Bookmark,
} from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { apiRequest } from '@/lib/api';
import { formatRelativeTime, formatCount } from '@/lib/messages';
import type { CommunityPost } from '@/lib/types';

interface CommunityPostCardProps {
  post: CommunityPost;
  currentUserId: number;
  onPostChange?: (post: CommunityPost) => void;
  onDelete?: (postId: number) => void;
  showCommunity?: boolean;
}

export function CommunityPostCard({
  post,
  currentUserId,
  onPostChange,
  onDelete,
  showCommunity = false,
}: CommunityPostCardProps) {
  const isAuthor = post.userId === currentUserId;
  const [likeCount, setLikeCount] = useState(post.likesCount);
  const [repostCount, setRepostCount] = useState(post.repostsCount);
  const [liked, setLiked] = useState(post.liked);
  const [reposted, setReposted] = useState(post.reposted);
  const [replyCount, setReplyCount] = useState(post.repliesCount);
  const [pendingLike, setPendingLike] = useState(false);
  const [pendingRepost, setPendingRepost] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    const url = `${window.location.origin}/comunidades/${encodeURIComponent(post.communityId)}/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Post no Orbit', url });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLike = async () => {
    if (pendingLike) return;
    setPendingLike(true);
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((c) => (newLiked ? c + 1 : c - 1));
    try {
      if (newLiked) {
        await apiRequest(`/api/community-posts/${post.id}/like`, { method: 'POST' });
      } else {
        await apiRequest(`/api/community-posts/${post.id}/like`, { method: 'DELETE' });
      }
    } catch {
      setLiked(liked);
      setLikeCount((c) => (liked ? c + 1 : c - 1));
    } finally {
      setPendingLike(false);
    }
  };

  const handleRepost = async () => {
    if (pendingRepost) return;
    setPendingRepost(true);
    const newReposted = !reposted;
    setReposted(newReposted);
    setRepostCount((c) => (newReposted ? c + 1 : c - 1));
    try {
      if (newReposted) {
        await apiRequest(`/api/community-posts/${post.id}/repost`, { method: 'POST' });
      } else {
        await apiRequest(`/api/community-posts/${post.id}/repost`, { method: 'DELETE' });
      }
    } catch {
      setReposted(reposted);
      setRepostCount((c) => (reposted ? c + 1 : c - 1));
    } finally {
      setPendingRepost(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este post?')) return;
    try {
      await apiRequest(`/api/community-posts/${post.id}`, { method: 'DELETE' });
      onDelete?.(post.id);
    } catch (err) {
      alert('Erro ao excluir post');
    }
  };

  const menuItems: DropdownMenuItem[] = [
    ...(isAuthor
      ? [
          { id: 'edit', label: 'Editar', icon: <Edit className="size-4" />, onSelect: () => {} },
          { id: 'delete', label: 'Excluir', icon: <Trash2 className="size-4" />, destructive: true, onSelect: handleDelete },
        ]
      : [
          { id: 'report', label: 'Denunciar', icon: <Flag className="size-4" />, destructive: true, onSelect: () => {} },
          { id: 'bookmark', label: 'Salvar', icon: <Bookmark className="size-4" />, onSelect: () => {} },
        ]),
  ];

  return (
    <article className="flex gap-3 py-4 border-b border-border last:border-0">
      <Link href={`/perfil/${encodeURIComponent(post.user.username)}` as Route} className="shrink-0">
        <Avatar src={post.user.avatar} alt={post.user.name} name={post.user.name} size="md" online={undefined} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/perfil/${encodeURIComponent(post.user.username)}` as Route}
            className="font-semibold text-foreground hover:text-brand"
          >
            {post.user.name}
          </Link>
          {post.user.verified && (
            <span className="size-4 shrink-0 text-brand" aria-label="Verificado">✓</span>
          )}
          <span className="text-xs text-muted">@{post.user.username}</span>
          {showCommunity && post.communityId && (
            <span className="text-xs text-brand font-medium">#comunidade</span>
          )}
          <time className="text-xs text-muted" dateTime={new Date(post.createdAt).toISOString()}>
            {formatRelativeTime(post.createdAt)}
          </time>
        </div>
        {post.text && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{post.text}</p>}
        {post.media?.length && (
          <div className="mt-2 grid gap-2 grid-cols-2 max-w-xs">
            {post.media.slice(0, 4).map((m, idx) => (
              <div key={idx} className="relative aspect-square overflow-hidden rounded-xl bg-background-secondary">
                {m.mediaType === 'video' ? (
                  <video src={m.url} muted playsInline preload="metadata" className="size-full object-cover" />
                ) : (
                  <Image src={m.url} alt="" fill sizes="50vw" className="object-cover" unoptimized />
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-4 text-sm text-muted">
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-1.5 h-8 px-2', liked && 'text-danger', reposted && 'text-brand')}
            onClick={handleLike}
            disabled={pendingLike}
            aria-pressed={liked}
            aria-label={liked ? 'Descurtir' : 'Curtir'}
          >
            <Heart className={cn('size-4', liked && 'fill-current')} />
            <span>{formatCount(likeCount)}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn('gap-1.5 h-8 px-2', reposted && 'text-brand')}
            onClick={handleRepost}
            disabled={pendingRepost}
            aria-pressed={reposted}
            aria-label={reposted ? 'Desfazer repost' : 'Repost'}
          >
            <Repeat className="size-4" />
            <span>{formatCount(repostCount)}</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2" onClick={handleShare} aria-label={copied ? 'Copiado!' : 'Compartilhar'}>
            <Share2 className="size-4" />
            {copied && <span className="text-xs text-brand">Copiado</span>}
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu
              items={menuItems}
              trigger={
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" leadingIcon={<MoreHorizontal className="size-4" />} aria-label="Mais opções" />
              }
              triggerClassName="ml-1"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
