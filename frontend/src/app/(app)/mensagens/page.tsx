import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { serverApiRequest } from '@/lib/server-api';
import type { ConversationsResponse, SpacesResponse, SpaceDetailResponse } from '@/lib/types';
import { parseChatSelectionRecord } from '@/lib/chat';
import { ChatWorkspace } from '@/components/messages/chat-workspace';

export const metadata: Metadata = {
  title: 'Mensagens',
  description: 'Espaços, canais e conversas diretas no Orbit.',
};

export default async function MensagensPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const selection = parseChatSelectionRecord(searchParams);

  // Parallel fetches - use allSettled to handle auth failures gracefully
  const [conversationsRes, spacesRes] = await Promise.allSettled([
    serverApiRequest<ConversationsResponse>('/api/conversations'),
    serverApiRequest<SpacesResponse>('/api/spaces'),
  ]);

  // If both fail (likely unauthenticated), redirect to login
  if (conversationsRes.status === 'rejected' && spacesRes.status === 'rejected') {
    redirect('/entrar?redirect=/mensagens');
  }

  const conversations = conversationsRes.status === 'fulfilled' ? conversationsRes.value.conversations : [];
  const spaces = spacesRes.status === 'fulfilled' ? spacesRes.value.spaces : [];

  let spaceDetail: SpaceDetailResponse | null = null;
  if (selection.spaceId !== null) {
    try {
      spaceDetail = await serverApiRequest<SpaceDetailResponse>(`/api/spaces/${selection.spaceId}`);
    } catch {
      // espaço pode ter sido removido ou usuário saiu; mantenha null para UI lidar
      spaceDetail = null;
    }
  }

  return (
    <Suspense fallback={null}>
      <ChatWorkspace
        initialConversations={conversations}
        initialSpaces={spaces}
        initialSpaceDetail={spaceDetail}
        initialSelection={selection}
      />
    </Suspense>
  );
}