import { getInterestLabel } from './interests';
import { getCountryByCode } from './countries';
import type { Badge, Post, ProfileResponse, SuggestionUser, UserStats } from './types';

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

export type ProfileHighlightIcon =
  | 'crown'
  | 'gamepad'
  | 'music'
  | 'plane'
  | 'trophy'
  | 'dumbbell'
  | 'camera'
  | 'palette'
  | 'coffee'
  | 'sparkles';

export interface ProfileHighlight {
  /** Id do interesse que originou o destaque (usado para persistir edição). */
  id: string;
  label: string;
  icon: ProfileHighlightIcon;
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
  country: string | null;
  points: number;
}

/**
 * Ícone estável por interesse: a ordem da lista não pode trocar o ícone
 * quando um destaque é adicionado ou removido.
 */
const HIGHLIGHT_ICON_BY_INTEREST: Record<string, ProfileHighlightIcon> = {
  games: 'gamepad',
  boardgames: 'gamepad',
  musica: 'music',
  'musica-ao-vivo': 'music',
  podcasts: 'music',
  viagens: 'plane',
  trilhas: 'plane',
  praia: 'plane',
  futebol: 'trophy',
  academia: 'dumbbell',
  corrida: 'dumbbell',
  fotografia: 'camera',
  arte: 'palette',
  design: 'palette',
  cafe: 'coffee',
  culinaria: 'coffee',
  cozinhar: 'coffee',
};

const HIGHLIGHT_ICONS_FALLBACK: ProfileHighlightIcon[] = ['crown', 'sparkles'];

export function highlightIconFor(interest: string): ProfileHighlightIcon {
  const mapped = HIGHLIGHT_ICON_BY_INTEREST[interest];
  if (mapped) return mapped;

  const index = [...interest].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return HIGHLIGHT_ICONS_FALLBACK[index % HIGHLIGHT_ICONS_FALLBACK.length];
}

function formatJoinedDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';

  return `Entrou em ${new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(timestamp))}`;
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

  const highlights: ProfileHighlight[] = user.interests.map((interest) => ({
    id: interest,
    label: getInterestLabel(interest),
    icon: highlightIconFor(interest),
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
      country: user.country ? getCountryByCode(user.country)?.name ?? user.country : null,
      points: computePoints(stats),
    },
  };
}
