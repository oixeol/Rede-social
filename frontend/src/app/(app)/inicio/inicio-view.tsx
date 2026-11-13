import { getExplore, getFeed, getMe, serverApiRequest } from '@/lib/server-api';
import type { SpacesResponse, Space, ExploreTopic, ExplorePerson, Post } from '@/lib/types';

import { InicioClient } from './inicio-client';

export async function InicioView() {
  const [feedResult, exploreResult, meResult, spacesResult] = await Promise.allSettled([
    getFeed({ limit: 24, mediaType: 'image,video' }),
    getExplore({ limit: 24, mediaType: 'image,video' }),
    getMe(),
    serverApiRequest<SpacesResponse>('/api/spaces'),
  ]);

  if (feedResult.status === 'rejected') {
    throw feedResult.reason;
  }

  const feed = feedResult.value;
  const explore = exploreResult.status === 'fulfilled' ? exploreResult.value : null;
  const autoplayReels =
    meResult.status === 'fulfilled'
      ? (meResult.value.user.preferences?.content?.autoplayReels ?? true)
      : true;
  const forYouError =
    exploreResult.status === 'rejected'
      ? 'Não foi possível carregar as publicações recomendadas.'
      : null;
  const spaces: Space[] = spacesResult.status === 'fulfilled' ? spacesResult.value.spaces : [];

  const recommendationPosts = [...(explore?.posts ?? []), ...feed.posts].filter(
    (post, index, posts) => posts.findIndex((candidate) => candidate.id === post.id) === index,
  );

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <InicioClient
        initialForYouPosts={explore?.posts ?? []}
        initialForYouCursor={explore?.nextCursor ?? null}
        initialFollowingPosts={feed.posts}
        initialFollowingCursor={feed.nextCursor}
        initialRecommendations={recommendationPosts}
        initialSpaces={spaces}
        forYouError={forYouError}
        autoplayReels={autoplayReels}
      />

      <time
        className="pointer-events-none fixed right-3 bottom-20 z-20 text-[10px] font-medium tracking-wide text-muted/70 md:right-4 md:bottom-4"
        dateTime={new Date().toISOString()}
      >
        {new Intl.DateTimeFormat('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
        }).format(new Date())}
      </time>
    </div>
  );
}
