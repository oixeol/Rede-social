import type { Metadata } from 'next';

import { serverApiRequest } from '@/lib/server-api';
import type { ConversationsResponse } from '@/lib/types';
import { MensagensView } from './mensagens-view';

export const metadata: Metadata = {
  title: 'Mensagens',
  description: 'Acompanhe suas conversas no Vibra.',
};

export default async function MensagensPage() {
  const data = await serverApiRequest<ConversationsResponse>('/api/conversations');

  return <MensagensView conversations={data.conversations} />;
}