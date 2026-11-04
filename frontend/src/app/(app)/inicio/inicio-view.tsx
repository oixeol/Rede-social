import { Suspense } from 'react';

import { getExplore, getFeed, getMe, getSuggestions } from '@/lib/server-api';

import { InicioClient } from './inicio-client';
import { InicioSkeleton } from './loading-skeleton';
import { InicioRail } from './inicio-rail';

export async function InicioView() {
  const [feedResult, exploreResult, suggestionsResult, meResult] = await Promise.allSettled([
    getFeed({ limit: 12 }),
    getExplore({ limit: 12 }),
    getSuggestions(),
    getMe(),
  ]);

  if (feedResult.status === 'rejected') {
    throw feedResult.reason;
  }

  const feed = feedResult.value;
  const explore = exploreResult.status === 'fulfilled' ? exploreResult.value : null;
  const suggestions = suggestionsResult.status === 'fulfilled' ? suggestionsResult.value.users : [];
  const me = meResult.status === 'fulfilled' ? meResult.value : null;

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">Início</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl">
            O que está acontecendo
          </h1>
        </div>
        <time className="hidden text-xs font-medium text-muted sm:block" dateTime={new Date().toISOString()}>
          {new Intl.DateTimeFormat('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
          }).format(new Date())}
        </time>
      </header>

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,700px)_minmax(280px,320px)] xl:justify-center">
        <section aria-label="Publicações" className="min-w-0">
          <Suspense fallback={<InicioSkeleton />}>
            <InicioClient
              initialForYouPosts={explore?.posts ?? feed.posts}
              initialForYouCursor={explore?.nextCursor ?? null}
              initialFollowingPosts={feed.posts}
              initialFollowingCursor={feed.nextCursor}
              meUser={me?.user ?? null}
            />
          </Suspense>
        </section>

        <InicioRail suggestions={suggestions} />
      </div>
    </div>
  );
}
