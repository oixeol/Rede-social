import { getCountryByCode } from './countries';
import type {
  Badge,
  Community,
  Post,
  Presence,
  ProfileHighlight,
  ProfileResponse,
  SuggestionUser,
  UserStats,
} from './types';

export type ProfileTabId = 'posts' | 'reels' | 'communities' | 'likes';

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
  /** Estado da bolinha de status do perfil. */
  presence: Presence;
  /** Assinatura Orbit Premium ativa. */
  isPremium: boolean;
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

export type { ProfileHighlight, ProfileHighlightIcon } from './types';

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
  country: string | null;
  points: number;
}

function formatJoinedDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';

  const date = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date(timestamp))
    .replace(/\./g, '');

  return `Entrou em ${date}`;
}

/**
 * Pontos exibidos no card "Sobre mim".
 * Soma de engagement real do backend. Finalidade de exibição ainda indefinida.
 */
function computePoints(stats: UserStats): number {
  return stats.posts + stats.followers + stats.following + stats.likesReceived + stats.comments;
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

  /* Destaques são livres: vêm do backend já normalizados (id, label, icon). */
  const highlights: ProfileHighlight[] = user.highlights ?? [];

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
    presence: user.presence ?? 'available',
    isPremium: user.isPremium ?? false,
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
      country: user.country ? getCountryByCode(user.country)?.name ?? user.country : null,
      points: user.points ?? computePoints(stats),
    },
  };
}
