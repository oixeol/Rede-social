-- =============================================================================
-- Vibra · community posts (tabelas, RLS e grants)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- community_posts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_posts (
    id BIGSERIAL PRIMARY KEY,
    community_id BIGINT NOT NULL REFERENCES public.communities (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    text TEXT NOT NULL DEFAULT '',
    reply_to_id BIGINT REFERENCES public.community_posts (id) ON DELETE SET NULL,
    shared_post_id BIGINT REFERENCES public.posts (id) ON DELETE SET NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT,
    deleted_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_community_posts_community ON public.community_posts (community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON public.community_posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_reply ON public.community_posts (reply_to_id);

-- -----------------------------------------------------------------------------
-- community_post_media
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_post_media (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES public.community_posts (id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'file')),
    mime_type TEXT,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    file_name TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_post_media_post ON public.community_post_media (post_id, position, id);

-- -----------------------------------------------------------------------------
-- community_post_likes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_post_likes (
    post_id BIGINT NOT NULL REFERENCES public.community_posts (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_post_likes_user ON public.community_post_likes (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- community_post_reposts (retweets/shares)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_post_reposts (
    post_id BIGINT NOT NULL REFERENCES public.community_posts (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_post_reposts_user ON public.community_post_reposts (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

-- community_posts
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_posts_select ON public.community_posts;
CREATE POLICY community_posts_select ON public.community_posts
    FOR SELECT TO public
    USING (
        deleted_at IS NULL
        AND community_id IN (
            SELECT cm.community_id FROM public.community_members cm WHERE cm.user_id = private.current_vibra_user_id()
        )
    );

DROP POLICY IF EXISTS community_posts_insert ON public.community_posts;
CREATE POLICY community_posts_insert ON public.community_posts
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = private.current_vibra_user_id()
        AND community_id IN (
            SELECT cm.community_id FROM public.community_members cm WHERE cm.user_id = private.current_vibra_user_id()
        )
    );

DROP POLICY IF EXISTS community_posts_update ON public.community_posts;
CREATE POLICY community_posts_update ON public.community_posts
    FOR UPDATE TO authenticated
    USING (user_id = private.current_vibra_user_id())
    WITH CHECK (user_id = private.current_vibra_user_id());

DROP POLICY IF EXISTS community_posts_delete ON public.community_posts;
CREATE POLICY community_posts_delete ON public.community_posts
    FOR DELETE TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- community_post_media
ALTER TABLE public.community_post_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_post_media_select ON public.community_post_media;
CREATE POLICY community_post_media_select ON public.community_post_media
    FOR SELECT TO public
    USING (
        post_id IN (
            SELECT cp.id FROM public.community_posts cp
            WHERE cp.deleted_at IS NULL
            AND cp.community_id IN (
                SELECT cm.community_id FROM public.community_members cm WHERE cm.user_id = private.current_vibra_user_id()
            )
        )
    );

DROP POLICY IF EXISTS community_post_media_insert ON public.community_post_media;
CREATE POLICY community_post_media_insert ON public.community_post_media
    FOR INSERT TO authenticated
    WITH CHECK (
        post_id IN (
            SELECT cp.id FROM public.community_posts cp
            WHERE cp.user_id = private.current_vibra_user_id()
            AND cp.community_id IN (
                SELECT cm.community_id FROM public.community_members cm WHERE cm.user_id = private.current_vibra_user_id()
            )
        )
    );

-- community_post_likes
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_post_likes_select ON public.community_post_likes;
CREATE POLICY community_post_likes_select ON public.community_post_likes
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS community_post_likes_insert ON public.community_post_likes;
CREATE POLICY community_post_likes_insert ON public.community_post_likes
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

DROP POLICY IF EXISTS community_post_likes_delete ON public.community_post_likes;
CREATE POLICY community_post_likes_delete ON public.community_post_likes
    FOR DELETE TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- community_post_reposts
ALTER TABLE public.community_post_reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_post_reposts_select ON public.community_post_reposts;
CREATE POLICY community_post_reposts_select ON public.community_post_reposts
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS community_post_reposts_insert ON public.community_post_reposts;
CREATE POLICY community_post_reposts_insert ON public.community_post_reposts
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

DROP POLICY IF EXISTS community_post_reposts_delete ON public.community_post_reposts;
CREATE POLICY community_post_reposts_delete ON public.community_post_reposts
    FOR DELETE TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- Grants Data API
-- -----------------------------------------------------------------------------

-- anon: leitura controlada por RLS
GRANT SELECT ON public.community_posts TO anon;
GRANT SELECT ON public.community_post_media TO anon;
GRANT SELECT ON public.community_post_likes TO anon;
GRANT SELECT ON public.community_post_reposts TO anon;

-- authenticated: CRUD controlado por RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_post_media TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_post_likes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_post_reposts TO authenticated;

-- service_role: acesso total
GRANT ALL ON public.community_posts TO service_role;
GRANT ALL ON public.community_post_media TO service_role;
GRANT ALL ON public.community_post_likes TO service_role;
GRANT ALL ON public.community_post_reposts TO service_role;