'use client';

import { useCallback, useState } from 'react';

import { VideoFeed } from '@/components/posts/video-feed';
import type { ExplorePerson, ExploreTopic, Post, Space } from '@/lib/types';

import { InicioRail } from './inicio-rail';

interface InicioClientProps {
  initialForYouPosts: Post[];
  initialForYouCursor: number | null;
  initialFollowingPosts: Post[];
  initialFollowingCursor: number | null;
  initialRecommendations: Post[];
  initialSpaces: Space[];
  forYouError: string | null;
  autoplayReels: boolean;
}

export function InicioClient({
  initialForYouPosts,
  initialForYouCursor,
  initialFollowingPosts,
  initialFollowingCursor,
  initialRecommendations,
  initialSpaces,
  forYouError,
  autoplayReels,
}: InicioClientProps) {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [lastInitialRecommendations, setLastInitialRecommendations] = useState(initialRecommendations);

  /* Sincroniza durante render quando o servidor revalida com outra lista. */
  if (lastInitialRecommendations !== initialRecommendations) {
    setLastInitialRecommendations(initialRecommendations);
    setRecommendations(initialRecommendations);
  }

  const handlePostChange = useCallback((updatedPost: Post) => {
    setRecommendations((current) =>
      current.map((post) => (post.id === updatedPost.id ? updatedPost : post)),
    );
  }, []);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,620px)_minmax(300px,340px)] xl:justify-center">
      <section aria-label="Publicações" className="min-w-0">
        <VideoFeed
          forYouPosts={initialForYouPosts}
          forYouCursor={initialForYouCursor}
          followingPosts={initialFollowingPosts}
          followingCursor={initialFollowingCursor}
          {...(forYouError ? { forYouError } : {})}
          autoplay={autoplayReels}
          onPostChange={handlePostChange}
        />
      </section>

      <InicioRail
        recommendations={recommendations}
        spaces={initialSpaces}
      />
    </div>
  );
}
