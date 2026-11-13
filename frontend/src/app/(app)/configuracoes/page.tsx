import type { Metadata } from 'next';

import { getMe } from '@/lib/server-api';
import { ConfiguracoesView } from './configuracoes-view';

export const metadata: Metadata = {
  title: 'Configurações',
  description: 'Gerencie sua conta e preferências no Orbit.',
};

export default async function ConfiguracoesPage() {
  const me = await getMe();

  return <ConfiguracoesView me={me} />;
}