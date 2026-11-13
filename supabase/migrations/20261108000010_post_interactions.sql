-- =============================================================================
-- Vibra · reposts e saved_posts (bookmarks)
--
-- Para contadores e flags no feed estilo Instagram
-- =============================================================================

-- reposts (shares já existe para compartilhamento externo; repost é "repostar no feed")
CREATE TABLE IF NOT EXISTS reposts (
  user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_reposts_post ON public.reposts (post_id, created_at DESC);

ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY reposts_select ON public.reposts
    FOR SELECT TO public
    USING (true);

CREATE POLICY reposts_insert ON public.reposts
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY reposts_delete ON public.reposts
    FOR DELETE TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- saved_posts (bookmarks/salvos)
CREATE TABLE IF NOT EXISTS saved_posts (
  user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_posts_post ON public.saved_posts (post_id, created_at DESC);

ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_posts_select ON public.saved_posts
    FOR SELECT TO public
    USING (true);

CREATE POLICY saved_posts_insert ON public.saved_posts
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY saved_posts_delete ON public.saved_posts
    FOR DELETE TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- Grants Data API
GRANT SELECT ON public.reposts TO anon, authenticated, service_role;
GRANT SELECT ON public.saved_posts TO anon, authenticated, service_role;

GRANT INSERT ON public.reposts TO authenticated, service_role;
GRANT INSERT ON public.saved_posts TO authenticated, service_role;

GRANT DELETE ON public.reposts TO authenticated, service_role;
GRANT DELETE ON public.saved_posts TO authenticated, service_role;