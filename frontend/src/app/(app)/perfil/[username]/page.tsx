import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getProfile, getSuggestions } from '@/lib/server-api';
import { createProfileViewModel } from '@/lib/profile-view-model';
import type { ProfileResponse } from '@/lib/types';
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
    return { title: 'Perfil' };
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'status' in error &&
    error.status === 404
  );
}

export default async function PerfilPage({ params }: PerfilPageProps) {
  const { username } = await params;

  let profile: ProfileResponse;
  try {
    profile = await getProfile(username);
  } catch (error) {
    if (isNotFoundError(error)) notFound();
    throw error;
  }

  let suggestions = [] as Awaited<ReturnType<typeof getSuggestions>>['users'];
  try {
    suggestions = (await getSuggestions()).users;
  } catch {
    // Perfil continua disponível quando sugestões falham.
  }
  const filteredSuggestions = suggestions
    .filter((user) => user.id !== profile.user.id)
    .slice(0, 3);
  const viewModel = createProfileViewModel(profile, filteredSuggestions);

  return <PerfilView profile={viewModel} />;
}
