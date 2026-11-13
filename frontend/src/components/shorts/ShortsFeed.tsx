'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Short, ShortsResponse } from '@/lib/types';
import { getShorts, likeShort, unlikeShort, recordShortView, getShortManifest } from '@/lib/api';
import { cn } from '@/lib/cn';

interface ShortsFeedProps {
  initialShorts?: Short[];
  onShortClick?: (short: Short) => void;
}

export function ShortsFeed({ initialShorts = [], onShortClick }: ShortsFeedProps) {
  const [shorts, setShorts] = useState<Short[]>(initialShorts);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const currentIndexRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || !nextCursor) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await getShorts(nextCursor, 10);
      if (res.shorts.length === 0) {
        setHasMore(false);
      } else {
        setShorts((prev) => [...prev, ...res.shorts]);
        setNextCursor(res.nextCursor);
      }
    } catch (err) {
      console.error('[ShortsFeed] Load more failed:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [hasMore, nextCursor]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const lastEntry = entries[entries.length - 1];
        if (lastEntry.isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.5, rootMargin: '100px' }
    );
    observerRef.current = observer;

    // Observe the last short element
    const lastVideo = document.querySelector('[data-short-last="true"]');
    if (lastVideo) observer.observe(lastVideo);

    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

  // Auto-play/pause based on visibility
  useEffect(() => {
    const videos = Array.from(videoRefs.current.values());
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    videos.forEach((v) => observer.observe(v));
    return () => observer.disconnect();
  }, [shorts.length]);

  const handleLike = async (shortId: number, currentlyLiked: boolean) => {
    try {
      if (currentlyLiked) {
        await unlikeShort(shortId);
      } else {
        await likeShort(shortId);
      }
      setShorts((prev) =>
        prev.map((s) =>
          s.id === shortId
            ? { ...s, liked: !currentlyLiked, likesCount: currentlyLiked ? s.likesCount - 1 : s.likesCount + 1 }
            : s
        )
      );
    } catch (err) {
      console.error('[ShortsFeed] Like failed:', err);
    }
  };

  const handleView = async (shortId: number, watchTime: number) => {
    try {
      await recordShortView(shortId, watchTime);
      setShorts((prev) =>
        prev.map((s) => (s.id === shortId ? { ...s, viewsCount: s.viewsCount + 1 } : s))
      );
    } catch (err) {
      console.error('[ShortsFeed] View record failed:', err);
    }
  };

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>, short: Short) => {
    const video = e.currentTarget;
    // Record view progress every 5 seconds
    if (Math.floor(video.currentTime) % 5 === 0) {
      handleView(short.id, video.currentTime);
    }
  };

  const handleVideoEnded = (short: Short) => {
    handleView(short.id, short.duration);
    // Auto-advance to next short
    if (currentIndexRef.current < shorts.length - 1) {
      currentIndexRef.current += 1;
    } else if (hasMore) {
      loadMore();
    }
  };

  const getVideoUrl = (short: Short) => {
    if (short.hlsManifestUrl) return short.hlsManifestUrl;
    return '';
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {shorts.length === 0 ? (
        <div className="flex items-center justify-center h-full text-white">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-4 text-lg text-white/70">Nenhum vídeo curto ainda</p>
            <p className="text-sm text-white/50">Seja o primeiro a postar!</p>
          </div>
        </div>
      ) : (
        <div className="relative h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
          {shorts.map((short, index) => (
            <div
              key={short.id}
              className="relative h-full w-full snap-start snap-always-center flex flex-col"
              data-short-last={index === shorts.length - 1}
            >
              {/* Video Player */}
              <div className="relative flex-1 flex items-center justify-center bg-black">
                {short.hlsManifestUrl ? (
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(short.id, el);
                      else videoRefs.current.delete(short.id);
                    }}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted={false}
                    loop
                    onTimeUpdate={(e) => handleVideoTimeUpdate(e, short)}
                    onEnded={() => handleVideoEnded(short)}
                    onClick={() => onShortClick?.(short)}
                    preload="metadata"
                  >
                    <source src={getVideoUrl(short)} type="application/vnd.apple.mpegurl" />
                  </video>
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-white/50">
                    <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                {/* Gradient overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
              </div>

              {/* Info & Actions - Bottom Right */}
              <div className="absolute bottom-8 right-6 flex flex-col items-end gap-4 z-10">
                {/* Author Info */}
                <div className="flex items-center gap-3">
                  <img
                    src={short.user.avatar || '/avatar-placeholder.svg'}
                    alt={short.user.name}
                    className="w-10 h-10 rounded-full border-2 border-white/20 object-cover"
                  />
                  <div className="flex flex-col">
                    <span className="text-white font-medium text-sm">{short.user.name}</span>
                    <span className="text-white/70 text-xs">@{short.user.username}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(short.id, short.liked);
                    }}
                    className={cn(
                      'p-2 rounded-full transition-colors',
                      short.liked
                        ? 'text-red-400 bg-red-400/10'
                        : 'text-white/90 hover:text-red-400 hover:bg-red-400/10'
                    )}
                    aria-label={short.liked ? 'Descurtir' : 'Curtir'}
                  >
                    <svg className={cn('w-7 h-7', short.liked ? 'fill-current' : '')} viewBox="0 0 24 24">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs font-medium">
                      {short.likesCount > 999 ? `${(short.likesCount / 1000).toFixed(1)}k` : short.likesCount}
                    </span>
                  </button>

                  <button className="p-2 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors" aria-label="Compartilhar">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs font-medium">
                      {short.viewsCount > 999 ? `${(short.viewsCount / 1000).toFixed(1)}k` : short.viewsCount}
                    </span>
                  </button>

                  <button className="p-2 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors" aria-label="Mais opções">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>

                {/* Description */}
                {(short.title || short.description) && (
                  <div className="w-72 text-right">
                    {short.title && <p className="text-white font-medium text-sm">{short.title}</p>}
                    {short.description && <p className="text-white/80 text-sm mt-1 line-clamp-2">{short.description}</p>}
                  </div>
                )}
              </div>

              {/* Loading indicator */}
              {loading && index === shorts.length - 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/70">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-sm">Carregando mais...</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}