-- =============================================================================
-- Vibra · comunidades (tabelas, RLS e grants)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- communities
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communities (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    avatar TEXT,
    created_by BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_communities_created_by ON public.communities (created_by);

-- -----------------------------------------------------------------------------
-- community_members (sem coluna id — chave composta)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_members (
    community_id BIGINT NOT NULL REFERENCES public.communities (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    created_at BIGINT NOT NULL,
    PRIMARY KEY (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_members_user ON public.community_members (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

-- communities
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communities_select ON public.communities;
CREATE POLICY communities_select ON public.communities
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS communities_insert ON public.communities;
CREATE POLICY communities_insert ON public.communities
    FOR INSERT TO authenticated
    WITH CHECK (created_by = private.current_vibra_user_id());

DROP POLICY IF EXISTS communities_update ON public.communities;
CREATE POLICY communities_update ON public.communities
    FOR UPDATE TO authenticated
    USING (created_by = private.current_vibra_user_id())
    WITH CHECK (created_by = private.current_vibra_user_id());

DROP POLICY IF EXISTS communities_delete ON public.communities;
CREATE POLICY communities_delete ON public.communities
    FOR DELETE TO authenticated
    USING (created_by = private.current_vibra_user_id());

-- community_members
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_members_select ON public.community_members;
CREATE POLICY community_members_select ON public.community_members
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS community_members_insert ON public.community_members;
CREATE POLICY community_members_insert ON public.community_members
    FOR INSERT TO authenticated
    WITH CHECK (user_id = private.current_vibra_user_id());

DROP POLICY IF EXISTS community_members_delete ON public.community_members;
CREATE POLICY community_members_delete ON public.community_members
    FOR DELETE TO authenticated
    USING (
        user_id = private.current_vibra_user_id()
        OR community_id IN (
            SELECT c.id FROM public.communities c WHERE c.created_by = private.current_vibra_user_id()
        )
    );

-- -----------------------------------------------------------------------------
-- Grants Data API
-- -----------------------------------------------------------------------------

-- anon: leitura de comunidades e membros
GRANT SELECT ON public.communities TO anon;
GRANT SELECT ON public.community_members TO anon;

-- authenticated: CRUD controlado por RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_members TO authenticated;

-- service_role: acesso total
GRANT ALL ON public.communities TO service_role;
GRANT ALL ON public.community_members TO service_role;