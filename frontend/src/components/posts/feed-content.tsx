'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { LoaderCircle } from 'lucide-react';

import { PostCard } from './post-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/api';
import type { Post } from '@/lib/types';

interface FeedContentProps {
  forYouPosts: Post[];
  forYouCursor: number | null;
  followingPosts: Post[];
  followingCursor: number | null;
}

function FeedTabContent({
  posts,
  cursor,
  onLoadMore,
  loadingMore,
  error,
  emptyTitle,
  emptyDescription,
  observerTargetRef,
  onOpenPost,
}: {
  posts: Post[];
  cursor: number | null;
  onLoadMore: () => void;
  loadingMore: boolean;
  error: string | null;
  emptyTitle: string;
  emptyDescription: string;
  observerTargetRef: React.RefObject<HTMLDivElement | null>;
  onOpenPost: (postId: number) => void;
}) {
  if (posts.length === 0 && !loadingMore && !error) {
    return (
      <EmptyState
        icon={<LoaderCircle className="size-5" />}
        title={emptyTitle}
        description={emptyDescription}
        action={
          <Button variant="primary" onClick={onLoadMore}>
            Carregar
          </Button>
        }
      />
    );
  }
  if (error) {
    return <ErrorState title="Erro ao carregar o feed" description={error} onRetry={onLoadMore} pending={loadingMore} />;
  }
  return (
    <>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onOpen={onOpenPost} />
      ))}
      {(cursor && !loadingMore && !error) ? (
        <div ref={observerTargetRef} className="flex justify-center py-4">
          <Button variant="ghost" size="sm" leadingIcon={<LoaderCircle className="size-3.5 animate-spin" />}>
            Carregar mais
          </Button>
        </div>
      ) : loadingMore ? (
        <div ref={observerTargetRef} className="flex justify-center py-4">
          <Button variant="ghost" size="sm" disabled leadingIcon={<LoaderCircle className="size-3.5 animate-spin" />}>
            Carregando…
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function FeedContent({ forYouPosts, forYouCursor, followingPosts, followingCursor }: FeedContentProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');

  const onOpenPost = useCallback((postId: number) => {
    router.push(`/publicacoes/${postId}` as Route);
  }, [router]);

  // Estado interno sincronizado com props do servidor
  const [forYouPostsState, setForYouPostsState] = useState<Post[]>(forYouPosts);
  const [forYouCursorState, setForYouCursorState] = useState<number | null>(forYouCursor);
  const [followingPostsState, setFollowingPostsState] = useState<Post[]>(followingPosts);
  const [followingCursorState, setFollowingCursorState] = useState<number | null>(followingCursor);
  const [prevForYouPosts, setPrevForYouPosts] = useState<Post[]>(forYouPosts);
  const [prevFollowingPosts, setPrevFollowingPosts] = useState<Post[]>(followingPosts);

  const [forYouLoading, setForYouLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [forYouError, setForYouError] = useState<string | null>(null);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const forYouObserverRef = useRef<HTMLDivElement | null>(null);
  const followingObserverRef = useRef<HTMLDivElement | null>(null);

  // Sincronização com props do servidor (padrão React: ajustar state durante o render)
  if (forYouPosts !== prevForYouPosts) {
    setPrevForYouPosts(forYouPosts);
    setForYouPostsState(forYouPosts);
  }
  if (followingPosts !== prevFollowingPosts) {
    setPrevFollowingPosts(followingPosts);
    setFollowingPostsState(followingPosts);
  }

  const loadForYou = useCallback(async () => {
    if (!forYouCursorState || forYouLoading) return;
    setForYouLoading(true);
    setForYouError(null);
    try {
      const res = await apiRequest<{ posts: Post[]; nextCursor: number | null }>(
        `/api/explore?before=${forYouCursorState}&limit=12`,
      );
      const known = new Set(forYouPostsState.map((p) => p.id));
      const fresh = res.posts.filter((p) => !known.has(p.id));
      if (fresh.length) {
        setForYouPostsState((prev) => [...prev, ...fresh]);
      }
      setForYouCursorState(res.nextCursor);
    } catch (err) {
      setForYouError('Não foi possível carregar mais publicações.');
    } finally {
      setForYouLoading(false);
    }
  }, [forYouCursorState, forYouLoading, forYouPostsState]);

  const loadFollowing = useCallback(async () => {
    if (!followingCursorState || followingLoading) return;
    setFollowingLoading(true);
    setFollowingError(null);
    try {
      const res = await apiRequest<{ posts: Post[]; nextCursor: number | null }>(
        `/api/feed?before=${followingCursorState}&limit=12`,
      );
      const known = new Set(followingPostsState.map((p) => p.id));
      const fresh = res.posts.filter((p) => !known.has(p.id));
      if (fresh.length) {
        setFollowingPostsState((prev) => [...prev, ...fresh]);
      }
      setFollowingCursorState(res.nextCursor);
    } catch (err) {
      setFollowingError('Não foi possível carregar mais publicações.');
    } finally {
      setFollowingLoading(false);
    }
  }, [followingCursorState, followingLoading, followingPostsState]);

  useEffect(() => {
    if (!forYouCursorState) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadForYou();
      },
      { rootMargin: '200px' },
    );
    if (forYouObserverRef.current) observer.observe(forYouObserverRef.current);
    return () => observer.disconnect();
  }, [forYouCursorState, loadForYou]);

  useEffect(() => {
    if (!followingCursorState) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadFollowing();
      },
      { rootMargin: '200px' },
    );
    if (followingObserverRef.current) observer.observe(followingObserverRef.current);
    return () => observer.disconnect();
  }, [followingCursorState, loadFollowing]);

  // Escuta evento de publicação nova (disparado pelo Composer) e adiciona otimisticamente
  useEffect(() => {
    function handleNewPost(event: CustomEvent<Post>) {
      const post = event.detail;
      setForYouPostsState((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
      setFollowingPostsState((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
    }
    window.addEventListener('vibra:post-published', handleNewPost as EventListener);
    return () => window.removeEventListener('vibra:post-published', handleNewPost as EventListener);
  }, []);

  const tabs: TabItem[] = [
    { id: 'for-you', label: 'Para você' },
    { id: 'following', label: 'Seguindo' },
  ];

  return (
    <section aria-label="Publicações" className="space-y-5">
      <Tabs
        label="Filtro do feed"
        items={tabs}
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'for-you' | 'following')}
      >
        {activeTab === 'for-you' ? (
          <FeedTabContent
            posts={forYouPostsState}
            cursor={forYouCursorState}
            onLoadMore={loadForYou}
            loadingMore={forYouLoading}
            error={forYouError}
            emptyTitle="Descubra novos conteúdos"
            emptyDescription="Ainda não há publicações recomendadas. Explore interesses ou siga pessoas para ver mais."
            observerTargetRef={forYouObserverRef}
            onOpenPost={onOpenPost}
          />
        ) : (
          <FeedTabContent
            posts={followingPostsState}
            cursor={followingCursorState}
            onLoadMore={loadFollowing}
            loadingMore={followingLoading}
            error={followingError}
            emptyTitle="O seu feed está vazio"
            emptyDescription="Siga pessoas para ver as publicações delas aqui."
            observerTargetRef={followingObserverRef}
            onOpenPost={onOpenPost}
          />
        )}
      </Tabs>
    </section>
  );
}