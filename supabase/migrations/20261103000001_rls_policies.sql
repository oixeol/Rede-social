-- =============================================================================
-- Vibra · Row Level Security
--
-- O backend Node.js conecta com a role `postgres` (bypass de RLS) e continua
-- sendo a autoridade de autorização. Estas políticas protegem o acesso
-- direto via Data API/PostgREST, caso o frontend passe a falar com o
-- Supabase sem passar pelo backend.
--
-- IDs internos são BIGINT (herdados do SQLite). O vínculo com o usuário
-- autenticado do Supabase é feito por `users.auth_uid`, então toda política
-- resolve o usuário atual com `private.current_vibra_user_id()`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema privado: helper de resolução do usuário atual.
-- `private` não faz parte dos schemas expostos pelo Data API, então a função
-- não é alcançável pela API pública.
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.current_vibra_user_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT u.id
    FROM public.users u
    WHERE u.auth_uid = auth.uid();
$$;

REVOKE ALL ON FUNCTION private.current_vibra_user_id() FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_vibra_user_id() TO authenticated;

-- -----------------------------------------------------------------------------
-- Membership helper: evita recursão entre `conversation_members` e políticas
-- de conversas/mensagens. `SECURITY DEFINER` owned by `postgres` bypassa RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_conversation_member(
    p_conversation_id BIGINT,
    p_vibra_user_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.conversation_members cm
        WHERE cm.conversation_id = p_conversation_id
          AND cm.user_id = p_vibra_user_id
    );
$$;

REVOKE ALL ON FUNCTION private.is_conversation_member(BIGINT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_conversation_member(BIGINT, BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION private.is_conversation_member(BIGINT, BIGINT) TO authenticated;

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select ON public.users
    FOR SELECT TO authenticated
    USING (is_private = 0 OR auth_uid = auth.uid());

CREATE POLICY users_select_anon ON public.users
    FOR SELECT TO anon
    USING (is_private = 0);

CREATE POLICY users_insert ON public.users
    FOR INSERT TO authenticated
    WITH CHECK (auth_uid = auth.uid());

CREATE POLICY users_update ON public.users
    FOR UPDATE TO authenticated
    USING (auth_uid = auth.uid())
    WITH CHECK (auth_uid = auth.uid());

CREATE POLICY users_delete ON public.users
    FOR DELETE TO authenticated
    USING (auth_uid = auth.uid());

-- -----------------------------------------------------------------------------
-- sessions
-- -----------------------------------------------------------------------------
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_select ON public.sessions
    FOR SELECT TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- posts
-- -----------------------------------------------------------------------------
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY posts_select ON public.posts
    FOR SELECT TO public
    USING (true);

CREATE POLICY posts_insert ON public.posts
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY posts_update ON public.posts
    FOR UPDATE TO authenticated
    USING (user_id = private.current_vibra_user_id())
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY posts_delete ON public.posts
    FOR DELETE TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- post_media
-- -----------------------------------------------------------------------------
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY post_media_select ON public.post_media
    FOR SELECT TO public
    USING (true);

CREATE POLICY post_media_insert ON public.post_media
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.posts p
            WHERE p.id = post_id AND p.user_id = private.current_vibra_user_id()
        )
    );

CREATE POLICY post_media_delete ON public.post_media
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.posts p
            WHERE p.id = post_id AND p.user_id = private.current_vibra_user_id()
        )
    );

-- -----------------------------------------------------------------------------
-- likes
-- -----------------------------------------------------------------------------
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY likes_select ON public.likes
    FOR SELECT TO public
    USING (true);

CREATE POLICY likes_insert ON public.likes
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY likes_delete ON public.likes
    FOR DELETE TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- comments
-- -----------------------------------------------------------------------------
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_select ON public.comments
    FOR SELECT TO public
    USING (true);

CREATE POLICY comments_insert ON public.comments
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY comments_update ON public.comments
    FOR UPDATE TO authenticated
    USING (user_id = private.current_vibra_user_id())
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY comments_delete ON public.comments
    FOR DELETE TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- follows
-- -----------------------------------------------------------------------------
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY follows_select ON public.follows
    FOR SELECT TO public
    USING (true);

CREATE POLICY follows_insert ON public.follows
    FOR INSERT TO authenticated
    WITH CHECK (
        follower_id = private.current_vibra_user_id()
        AND following_id <> private.current_vibra_user_id()
    );

CREATE POLICY follows_delete ON public.follows
    FOR DELETE TO authenticated
    USING (follower_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- follow_requests
-- -----------------------------------------------------------------------------
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY follow_requests_select ON public.follow_requests
    FOR SELECT TO authenticated
    USING (
        requester_id = private.current_vibra_user_id()
        OR target_id = private.current_vibra_user_id()
    );

CREATE POLICY follow_requests_insert ON public.follow_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        requester_id = private.current_vibra_user_id()
        AND target_id <> private.current_vibra_user_id()
    );

CREATE POLICY follow_requests_delete ON public.follow_requests
    FOR DELETE TO authenticated
    USING (
        requester_id = private.current_vibra_user_id()
        OR target_id = private.current_vibra_user_id()
    );

-- -----------------------------------------------------------------------------
-- close_friends
-- -----------------------------------------------------------------------------
ALTER TABLE public.close_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY close_friends_select ON public.close_friends
    FOR SELECT TO authenticated
    USING (owner_id = private.current_vibra_user_id());

CREATE POLICY close_friends_insert ON public.close_friends
    FOR INSERT TO authenticated
    WITH CHECK (
        owner_id = private.current_vibra_user_id()
        AND friend_id <> private.current_vibra_user_id()
    );

CREATE POLICY close_friends_delete ON public.close_friends
    FOR DELETE TO authenticated
    USING (owner_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- stories
-- -----------------------------------------------------------------------------
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY stories_select ON public.stories
    FOR SELECT TO authenticated
    USING (
        audience = 'public'
        OR user_id = private.current_vibra_user_id()
        OR EXISTS (
            SELECT 1 FROM public.close_friends cf
            WHERE cf.owner_id = stories.user_id
              AND cf.friend_id = private.current_vibra_user_id()
        )
    );

CREATE POLICY stories_insert ON public.stories
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY stories_update ON public.stories
    FOR UPDATE TO authenticated
    USING (user_id = private.current_vibra_user_id())
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY stories_delete ON public.stories
    FOR DELETE TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- story_views
-- -----------------------------------------------------------------------------
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY story_views_select ON public.story_views
    FOR SELECT TO authenticated
    USING (
        user_id = private.current_vibra_user_id()
        OR EXISTS (
            SELECT 1 FROM public.stories s
            WHERE s.id = story_id AND s.user_id = private.current_vibra_user_id()
        )
    );

CREATE POLICY story_views_insert ON public.story_views
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- story_reactions
-- -----------------------------------------------------------------------------
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY story_reactions_select ON public.story_reactions
    FOR SELECT TO public
    USING (true);

CREATE POLICY story_reactions_insert ON public.story_reactions
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY story_reactions_delete ON public.story_reactions
    FOR DELETE TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- shares
-- -----------------------------------------------------------------------------
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY shares_select ON public.shares
    FOR SELECT TO public
    USING (true);

CREATE POLICY shares_insert ON public.shares
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY shares_delete ON public.shares
    FOR DELETE TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- blocks
-- -----------------------------------------------------------------------------
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocks_select ON public.blocks
    FOR SELECT TO authenticated
    USING (
        blocker_id = private.current_vibra_user_id()
        OR blocked_id = private.current_vibra_user_id()
    );

CREATE POLICY blocks_insert ON public.blocks
    FOR INSERT TO authenticated
    WITH CHECK (
        blocker_id = private.current_vibra_user_id()
        AND blocked_id <> private.current_vibra_user_id()
    );

CREATE POLICY blocks_delete ON public.blocks
    FOR DELETE TO authenticated
    USING (blocker_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- reports
-- -----------------------------------------------------------------------------
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_select ON public.reports
    FOR SELECT TO authenticated
    USING (reporter_id = private.current_vibra_user_id());

CREATE POLICY reports_insert ON public.reports
    FOR INSERT TO authenticated
    WITH CHECK (reporter_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- problem_reports
-- -----------------------------------------------------------------------------
ALTER TABLE public.problem_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY problem_reports_select ON public.problem_reports
    FOR SELECT TO authenticated
    USING (reporter_id = private.current_vibra_user_id());

CREATE POLICY problem_reports_insert ON public.problem_reports
    FOR INSERT TO authenticated
    WITH CHECK (reporter_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = private.current_vibra_user_id());

CREATE POLICY notifications_update ON public.notifications
    FOR UPDATE TO authenticated
    USING (user_id = private.current_vibra_user_id())
    WITH CHECK (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- identity_verifications
-- -----------------------------------------------------------------------------
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY identity_verifications_select ON public.identity_verifications
    FOR SELECT TO authenticated
    USING (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- dating_profiles
-- -----------------------------------------------------------------------------
ALTER TABLE public.dating_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY dating_profiles_select ON public.dating_profiles
    FOR SELECT TO authenticated
    USING (active = 1 AND paused = 0);

CREATE POLICY dating_profiles_select_own ON public.dating_profiles
    FOR SELECT TO authenticated
    USING (user_id = private.current_vibra_user_id());

CREATE POLICY dating_profiles_insert ON public.dating_profiles
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY dating_profiles_update ON public.dating_profiles
    FOR UPDATE TO authenticated
    USING (user_id = private.current_vibra_user_id())
    WITH CHECK (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- compatibility_answers
-- -----------------------------------------------------------------------------
ALTER TABLE public.compatibility_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY compatibility_answers_select ON public.compatibility_answers
    FOR SELECT TO authenticated
    USING (user_id = private.current_vibra_user_id());

CREATE POLICY compatibility_answers_insert ON public.compatibility_answers
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY compatibility_answers_update ON public.compatibility_answers
    FOR UPDATE TO authenticated
    USING (user_id = private.current_vibra_user_id())
    WITH CHECK (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- dating_likes
-- -----------------------------------------------------------------------------
ALTER TABLE public.dating_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY dating_likes_select ON public.dating_likes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.dating_profiles dp
            WHERE dp.user_id = dating_likes.to_user_id AND dp.active = 1 AND dp.paused = 0
        )
    );

CREATE POLICY dating_likes_insert ON public.dating_likes
    FOR INSERT TO authenticated
    WITH CHECK (from_user_id = private.current_vibra_user_id());

CREATE POLICY dating_likes_delete ON public.dating_likes
    FOR DELETE TO authenticated
    USING (from_user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- matches
-- -----------------------------------------------------------------------------
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY matches_select ON public.matches
    FOR SELECT TO authenticated
    USING (
        user_a = private.current_vibra_user_id()
        OR user_b = private.current_vibra_user_id()
    );

CREATE POLICY matches_insert ON public.matches
    FOR INSERT TO authenticated
    WITH CHECK (
        user_a = private.current_vibra_user_id()
        OR user_b = private.current_vibra_user_id()
    );

CREATE POLICY matches_update ON public.matches
    FOR UPDATE TO authenticated
    USING (
        user_a = private.current_vibra_user_id()
        OR user_b = private.current_vibra_user_id()
    )
    WITH CHECK (
        user_a = private.current_vibra_user_id()
        OR user_b = private.current_vibra_user_id()
    );

-- -----------------------------------------------------------------------------
-- conversations
-- -----------------------------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_select ON public.conversations
    FOR SELECT TO authenticated
    USING (private.is_conversation_member(id, private.current_vibra_user_id()));

CREATE POLICY conversations_insert ON public.conversations
    FOR INSERT TO authenticated
    WITH CHECK (
        kind = 'social'
        OR (
            kind = 'dating'
            AND EXISTS (
                SELECT 1 FROM public.matches m
                WHERE m.id = match_id
                  AND (m.user_a = private.current_vibra_user_id() OR m.user_b = private.current_vibra_user_id())
            )
        )
    );

CREATE POLICY conversations_update ON public.conversations
    FOR UPDATE TO authenticated
    USING (private.is_conversation_member(id, private.current_vibra_user_id()))
    WITH CHECK (private.is_conversation_member(id, private.current_vibra_user_id()));

-- -----------------------------------------------------------------------------
-- conversation_members
-- -----------------------------------------------------------------------------
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_members_select ON public.conversation_members
    FOR SELECT TO authenticated
    USING (
        private.is_conversation_member(
            conversation_members.conversation_id,
            private.current_vibra_user_id()
        )
    );

CREATE POLICY conversation_members_insert ON public.conversation_members
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY conversation_members_update ON public.conversation_members
    FOR UPDATE TO authenticated
    USING (user_id = private.current_vibra_user_id())
    WITH CHECK (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- messages
-- -----------------------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select ON public.messages
    FOR SELECT TO authenticated
    USING (
        private.is_conversation_member(
            messages.conversation_id,
            private.current_vibra_user_id()
        )
    );

CREATE POLICY messages_insert ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = private.current_vibra_user_id()
        AND private.is_conversation_member(
            messages.conversation_id,
            private.current_vibra_user_id()
        )
    );

CREATE POLICY messages_update ON public.messages
    FOR UPDATE TO authenticated
    USING (sender_id = private.current_vibra_user_id())
    WITH CHECK (sender_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- location_consents
-- -----------------------------------------------------------------------------
ALTER TABLE public.location_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY location_consents_select ON public.location_consents
    FOR SELECT TO authenticated
    USING (user_id = private.current_vibra_user_id());

CREATE POLICY location_consents_insert ON public.location_consents
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY location_consents_update ON public.location_consents
    FOR UPDATE TO authenticated
    USING (user_id = private.current_vibra_user_id())
    WITH CHECK (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- location_snapshots · dados sensíveis: somente o próprio usuário
-- -----------------------------------------------------------------------------
ALTER TABLE public.location_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY location_snapshots_select ON public.location_snapshots
    FOR SELECT TO authenticated
    USING (user_id = private.current_vibra_user_id());

CREATE POLICY location_snapshots_insert ON public.location_snapshots
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY location_snapshots_update ON public.location_snapshots
    FOR UPDATE TO authenticated
    USING (user_id = private.current_vibra_user_id())
    WITH CHECK (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- radar_prefs
-- -----------------------------------------------------------------------------
ALTER TABLE public.radar_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY radar_prefs_select ON public.radar_prefs
    FOR SELECT TO authenticated
    USING (user_id = private.current_vibra_user_id());

CREATE POLICY radar_prefs_insert ON public.radar_prefs
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY radar_prefs_update ON public.radar_prefs
    FOR UPDATE TO authenticated
    USING (user_id = private.current_vibra_user_id())
    WITH CHECK (user_id = private.current_vibra_user_id());

-- -----------------------------------------------------------------------------
-- radar_alerts
-- -----------------------------------------------------------------------------
ALTER TABLE public.radar_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY radar_alerts_select ON public.radar_alerts
    FOR SELECT TO authenticated
    USING (user_id = private.current_vibra_user_id());

CREATE POLICY radar_alerts_insert ON public.radar_alerts
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

CREATE POLICY radar_alerts_update ON public.radar_alerts
    FOR UPDATE TO authenticated
    USING (user_id = private.current_vibra_user_id())
    WITH CHECK (user_id = private.current_vibra_user_id());
