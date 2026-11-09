/**
 * Precise DTO types matching the existing Node API (server.js) responses.
 * All fields use camelCase as returned by the API.
 */

export type ThemePalette = 'orange' | 'black' | 'white';

export type MessagePolicy = 'everyone' | 'connections' | 'nobody';

/** Estados da bolinha de status do perfil. */
export type Presence = 'available' | 'away' | 'dnd' | 'invisible';

export type MediaType = 'image' | 'video' | 'text';

export interface UserStats {
  posts: number;
  followers: number;
  following: number;
  comments: number;
  stories: number;
  likesReceived: number;
  verified: 0 | 1;
}

export interface Badge {
  id: string;
  label: string;
  icon: string;
  description: string;
}

/** Minimal user used in comments and brief references. */
export interface UserBrief {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
}

/** Author info in posts — includes privacy flag. */
export interface PostAuthor extends UserBrief {
  isPrivate: boolean;
  /** Perfil com verificação de identidade aprovada. */
  verified: boolean;
}

/** Icones disponíveis para destaques — conjunto fechado da plataforma. */
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

/** Destaque livre: nome escolhido pelo usuário + ícone. */
export interface ProfileHighlight {
  id: string;
  label: string;
  icon: ProfileHighlightIcon;
}

/** Public user profile (userDTO from Node API). */
export interface PublicUser {
  id: number;
  username: string;
  name: string;
  bio: string;
  avatar: string | null;
  banner: string | null;
  interests: string[];
  highlights: ProfileHighlight[];
  isPrivate: boolean;
  gender: string | null;
  country: string | null;
  state: string | null;
  points: number;
  /** Estado da bolinha de status (default `available`). */
  presence: Presence;
}

/** Preferências de notificação do usuário. */
export interface NotificationPreferences {
  likes?: boolean;
  comments?: boolean;
  follows?: boolean;
  mentions?: boolean;
  messages?: boolean;
}

/** Preferências de privacidade do usuário. */
export interface PrivacyPreferences {
  showActivityStatus?: boolean;
  discoverableBySearch?: boolean;
}

/** Preferências de aparência do usuário. */
export interface AppearancePreferences {
  reduceMotion?: boolean;
  compactFeed?: boolean;
  autoplayMedia?: boolean;
}

/** Preferências de conteúdo do feed. */
export interface ContentPreferences {
  showReplies?: boolean;
  autoplayReels?: boolean;
  sensitiveMedia?: boolean;
}

/** Bloco de preferências salvo em `users.preferences`. */
export interface UserPreferences {
  notifications?: NotificationPreferences;
  privacy?: PrivacyPreferences;
  appearance?: AppearancePreferences;
  content?: ContentPreferences;
}

/** Authenticated user's own profile (selfDTO from Node API). */
export interface SelfUser extends PublicUser {
  birthDate: string | null;
  messagePolicy: MessagePolicy;
  canCustomizeTheme: boolean;
  themePalette: ThemePalette;
  email: string | null;
  gender: string | null;
  externalLink: string | null;
  preferences: UserPreferences;
}

/** Profile user as returned by /api/users/:username (userDTO + messagePolicy + createdAt). */
export interface ProfileUser extends PublicUser {
  messagePolicy: MessagePolicy;
  createdAt: number;
}

/** Media attachment in a post. */
export interface PostMedia {
  url: string;
  mediaType: MediaType;
}

/** Post as returned by feed, profile, and search. */
export interface Post {
  id: number;
  image: string;
  mediaType: MediaType;
  media: PostMedia[];
  topic: string;
  caption: string;
  createdAt: number;
  user: PostAuthor;
  likes: number;
  comments: number;
  shares: number;
  /** Total de reposts da publicação. */
  reposts: number;
  /** Total de salvamentos da publicação. */
  saves: number;
  liked: boolean;
  /** O usuário logado repostou esta publicação. */
  reposted: boolean;
  /** O usuário logado salvou esta publicação. */
  saved: boolean;
  /** O usuário logado segue o autor da publicação. */
  authorFollowing: boolean;
  /** Present in feed/profile responses (withPreviews). Optional in post detail. */
  preview?: Comment[];
}

/** Comment as returned by comments endpoints. */
export interface Comment {
  id: number;
  text: string;
  createdAt: number;
  user: UserBrief;
}

/** --- Response types --- */

/** Comunidade retornada pelas rotas de comunidades. */
export interface Community {
  id: number;
  name: string;
  slug: string;
  description: string;
  avatar: string | null;
  memberCount: number;
  isMember: boolean;
  role: 'owner' | 'member' | null;
  createdAt: number;
}

/** GET /api/communities | /api/users/:username/communities */
export interface CommunitiesResponse {
  communities: Community[];
}

/** Sessão ativa retornada por GET /api/sessions. */
export interface SessionInfo {
  id: string;
  device: string;
  createdAt: number;
  current: boolean;
}

/** GET /api/sessions */
export interface SessionsResponse {
  sessions: SessionInfo[];
}

/** GET /api/me */
export interface MeResponse {
  user: SelfUser;
  stats: UserStats;
  badges: Badge[];
  pendingFollowRequests: number;
  unreadNotifications: number;
  unreadMessages: number;
  canCustomizeTheme: boolean;
  themePalette: ThemePalette;
}

/** GET /api/feed */
export interface FeedResponse {
  posts: Post[];
  nextCursor: number | null;
}

/** Pessoa returned by /api/explore. */
export interface ExplorePerson extends PublicUser {
  isFollowing: boolean;
  followRequested: boolean;
  followers: number;
  sharedInterests: string[];
}

/** Tópico real agregado a partir das publicações visíveis. */
export interface ExploreTopic {
  id: string;
  label: string;
  count: number;
}

/** GET /api/explore */
export interface ExploreResponse {
  posts: Post[];
  people: ExplorePerson[];
  topics: ExploreTopic[];
  nextCursor: number | null;
}

/** Usuário em listas de seguidores/seguindo do perfil. */
export interface FollowListUser extends PublicUser {
  isFollowing: boolean;
  followRequested: boolean;
  isCloseFriend: boolean;
  isMe: boolean;
}

/** GET /api/users/:username/followers | /following */
export interface FollowListResponse {
  users: FollowListUser[];
}

/** GET /api/users/:username */
export interface ProfileResponse {
  user: ProfileUser;
  stats: UserStats;
  badges: Badge[];
  isMe: boolean;
  isFollowing: boolean;
  followRequested: boolean;
  isCloseFriend: boolean;
  canViewContent: boolean;
  pendingFollowRequests: number;
  canMessage: boolean;
  sharedInterests: string[];
  posts: Post[];
}

/** Single suggestion user from /api/suggestions */
export interface SuggestionUser extends PublicUser {
  isFollowing: boolean;
  followRequested: boolean;
  followers: number;
  sharedInterests: string[];
}

/** GET /api/suggestions */
export interface SuggestionsResponse {
  users: SuggestionUser[];
}

/** Single search result user from /api/search */
export interface SearchUser extends PublicUser {
  isFollowing: boolean;
  followRequested: boolean;
  isCloseFriend: boolean;
  isMe: boolean;
  canMessage: boolean;
}

/** GET /api/search */
export interface SearchResponse {
  users: SearchUser[];
}

/** Story returned by /api/stories. */
export interface Story {
  id: number;
  image: string;
  mediaType: MediaType;
  audience: 'public' | 'close_friends';
  caption: string;
  mentions: string[];
  createdAt: number;
  viewed: boolean;
}

/** Story group returned by /api/stories. */
export interface StoryGroup {
  user: UserBrief;
  isCloseFriend: boolean;
  stories: Story[];
  allViewed: boolean;
}

/** GET /api/stories */
export interface StoriesResponse {
  groups: StoryGroup[];
}

/** Conversation summary returned by /api/conversations. */
export interface ConversationSummary {
  id: number;
  kind: string;
  matchId: number | null;
  other: PublicUser;
  lastMessage: {
    id: number;
    body: string;
    sharedPostId: number | null;
    createdAt: number;
    mine: boolean;
  } | null;
  unread: number;
  updatedAt: number;
}

/** GET /api/conversations */
export interface ConversationsResponse {
  conversations: ConversationSummary[];
}

/** Notification returned by /api/notifications. */
export interface AppNotification {
  id: number;
  kind: string;
  text: string;
  link: string;
  createdAt: number;
  read: boolean;
}

/** GET /api/notifications */
export interface NotificationsResponse {
  notifications: AppNotification[];
  unread: number;
}
