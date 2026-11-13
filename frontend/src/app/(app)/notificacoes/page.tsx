import type { Metadata } from 'next';

import { serverApiRequest } from '@/lib/server-api';
import type { NotificationsResponse } from '@/lib/types';
import { NotificacoesView } from './notificacoes-view';

export const metadata: Metadata = {
  title: 'Notificações',
  description: 'Veja as novidades da sua conta no Orbit.',
};

export default async function NotificacoesPage() {
  const data = await serverApiRequest<NotificationsResponse>('/api/notifications');

  return <NotificacoesView data={data} />;
}