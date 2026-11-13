import type { Metadata } from 'next';

import { getExplore } from '@/lib/server-api';
import { ExplorarView } from './explorar-view';

export const metadata: Metadata = {
  title: 'Explorar',
  description: 'Descubra novas publicações, pessoas e tópicos no Orbit.',
};

export default async function ExplorarPage() {
  const explore = await getExplore({ limit: 12 });

  return <ExplorarView explore={explore} />;
}