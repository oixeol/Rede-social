import type { Metadata } from 'next';
import { getMe, serverApiRequest } from '@/lib/server-api';
import type { CommunitiesResponse, Community, MeResponse } from '@/lib/types';

import { ComunidadesClient } from './comunidades-client';

export const metadata: Metadata = {
  title: 'Comunidades',
  description: 'Participe de comunidades e acompanhe discussões no Orbit.',
};

export default async function ComunidadesPage() {
  const [meResult, communitiesResult] = await Promise.allSettled([
    getMe(),
    serverApiRequest<CommunitiesResponse>('/api/communities'),
  ]);

  const me = meResult.status === 'fulfilled' ? meResult.value : null;
  const communities = communitiesResult.status === 'fulfilled' ? communitiesResult.value.communities : [];
  const myCommunities = communities.filter((c) => c.isMember);
  const otherCommunities = communities.filter((c) => !c.isMember);

  return (
    <ComunidadesClient
      initialMe={me}
      initialCommunities={communities}
      initialMyCommunities={myCommunities}
      initialOtherCommunities={otherCommunities}
    />
  );
}