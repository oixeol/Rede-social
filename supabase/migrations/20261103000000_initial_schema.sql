-- =============================================================================
-- Vibra · schema PostgreSQL (Supabase)
-- Espelha 1:1 o schema SQLite do servidor Node.js (`server.js`).
--
-- Regras de portabilidade mantidas intencionalmente:
-- - Timestamps são BIGINT com epoch em milissegundos (mesmo formato do Node).
-- - Booleanos do SQLite viram INTEGER 0/1 (mesma semântica do código atual).
-- - Listas JSON continuam TEXT (string JSON), evitando reescrita da camada DTO.
-- - IDs preservam os valores do SQLite para permitir migração sem reescrever FKs.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
CREATE TABLE public.users (
    id BIGSERIAL PRIMARY KEY,
    auth_uid UUID UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar TEXT,
    banner TEXT,
    birth_date TEXT,
    interests TEXT NOT NULL DEFAULT '[]',
    message_policy TEXT NOT NULL DEFAULT 'connections',
    is_private INTEGER NOT NULL DEFAULT 0,
    last_active_at BIGINT,
    theme_palette TEXT NOT NULL DEFAULT 'orange',
    subscription_status TEXT NOT NULL DEFAULT 'free',
    subscription_ends_at BIGINT,
    password_hash TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

-- O SQLite usava `COLLATE NOCASE`; no Postgres a unicidade é case-insensitive
-- por meio de um índice sobre `lower(username)`.
CREATE UNIQUE INDEX users_username_lower_key ON public.users (lower(username));
CREATE INDEX users_auth_uid_idx ON public.users (auth_uid);

-- -----------------------------------------------------------------------------
-- sessions
-- -----------------------------------------------------------------------------
CREATE TABLE public.sessions (
    token TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    user_agent TEXT
);

-- -----------------------------------------------------------------------------
-- posts
-- -----------------------------------------------------------------------------
CREATE TABLE public.posts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    image TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    media_type TEXT NOT NULL DEFAULT 'image',
    topic TEXT NOT NULL DEFAULT 'cotidiano',
    created_at BIGINT NOT NULL
);

CREATE INDEX idx_posts_user ON public.posts (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- post_media
-- -----------------------------------------------------------------------------
CREATE TABLE public.post_media (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image',
    position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_post_media_post ON public.post_media (post_id, position, id);

-- -----------------------------------------------------------------------------
-- likes
-- -----------------------------------------------------------------------------
CREATE TABLE public.likes (
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_likes_post ON public.likes (post_id);

-- -----------------------------------------------------------------------------
-- comments
-- -----------------------------------------------------------------------------
CREATE TABLE public.comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX idx_comments_post ON public.comments (post_id, created_at);
CREATE INDEX idx_comments_user ON public.comments (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- follows
-- -----------------------------------------------------------------------------
CREATE TABLE public.follows (
    follower_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    following_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id <> following_id)
);

CREATE INDEX idx_follows_following ON public.follows (following_id);
CREATE INDEX idx_follows_follower ON public.follows (follower_id);

-- -----------------------------------------------------------------------------
-- follow_requests
-- -----------------------------------------------------------------------------
CREATE TABLE public.follow_requests (
    id BIGSERIAL PRIMARY KEY,
    requester_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    target_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    UNIQUE (requester_id, target_id),
    CHECK (requester_id <> target_id)
);

CREATE INDEX idx_follow_requests_target ON public.follow_requests (target_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- close_friends
-- -----------------------------------------------------------------------------
CREATE TABLE public.close_friends (
    owner_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    friend_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (owner_id, friend_id),
    CHECK (owner_id <> friend_id)
);

CREATE INDEX idx_close_friends_owner ON public.close_friends (owner_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- stories
-- -----------------------------------------------------------------------------
CREATE TABLE public.stories (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    image TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image',
    audience TEXT NOT NULL DEFAULT 'public',
    caption TEXT NOT NULL DEFAULT '',
    mentions TEXT NOT NULL DEFAULT '[]',
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
);

CREATE INDEX idx_stories_expiry ON public.stories (expires_at);
CREATE INDEX idx_stories_user ON public.stories (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- story_views
-- -----------------------------------------------------------------------------
CREATE TABLE public.story_views (
    story_id BIGINT NOT NULL REFERENCES public.stories (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    viewed_at BIGINT NOT NULL,
    PRIMARY KEY (story_id, user_id)
);

CREATE INDEX idx_story_views_user ON public.story_views (user_id, viewed_at DESC);

-- -----------------------------------------------------------------------------
-- story_reactions
-- -----------------------------------------------------------------------------
CREATE TABLE public.story_reactions (
    story_id BIGINT NOT NULL REFERENCES public.stories (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (story_id, user_id)
);

CREATE INDEX idx_story_reactions_story ON public.story_reactions (story_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- shares
-- -----------------------------------------------------------------------------
CREATE TABLE public.shares (
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_shares_post ON public.shares (post_id);

-- -----------------------------------------------------------------------------
-- blocks
-- -----------------------------------------------------------------------------
CREATE TABLE public.blocks (
    blocker_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    blocked_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_blocks_blocked ON public.blocks (blocked_id);

-- -----------------------------------------------------------------------------
-- reports
-- -----------------------------------------------------------------------------
CREATE TABLE public.reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('user', 'post', 'story', 'message')),
    target_id BIGINT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
    created_at BIGINT NOT NULL,
    reviewed_at BIGINT
);

CREATE INDEX idx_reports_status ON public.reports (status, created_at);

-- -----------------------------------------------------------------------------
-- problem_reports
-- -----------------------------------------------------------------------------
CREATE TABLE public.problem_reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('bug', 'layout', 'login', 'performance', 'moderation', 'other')),
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    context TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
    created_at BIGINT NOT NULL,
    reviewed_at BIGINT
);

CREATE INDEX idx_problem_reports_status ON public.problem_reports (status, created_at);

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
CREATE TABLE public.notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    link TEXT,
    created_at BIGINT NOT NULL,
    read_at BIGINT
);

CREATE INDEX idx_notifications_user ON public.notifications (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- identity_verifications
-- -----------------------------------------------------------------------------
CREATE TABLE public.identity_verifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('in_review', 'approved', 'rejected', 'needs_review', 'expired')),
    is_simulation INTEGER NOT NULL DEFAULT 0,
    provider_ref TEXT,
    submitted_at BIGINT,
    reviewed_at BIGINT,
    expires_at BIGINT,
    reason TEXT
);

-- -----------------------------------------------------------------------------
-- dating_profiles
-- -----------------------------------------------------------------------------
CREATE TABLE public.dating_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
    bio TEXT NOT NULL DEFAULT '',
    photos TEXT NOT NULL DEFAULT '[]',
    interests TEXT NOT NULL DEFAULT '[]',
    goals TEXT NOT NULL DEFAULT '[]',
    age_min INTEGER NOT NULL DEFAULT 24,
    age_max INTEGER NOT NULL DEFAULT 45,
    distance_km INTEGER NOT NULL DEFAULT 50,
    active INTEGER NOT NULL DEFAULT 1,
    paused INTEGER NOT NULL DEFAULT 0,
    radar_enabled INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX idx_dating_active ON public.dating_profiles (active, paused);

-- -----------------------------------------------------------------------------
-- compatibility_answers
-- -----------------------------------------------------------------------------
CREATE TABLE public.compatibility_answers (
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    answer TEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, question_id)
);

-- -----------------------------------------------------------------------------
-- dating_likes
-- -----------------------------------------------------------------------------
CREATE TABLE public.dating_likes (
    from_user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    to_user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
    created_at BIGINT NOT NULL,
    PRIMARY KEY (from_user_id, to_user_id),
    CHECK (from_user_id <> to_user_id)
);

CREATE INDEX idx_dating_likes_target ON public.dating_likes (to_user_id, action);

-- -----------------------------------------------------------------------------
-- matches
-- -----------------------------------------------------------------------------
CREATE TABLE public.matches (
    id BIGSERIAL PRIMARY KEY,
    user_a BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    user_b BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    ended_at BIGINT,
    ended_by BIGINT REFERENCES public.users (id) ON DELETE SET NULL,
    CHECK (user_a < user_b)
);

CREATE UNIQUE INDEX idx_matches_active_pair ON public.matches (user_a, user_b) WHERE ended_at IS NULL;
CREATE INDEX idx_matches_user_a ON public.matches (user_a, ended_at);
CREATE INDEX idx_matches_user_b ON public.matches (user_b, ended_at);

-- -----------------------------------------------------------------------------
-- conversations
-- -----------------------------------------------------------------------------
CREATE TABLE public.conversations (
    id BIGSERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('social', 'dating')),
    match_id BIGINT UNIQUE REFERENCES public.matches (id) ON DELETE SET NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- -----------------------------------------------------------------------------
-- conversation_members
-- -----------------------------------------------------------------------------
CREATE TABLE public.conversation_members (
    conversation_id BIGINT NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    last_read_at BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_members_user ON public.conversation_members (user_id);

-- -----------------------------------------------------------------------------
-- messages
-- -----------------------------------------------------------------------------
CREATE TABLE public.messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    body TEXT NOT NULL DEFAULT '',
    shared_post_id BIGINT REFERENCES public.posts (id) ON DELETE SET NULL,
    created_at BIGINT NOT NULL,
    deleted_at BIGINT
);

CREATE INDEX idx_messages_conversation ON public.messages (conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- location_consents
-- -----------------------------------------------------------------------------
CREATE TABLE public.location_consents (
    match_id BIGINT NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (match_id, user_id)
);

-- -----------------------------------------------------------------------------
-- location_snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE public.location_snapshots (
    user_id BIGINT PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL
);

-- -----------------------------------------------------------------------------
-- radar_prefs
-- -----------------------------------------------------------------------------
CREATE TABLE public.radar_prefs (
    user_id BIGINT PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
    alerts_enabled INTEGER NOT NULL DEFAULT 0,
    threshold_m INTEGER NOT NULL DEFAULT 1000,
    updated_at BIGINT NOT NULL
);

-- -----------------------------------------------------------------------------
-- radar_alerts
-- -----------------------------------------------------------------------------
CREATE TABLE public.radar_alerts (
    match_id BIGINT NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    last_notified_at BIGINT NOT NULL,
    distance_m INTEGER NOT NULL,
    PRIMARY KEY (match_id, user_id)
);

-- =============================================================================
-- Grants: expõe as tabelas ao Data API (PostgREST).
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
