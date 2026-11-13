'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Images, LoaderCircle, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Post, ExplorePerson } from '@/lib/types';

import { VideoPlayer } from './video-player';

type ViewMode = 'for-you' | 'following' | 'recent';

interface VideoFeedProps {
  forYouPosts: Post[];
  forYouCursor: number | null;
  followingPosts: Post[];
  followingCursor: number | null;
  autoplay?: boolean;
  forYouError?: string | null;
  onPostChange?: (post: Post) => void;
}

interface FeedState {
  posts: Post[];
  cursor: number | null;
}

const VIEWS: Array<{ id: ViewMode; label: string }> = [
  { id: 'for-you', label: 'Para você' },
  { id: 'following', label: 'Seguindo' },
  { id: 'recent', label: 'Recentes' },
];

function hasVisualMedia(post: Post): boolean {
  return (
    post.media?.some((media) => media.mediaType === 'image' || media.mediaType === 'video') ||
    post.mediaType === 'image' ||
    post.mediaType === 'video'
  );
}

function mergePosts(a: Post[], b: Post[]): Post[] {
  const seen = new Set<number>();
  const merged: Post[] = [];
  for (const post of [...a, ...b]) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    merged.push(post);
  }
  return merged;
}

export function VideoFeed({
  forYouPosts,
  forYouCursor,
  followingPosts,
  followingCursor,
  autoplay = true,
  forYouError = null,
  onPostChange,
}: VideoFeedProps) {
  const [view, setView] = useState<ViewMode>('for-you');
  const [forYouState, setForYouState] = useState<FeedState>({ posts: forYouPosts, cursor: forYouCursor });
  const [followingState, setFollowingState] = useState<FeedState>({ posts: followingPosts, cursor: followingCursor });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryingForYou, setRetryingForYou] = useState(false);
  const [forYouRecovered, setForYouRecovered] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<number, HTMLDivElement | null>());
  const loadingMoreRef = useRef(false);
  const pendingAdvanceRef = useRef(0);

  const activeState = useMemo<FeedState>(() => {
    if (view === 'following') return followingState;
    if (view === 'recent') {
      return {
        posts: mergePosts(forYouState.posts, followingState.posts).sort(
          (a, b) => b.createdAt - a.createdAt,
        ),
        cursor: forYouState.cursor ?? followingState.cursor,
      };
    }
    return forYouState;
  }, [view, forYouState, followingState]);

  const mediaPosts = useMemo(
    () => activeState.posts.filter(hasVisualMedia),
    [activeState.posts],
  );

  const selectedPost = mediaPosts.find((post) => post.id === selectedId) ?? mediaPosts[0] ?? null;
  const selectedIndex = selectedPost ? mediaPosts.findIndex((post) => post.id === selectedPost.id) : -1;

  const showForYouError = view === 'for-you' && Boolean(forYouError) && !forYouRecovered;

  const selectPost = useCallback((postId: number, behavior: ScrollBehavior = 'smooth') => {
    setSelectedId(postId);
    requestAnimationFrame(() => {
      const container = scrollRef.current;
      const element = itemRefs.current.get(postId);
      if (!container || !element) return;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const offsetTop = elementRect.top - containerRect.top + container.scrollTop;
      const targetTop = offsetTop - (container.clientHeight - element.offsetHeight) / 2;
      container.scrollTo({ top: Math.max(0, targetTop), behavior });
    });
  }, []);

  const loadMore = useCallback(async () => {
    if (activeState.cursor == null || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const endpoint = view === 'following' ? '/api/feed' : '/api/explore';
      const response = await apiRequest<{ posts: Post[]; nextCursor: number | null }>(
        `${endpoint}?before=${activeState.cursor}&limit=12&mediaType=image,video`,
      );
      const known = new Set(activeState.posts.map((post) => post.id));
      const fresh = response.posts.filter((post) => !known.has(post.id));
      const append = (state: FeedState): FeedState => ({
        posts: [...state.posts, ...fresh],
        cursor: response.nextCursor,
      });
      if (view === 'following') setFollowingState(append);
      else setForYouState(append);

      /* ArrowDown no último item carrega a página seguinte e avança para ela. */
      if (pendingAdvanceRef.current > 0) {
        const nextFresh = fresh.find(hasVisualMedia);
        if (nextFresh) {
          pendingAdvanceRef.current = 0;
          requestAnimationFrame(() => selectPost(nextFresh.id));
        }
      }
    } catch {
      pendingAdvanceRef.current = 0;
      setLoadError('Não foi possível carregar mais publicações.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [activeState.cursor, activeState.posts, selectPost, view]);

  const retryForYou = useCallback(async () => {
    if (retryingForYou) return;
    setRetryingForYou(true);
    try {
      const response = await apiRequest<{ posts: Post[]; nextCursor: number | null }>(
        '/api/explore?limit=12&mediaType=image,video',
      );
      setForYouState({ posts: response.posts, cursor: response.nextCursor });
      setForYouRecovered(true);
      setLoadError(null);
    } catch {
      setLoadError('Não foi possível recarregar as publicações recomendadas.');
    } finally {
      setRetryingForYou(false);
    }
  }, [retryingForYou]);

  const moveSelection = useCallback(
    (direction: 1 | -1) => {
      if (!mediaPosts.length) return;
      const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
      const nextIndex = currentIndex + direction;

      if (nextIndex < 0) {
        const firstPost = mediaPosts[0];
        if (firstPost) selectPost(firstPost.id);
        return;
      }

      if (nextIndex < mediaPosts.length) {
        const nextPost = mediaPosts[nextIndex];
        if (nextPost) selectPost(nextPost.id);
        return;
      }

      /* Último item carregado: busca próxima página e avança ao primeiro novo. */
      if (activeState.cursor != null && !loadingMoreRef.current) {
        pendingAdvanceRef.current = 1;
        void loadMore();
      }
    },
    [activeState.cursor, loadMore, mediaPosts, selectPost, selectedIndex],
  );

  // Único handler de teclado do feed.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="dialog"], [role="menu"]',
        )
      ) {
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveSelection]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const center = containerRect.top + container.clientHeight / 2;
      let closestId: number | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;
      for (const post of mediaPosts) {
        const element = itemRefs.current.get(post.id);
        if (!element) continue;
        const elementRect = element.getBoundingClientRect();
        const distance = Math.abs(elementRect.top + elementRect.height / 2 - center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestId = post.id;
        }
      }
      if (closestId !== null && closestId !== selectedId) setSelectedId(closestId);

      /* Perto do fim, carrega próxima página automaticamente. */
      const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (remaining < 600 && activeState.cursor != null && !loadingMoreRef.current) {
        void loadMore();
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeState.cursor, loadMore, mediaPosts, selectedId]);

  const selectView = useCallback((nextView: ViewMode) => {
    setView(nextView);
    setSelectedId(null);
    setLoadError(null);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePostChange = useCallback(
    (updatedPost: Post) => {
      const patch = (state: FeedState): FeedState => ({
        ...state,
        posts: state.posts.map((post) => (post.id === updatedPost.id ? updatedPost : post)),
      });
      setForYouState(patch);
      setFollowingState(patch);
      onPostChange?.(updatedPost);
    },
    [onPostChange],
  );

  const renderContent = () => {
    if (showForYouError && mediaPosts.length === 0) {
      return (
        <ErrorState
          title="Erro ao carregar publicações recomendadas"
          description={forYouError ?? 'Não foi possível carregar as publicações.'}
          onRetry={() => void retryForYou()}
          pending={retryingForYou}
        />
      );
    }

    if (mediaPosts.length === 0) {
      return (
        <EmptyState
          icon={<Images className="size-5" />}
          title="Ainda não há publicações neste recorte"
          description="Publique uma foto ou vídeo para começar. O feed usa apenas mídias reais cadastradas."
          action={
            <Button variant="secondary" onClick={() => selectView(view === 'for-you' ? 'following' : 'for-you')}>
              Trocar categoria
            </Button>
          }
        />
      );
    }

    return (
      <div
        ref={scrollRef}
        key={view}
        className="no-scrollbar h-[calc(100dvh-132px)] min-h-[620px] overflow-y-auto overscroll-contain p-3 sm:p-4"
        style={{ scrollSnapType: 'y proximity' }}
      >
        <div className="flex flex-col">
          {mediaPosts.map((post, index) => (
            <div
              key={post.id}
              ref={(element) => {
                if (element) itemRefs.current.set(post.id, element);
                else itemRefs.current.delete(post.id);
              }}
              className="flex min-h-[calc(100dvh-132px)] items-center justify-center scroll-snap-center scroll-mt-2"
            >
              <VideoPlayer
                post={post}
                index={index}
                isActive={selectedPost?.id === post.id}
                autoplay={autoplay}
                onNext={() => moveSelection(1)}
                onPostChange={handlePostChange}
              />
            </div>
          ))}
        </div>

        {showForYouError ? (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger/25 bg-danger-soft/50 px-4 py-3 text-sm text-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <TriangleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
              {forYouError}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void retryForYou()}
              disabled={retryingForYou}
              leadingIcon={<LoaderCircle className={cn('size-4', retryingForYou && 'animate-spin')} />}
            >
              {retryingForYou ? 'Tentando…' : 'Tentar novamente'}
            </Button>
          </div>
        ) : null}

        {loadError ? (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger/25 bg-danger-soft/50 px-4 py-3 text-sm text-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <TriangleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
              {loadError}
            </span>
            <Button variant="secondary" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {activeState.cursor ? (
          <div className="flex justify-center py-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              leadingIcon={<LoaderCircle className={cn('size-4', loadingMore && 'animate-spin')} />}
            >
              {loadingMore ? 'Carregando…' : 'Carregar mais publicações'}
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <section className="relative mx-auto w-full max-w-[620px]" aria-label="Publicações">
      <header className="sticky top-16 z-30 -mx-3 mb-5 border-b border-border/80 bg-background/88 px-3 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="flex items-center justify-between gap-4">
          <nav className="flex flex-wrap items-center gap-1" aria-label="Categorias de publicações">
            {VIEWS.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectView(item.id)}
                  className={cn(
                    'relative shrink-0 rounded-pill px-4 py-2 text-sm font-semibold transition-colors',
                    active ? 'text-foreground' : 'text-muted hover:text-foreground',
                  )}
                  aria-pressed={active}
                >
                  {item.label}
                  {active ? <span className="absolute inset-x-4 -bottom-[13px] h-0.5 rounded-full bg-brand" /> : null}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {renderContent()}
    </section>
  );
}
