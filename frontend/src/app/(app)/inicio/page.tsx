import type { Metadata } from 'next';

import { InicioView } from './inicio-view';

export const metadata: Metadata = {
  title: 'Início',
  description: 'Acompanhe as novidades e as pessoas que você segue no Vibra.',
};

export default function InicioPage() {
  return <InicioView />;
}
