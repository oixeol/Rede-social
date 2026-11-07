/**
 * Precise DTO types matching the existing Node API (server.js) responses.
 * All fields use camelCase as returned by the API.
 */

export type ThemePalette = 'orange' | 'black' | 'white';

export type MessagePolicy = 'everyone' | 'connections' | 'nobody';

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
  isPrivate: boolean;
}

/** Authenticated user's own profile (selfDTO from Node API). */
export interface SelfUser extends PublicUser {
  birthDate: string | null;
  messagePolicy: MessagePolicy;
  canCustomizeTheme: boolean;
  themePalette: ThemePalette;
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
  liked: boolean;
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
