-- Sqlite2Postgres dump - Vibra Social Network
-- Generated: 2026-11-03
-- 
-- IMPORTANTE: Este dump foi gerado do SQLite e precisa de ajustes para PostgreSQL
-- - INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
-- - TEXT → TEXT (PostgreSQL suporta)
-- - BOOLEAN como INTEGER → SMALLINT
-- - JSON em TEXT → TEXT (manter como é, migrar com aplicação)
-- - COLLATE NOCASE → usar citext ou LOWER() em queries

-- Disable FK temporariamente durante importação
SET session_replication_role = replica;

-- ============================================================================
-- USERS
-- ============================================================================
INSERT INTO public.users (id, username, name, bio, avatar, password_hash, created_at, birth_date, interests, message_policy, is_private, last_active_at, banner, subscription_status, subscription_ends_at, theme_palette)
SELECT 
    id,
    username,
    name,
    bio,
    avatar,
    password_hash,
    created_at,
    birth_date,
    interests,
    message_policy,
    is_private,
    last_active_at,
    banner,
    subscription_status,
    subscription_ends_at,
    theme_palette
FROM _sqlite_users
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SESSIONS
-- ============================================================================
INSERT INTO public.sessions (token, user_id, created_at, user_agent)
SELECT 
    token,
    user_id,
    created_at,
    user_agent
FROM _sqlite_sessions
ON CONFLICT (token) DO NOTHING;

-- ============================================================================
-- POSTS
-- ============================================================================
INSERT INTO public.posts (id, user_id, image, caption, created_at, media_type, topic)
SELECT 
    id,
    user_id,
    image,
    caption,
    created_at,
    media_type,
    topic
FROM _sqlite_posts
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- POST_MEDIA
-- ============================================================================
INSERT INTO public.post_media (id, post_id, url, media_type, position)
SELECT 
    id,
    post_id,
    url,
    media_type,
    position
FROM _sqlite_post_media
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- LIKES
-- ============================================================================
INSERT INTO public.likes (user_id, post_id, created_at)
SELECT 
    user_id,
    post_id,
    created_at
FROM _sqlite_likes
ON CONFLICT (user_id, post_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================
INSERT INTO public.comments (id, post_id, user_id, text, created_at)
SELECT 
    id,
    post_id,
    user_id,
    text,
    created_at
FROM _sqlite_comments
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- FOLLOWS
-- ============================================================================
INSERT INTO public.follows (follower_id, following_id, created_at)
SELECT 
    follower_id,
    following_id,
    created_at
FROM _sqlite_follows
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- ============================================================================
-- FOLLOW_REQUESTS
-- ============================================================================
INSERT INTO public.follow_requests (id, requester_id, target_id, created_at)
SELECT 
    id,
    requester_id,
    target_id,
    created_at
FROM _sqlite_follow_requests
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CLOSE_FRIENDS
-- ============================================================================
INSERT INTO public.close_friends (owner_id, friend_id, created_at)
SELECT 
    owner_id,
    friend_id,
    created_at
FROM _sqlite_close_friends
ON CONFLICT (owner_id, friend_id) DO NOTHING;

-- ============================================================================
-- STORIES
-- ============================================================================
INSERT INTO public.stories (id, user_id, image, created_at, expires_at, media_type, audience, caption, mentions)
SELECT 
    id,
    user_id,
    image,
    created_at,
    expires_at,
    media_type,
    audience,
    caption,
    mentions
FROM _sqlite_stories
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORY_VIEWS
-- ============================================================================
INSERT INTO public.story_views (story_id, user_id, viewed_at)
SELECT 
    story_id,
    user_id,
    viewed_at
FROM _sqlite_story_views
ON CONFLICT (story_id, user_id) DO NOTHING;

-- ============================================================================
-- SHARES
-- ============================================================================
INSERT INTO public.shares (user_id, post_id, created_at)
SELECT 
    user_id,
    post_id,
    created_at
FROM _sqlite_shares
ON CONFLICT (user_id, post_id) DO NOTHING;

-- ============================================================================
-- BLOCKS
-- ============================================================================
INSERT INTO public.blocks (blocker_id, blocked_id, created_at)
SELECT 
    blocker_id,
    blocked_id,
    created_at
FROM _sqlite_blocks
ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

-- ============================================================================
-- ENABLE FK
-- ============================================================================
SET session_replication_role = DEFAULT;