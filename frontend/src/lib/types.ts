/**
 * Precise DTO types matching the existing Node API (server.js) responses.
 * All fields use camelCase as returned by the API.
 */

export type ThemePalette = 'orange' | 'black' | 'white';

export type MessagePolicy = 'everyone' | 'connections' | 'nobody';

/** Estados da bolinha de status do perfil. */
export type Presence = 'available' | 'away' | 'dnd' | 'invisible';

export type MediaType = 'image' | 'video' | 'text' | 'file';

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
  /** Assinatura Orbit Premium ativa. */
  isPremium: boolean;
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

/** Anexo persisted em uma mensagem. */
export interface MessageMedia {
  url: string;
  mediaType: MediaType;
  mimeType?: string | null;
  sizeBytes?: number | null;
  fileName?: string | null;
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
  /** O usuário logado solicitou seguir o autor privado. */
  authorFollowRequested?: boolean;
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

/** Post de comunidade (estilo Twitter/X). */
export interface CommunityPost {
  id: number;
  communityId: number;
  userId: number;
  text: string;
  replyToId: number | null;
  sharedPostId: number | null;
  media: { url: string; mediaType: 'image' | 'video' | 'file'; mimeType?: string; sizeBytes: number; fileName?: string }[];
  createdAt: number;
  updatedAt: number | null;
  deletedAt: number | null;
  user: { id: number; username: string; name: string; avatar: string | null; verified: number };
  likesCount: number;
  repostsCount: number;
  repliesCount: number;
  liked: boolean;
  reposted: boolean;
}

/** GET /api/communities/:slug/posts */
export interface CommunityPostsResponse {
  posts: CommunityPost[];
  nextCursor: number | null;
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

/** Remetente real exposto pelo backend em cada mensagem. */
export interface MessageSender {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
  verified: boolean;
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
    sender: MessageSender;
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

/** Message as returned by /api/conversations/:id */
export interface Message {
  id: number;
  body: string;
  /** Publicação completa em respostas de leitura. */
  sharedPost?: Post | null;
  /** ID da publicação em respostas de envio. */
  sharedPostId?: number | null;
  media?: MessageMedia[];
  createdAt: number;
  editedAt?: number | null;
  deletedAt?: number | null;
  mine: boolean;
  /** Remetente real da mensagem (preenchido pelo backend). */
  sender: MessageSender;
}

/** Conversation detail returned by GET /api/conversations/:id */
export interface ConversationDetail {
  id: number;
  kind: 'social' | 'dating';
  matchId: number | null;
  canSend: boolean;
  reason: string | null;
}

/** Other participant in a conversation (from /api/conversations/:id) */
export interface ConversationOther extends PublicUser {}

/** GET /api/conversations/:id response */
export interface ConversationDetailResponse {
  conversation: ConversationDetail;
  other: ConversationOther;
  messages: Message[];
}

/** Payload for POST /api/conversations */
export interface CreateConversationPayload {
  username: string;
}

/** Response for POST /api/conversations */
export interface CreateConversationResponse {
  conversation: {
    id: number;
    kind: 'social';
    other: PublicUser;
  };
}

/** Arquivo enviado no payload JSON de uma mensagem. */
export interface MessageAttachmentInput {
  dataUrl: string;
  fileName: string;
}

/** Payload for POST /api/conversations/:id/messages */
export interface SendMessagePayload {
  text: string;
  sharedPostId?: number | null;
  media?: MessageAttachmentInput[];
}

/** Response for POST /api/conversations/:id/messages */
export interface SendMessageResponse {
  message: Message;
}

/** Response for POST /api/conversations/:id/read */
export interface MarkReadResponse {
  ok: boolean;
}

/* -------------------------------------------------------------------------- */
/* Chat Spaces & Channels (original Vibra domain)                             */
/* -------------------------------------------------------------------------- */

export interface Space {
  id: number;
  name: string;
  slug: string;
  description: string;
  ownerId: number;
  memberCount: number;
  role: 'owner' | 'moderator' | 'member';
  createdAt: number;
  updatedAt: number;
  avatar: string | null;
  onlineCount: number;
}

export interface SpaceMember {
  userId: number;
  username: string;
  name: string;
  avatar: string | null;
  role: 'owner' | 'moderator' | 'member';
  joinedAt: number;
  presence: 'online' | 'idle' | 'offline';
}

export interface Channel {
  id: number;
  spaceId: number;
  name: string;
  slug: string;
  topic: string;
  visibility: 'public' | 'private';
  type: 'text' | 'voice';
  position: number;
  createdBy: number;
  createdAt: number;
  updatedAt: number;
  /** Preenchido apenas quando o usuário atual é membro do canal. */
  lastReadAt?: number;
  /** Última mensagem para preview na lista. */
  lastMessage?: {
    id: number;
    body: string;
    senderId: number;
    createdAt: number;
  } | null;
  unreadCount?: number;
}

export interface ChannelMessage {
  id: number;
  channelId: number;
  senderId: number;
  body: string;
  sharedPostId: number | null;
  /** Publicação completa, quando o backend inclui a expansão. */
  sharedPost?: Post | null;
  media: MessageMedia[];
  createdAt: number;
  editedAt: number | null;
  deletedAt: number | null;
  sender: MessageSender;
  mine: boolean;
}

export interface SpacesResponse {
  spaces: Space[];
}

export interface SpaceDetailResponse {
  space: Space;
  channels: Channel[];
  members: SpaceMember[];
}

export interface ChannelMessagesResponse {
  messages: ChannelMessage[];
  nextCursor: number | null;
}

export interface CreateSpacePayload {
  name: string;
  description?: string;
}

export interface CreateChannelPayload {
  name: string;
  topic?: string;
  visibility?: 'public' | 'private';
  type?: 'text' | 'voice';
}

/* ===== Novas respostas do backend (contract clean-room) ===== */

export interface CreateSpaceResponse {
  space: Space;
}

export interface CreateChannelResponse {
  channel: Channel;
}

export interface MembersResponse {
  members: SpaceMember[];
}

export interface ConversationMessagesResponse {
  messages: Message[];
  nextCursor: number | null;
}

/** Resposta genérica para mutação de mensagem (canal ou conversa). */
export interface MessageMutationResponse {
  ok?: boolean;
  message: Message;
}

/** Payload de edição de mensagem (campo texto). */
export interface EditMessagePayload {
  text: string;
}

/* ===== Shorts (Reels/TikTok style videos) ===== */
export interface Short {
  id: number;
  userId: number;
  title: string;
  description: string;
  hlsManifestUrl: string;
  thumbnailUrl: string | null;
  duration: number;
  width: number;
  height: number;
  status: 'processing' | 'ready' | 'failed';
  likesCount: number;
  viewsCount: number;
  liked: boolean;
  user: {
    id: number;
    username: string;
    name: string;
    avatar: string | null;
    verified: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

export interface ShortsResponse {
  shorts: Short[];
  nextCursor: number | null;
}

export interface ShortPresignResponse {
  uploadUrl: string;
  videoId: number;
  objectKey: string;
}

export interface ShortManifestResponse {
  manifestUrl: string;
}

/* ===== Voice Channel Types ===== */
export interface VoiceParticipant {
  userId: number;
  username: string;
  name: string;
  avatar: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  joinedAt: number;
}

export interface VoiceStateResponse {
  participants: VoiceParticipant[];
}

export interface VoiceJoinResponse {
  ok: boolean;
}

export interface VoiceMuteResponse {
  ok: boolean;
  muted: boolean;
}

export interface VoiceDeafenResponse {
  ok: boolean;
  deafened: boolean;
}
