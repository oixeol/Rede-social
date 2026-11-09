import type { ProfileResponse, SuggestionUser } from './types';

export interface FixtureEnvironment {
  NODE_ENV?: string;
  VIBRA_FIXTURES?: string;
}

export function isFixtureMode(
  environment: FixtureEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    VIBRA_FIXTURES: process.env.VIBRA_FIXTURES,
  },
): boolean {
  return environment.NODE_ENV === 'development' && environment.VIBRA_FIXTURES === '1';
}

/**
 * Perfil sintético para desenvolvimento local. Não usa nomes, artes ou
 * contadores da referência visual.
 */
export function createFixtureProfile(): ProfileResponse {
  return {
    user: {
      id: 1001,
      username: 'usuario_demo',
      name: 'Usuário Demo',
      bio: 'Bio sintética para desenvolvimento local.',
      avatar: null,
      banner: null,
      interests: [],
      highlights: [],
      isPrivate: false,
      gender: null,
      country: null,
      state: null,
      points: 0,
      messagePolicy: 'everyone',
      presence: 'available',
      createdAt: Date.UTC(2026, 0, 1),
    },
    stats: {
      posts: 0,
      followers: 0,
      following: 0,
      comments: 0,
      stories: 0,
      likesReceived: 0,
      verified: 0,
    },
    badges: [],
    isMe: false,
    isFollowing: false,
    followRequested: false,
    isCloseFriend: false,
    canViewContent: true,
    pendingFollowRequests: 0,
    canMessage: true,
    sharedInterests: [],
    posts: [],
  };
}

export function createFixtureSuggestions(): SuggestionUser[] {
  return [];
}
