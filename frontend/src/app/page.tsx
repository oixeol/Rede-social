import type { Metadata } from 'next';

import { LandingPage } from '@/components/landing/landing-page';

export const metadata: Metadata = {
  title: 'Orbit — Conecte-se do seu jeito',
  description:
    'Orbit é a rede social para descobrir pessoas e comunidades que combinam com você. Compartilhe ideias, converse sem roteiro.',
};

export default function HomePage() {
  return <LandingPage />;
}
