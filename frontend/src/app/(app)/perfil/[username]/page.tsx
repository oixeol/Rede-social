import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getProfile } from '@/lib/server-api';
import { ApiError } from '@/lib/server-api';

import { PerfilView } from './perfil-view';

interface PerfilPageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PerfilPageProps): Promise<Metadata> {
  const { username } = await params;

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
