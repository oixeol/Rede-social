import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { MOCK_PROFILE } from '@/lib/profile-mock';
import { ApiError, getProfile } from '@/lib/server-api';

import { PerfilView, ProfileScreen } from './perfil-view';

interface PerfilPageProps {
  params: Promise<{ username: string }>;
}

/**
 * Perfil de demonstração da referência. Não consulta a API — a tela é
 * alimentada pelos dados mockados tipados em `@/lib/profile-mock`.
 */
const DEMO_USERNAME = MOCK_PROFILE.username;

export async function generateMetadata({ params }: PerfilPageProps): Promise<Metadata> {
  const { username } = await params;

  if (username === DEMO_USERNAME) {
    return {
      title: `${MOCK_PROFILE.name} (@${MOCK_PROFILE.username})`,
      description: MOCK_PROFILE.about.bio,
    };
  }

  try {
    const profile = await getProfile(username);
    return {
      title: `${profile.user.name} (@${profile.user.username})`,
      description: profile.user.bio || `Perfil de ${profile.user.name} no Vibra.`,
    };
  } catch {
    return {
      title: 'Perfil',
    };
  }
}

export default async function PerfilPage({ params }: PerfilPageProps) {
  const { username } = await params;

  if (username === DEMO_USERNAME) {
    return <ProfileScreen profile={MOCK_PROFILE} />;
  }

  let profile;

  try {
    profile = await getProfile(username);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return <PerfilView profile={profile} />;
}
