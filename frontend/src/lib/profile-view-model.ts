import { getInterestLabel } from './interests';
import type { Badge, Post, ProfileResponse, SuggestionUser } from './types';

export type ProfileTabId = 'posts' | 'reels' | 'photos' | 'likes';

export interface ProfileViewModel {
  id: number;
  name: string;
  username: string;
  bio: string;
  avatar: string | null;
  banner: string | null;
  avatarAlt: string;
  bannerAlt: string;
  verified: boolean;
  isMe: boolean;
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
  badges: Badge[];
  canViewContent: boolean;
  isFollowing: boolean;
  followRequested: boolean;
  isCloseFriend: boolean;
  canMessage: boolean;
  sharedInterests: string[];
  posts: Post[];
  highlights: ProfileHighlight[];
  suggestions: ProfileSuggestion[];
  about: ProfileAbout;
}

export interface ProfileHighlight {
  id: string;
  label: string;
  icon: 'crown' | 'gamepad' | 'music' | 'plane';
}

export interface ProfileSuggestion {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  alt: string;
  verified: boolean;
  reason: string;
  isFollowing: boolean;
  followRequested: boolean;
}

export interface ProfileAbout {
  bio: string;
  joined: string;
}

const HIGHLIGHT_ICONS: ProfileHighlight['icon'][] = ['crown', 'gamepad', 'music', 'plane'];

function formatJoinedDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';

  return `Entrou em ${new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(timestamp))}`;
}

function mapSuggestion(user: SuggestionUser): ProfileSuggestion {
  return {
    id: String(user.id),
    username: user.username,
    name: user.name,
    avatar: user.avatar,
    alt: `Foto de perfil de ${user.name}`,
    verified: false,
    reason:
      user.sharedInterests.length > 0
        ? `${user.sharedInterests.length} ${user.sharedInterests.length === 1 ? 'interesse em comum' : 'interesses em comum'}`
        : user.followers > 0
          ? `${user.followers} ${user.followers === 1 ? 'seguidor' : 'seguidores'}`
          : 'Sugestão para você',
    isFollowing: user.isFollowing,
    followRequested: user.followRequested,
  };
}

/**
 * Converte ProfileResponse da API + sugestões em ViewModel do perfil.
 * Não substitui dados ausentes por conteúdo fictício.
 */
export function createProfileViewModel(
  profile: ProfileResponse,
  suggestions: SuggestionUser[],
): ProfileViewModel {
  const { user, stats, badges, posts } = profile;

  const highlights: ProfileHighlight[] = user.interests.slice(0, 4).map((interest, index) => ({
    id: `highlight-${interest}`,
    label: getInterestLabel(interest),
    icon: HIGHLIGHT_ICONS[index % HIGHLIGHT_ICONS.length],
  }));

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    bio: user.bio,
    avatar: user.avatar,
    banner: user.banner,
    avatarAlt: `Foto de perfil de ${user.name}`,
    bannerAlt: `Capa de ${user.name}`,
    verified: stats.verified === 1,
    isMe: profile.isMe,
    stats: {
      posts: stats.posts,
      followers: stats.followers,
      following: stats.following,
    },
    badges,
    canViewContent: profile.canViewContent,
    isFollowing: profile.isFollowing,
    followRequested: profile.followRequested,
    isCloseFriend: profile.isCloseFriend,
    canMessage: profile.canMessage,
    sharedInterests: profile.sharedInterests,
    posts,
    highlights,
    suggestions: suggestions.map(mapSuggestion),
    about: {
      bio: user.bio,
      joined: formatJoinedDate(user.createdAt),
    },
  };
}
