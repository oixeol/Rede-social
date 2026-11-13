'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { apiRequest } from '@/lib/api';
import type { CommunityPost } from '@/lib/types';
import { CommunityPostCard } from './community-post-card';

interface CommunityFeedProps {
  communitySlug: string;
  communityName: string;
  communityAvatar?: string | null;
  currentUser: { id: number; username: string; name: string; avatar: string | null };
  initialPosts?: CommunityPost[];
  initialCursor?: number | null;
}

export function CommunityFeed({
  communitySlug,
  communityName,
  communityAvatar,
  currentUser,
  initialPosts = [],
  initialCursor = null,
}: CommunityFeedProps) {
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts);
  const [cursor, setCursor] = useState<number | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerText, setComposerText] = useState('');
  const [composerMedia, setComposerMedia] = useState<File[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [replyTo, setReplyTo] = useState<CommunityPost | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadPosts = useCallback(
    async (isLoadMore = false) => {
      if (loading || loadingMore) return;
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (cursor) params.set('cursor', String(cursor));
        params.set('limit', '20');
        const res = await apiRequest<{ posts: CommunityPost[]; nextCursor: number | null }>(
          `/api/communities/${encodeURIComponent(communitySlug)}/posts?${params.toString()}`
        );
        if (isLoadMore) {
          setPosts((prev) => [...prev, ...res.posts]);
        } else {
          setPosts(res.posts);
        }
        setCursor(res.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar posts');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [communitySlug, cursor, loading, loadingMore]
  );

  // Initial load
  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      loadPosts(false);
    }
  }, [loadPosts]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor && !loadingMore) {
          loadPosts(true);
        }
      },
      { rootMargin: '200px' }
    );
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [cursor, loadingMore, loadPosts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = composerText.trim();
    if (!text && composerMedia.length === 0) return;
    if (!showComposer && !replyTo) return;

    const formData = new FormData();
    formData.append('text', text);
    if (replyTo) formData.append('replyToId', String(replyTo.id));
    composerMedia.forEach((file) => formData.append('media', file));

    setComposerText('');
    setComposerMedia([]);
    setShowComposer(false);
    setReplyTo(null);

    try {
      const res = await apiRequest<{ post: CommunityPost }>(
        `/api/communities/${encodeURIComponent(communitySlug)}/posts`,
        { method: 'POST', body: formData }
      );
      setPosts((prev) => [res.post, ...prev]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar post');
    }
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + composerMedia.length > 4) {
      alert('Máximo 4 arquivos');
      return;
    }
    setComposerMedia((prev) => [...prev, ...files]);
  };

  const removeMedia = (idx: number) => {
    setComposerMedia((prev) => prev.filter((_, i) => i !== idx));
  };

  const startReply = (post: CommunityPost) => {
    setReplyTo(post);
    setShowComposer(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const cancelReply = () => {
    setReplyTo(null);
    setShowComposer(false);
    setComposerText('');
  };

  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Community Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-xl">
        <Link href={`/comunidades/${encodeURIComponent(communitySlug)}` as Route} className="shrink-0">
          {communityAvatar ? (
            <Image src={communityAvatar} alt="" width={40} height={40} className="rounded-full" unoptimized />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand font-bold">
              {communityName.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/comunidades/${encodeURIComponent(communitySlug)}` as Route} className="font-semibold truncate text-foreground hover:text-brand">
            {communityName}
          </Link>
          <p className="text-xs text-muted">Comunidade</p>
        </div>
        <Button size="sm" onClick={() => setShowComposer(true)} leadingIcon={<Plus className="size-4" />}>
          Postar
        </Button>
      </div>

      {/* Composer */}
      {(showComposer || replyTo) && (
        <form onSubmit={handleSubmit} className="border-b border-border p-4 bg-background">
          {replyTo && (
            <div className="mb-3 flex items-center gap-2 text-sm text-muted">
              <span>Respondendo a </span>
              <strong>@{replyTo.user.username}</strong>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5" onClick={cancelReply}>
                <X className="size-3.5" />
              </Button>
            </div>
          )}
          <div className="flex gap-3">
            <Avatar src={currentUser.avatar} alt={currentUser.name} name={currentUser.name} size="sm" />
            <div className="flex-1 min-w-0">
              <textarea
                ref={textareaRef}
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                placeholder={replyTo ? `Responder a @${replyTo.user.username}...` : 'O que está acontecendo?'}
                className="w-full min-h-[80px] resize-none rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                maxLength={280}
                rows={3}
              />
              {composerMedia.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
                  {composerMedia.map((file, idx) => (
                    <div key={idx} className="relative shrink-0 size-20 rounded-xl overflow-hidden">
                      {file.type.startsWith('video/') ? (
                        <video src={URL.createObjectURL(file)} muted playsInline className="size-full object-cover" />
                      ) : (
                        <Image src={URL.createObjectURL(file)} alt="" fill sizes="80px" className="object-cover" unoptimized />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(idx)}
                        className="absolute top-1 right-1 size-5 rounded-full bg-black/50 text-white flex items-center justify-center"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                multiple
                onChange={handleMediaChange}
                className="hidden"
                id={`composer-media-${communitySlug}`}
              />
              <label
                htmlFor={`composer-media-${communitySlug}`}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground cursor-pointer"
              >
                <Plus className="size-4" />
                Anexar
              </label>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={cancelReply}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!composerText.trim() && composerMedia.length === 0}>
                  {replyTo ? 'Responder' : 'Postar'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Posts Feed */}
      <div className="flex-1 overflow-y-auto">
        {error && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <p className="text-danger">Erro ao carregar: {error}</p>
            <Button variant="secondary" onClick={() => loadPosts(false)} className="mt-4">
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {posts.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <p className="text-muted">Nenhum post ainda. Seja o primeiro a postar!</p>
              </div>
            )}
            {posts.map((post) => (
              <CommunityPostCard
                key={post.id}
                post={post}
                currentUserId={currentUser.id}
                onPostChange={(updated) =>
                  setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                }
                onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                showCommunity={false}
              />
            ))}
            <div ref={loadMoreRef} className="h-4" />
            {loadingMore && <div className="flex justify-center py-4"><Loader2 className="size-6 animate-spin text-brand" /></div>}
            {cursor === null && posts.length > 0 && !loadingMore && (
              <p className="text-center text-xs text-muted py-4">Fim dos posts</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
