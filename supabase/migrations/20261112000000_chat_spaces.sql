-- =============================================================================
-- Vibra · Espaços e Canais de Chat (chat_spaces, chat_channels, chat_messages)
-- =============================================================================
-- Inclui tabelas, índices, FKs, helpers RLS, políticas e grants.
-- IDs BIGSERIAL, timestamps BIGINT (ms epoch). Segue padrão do schema existente.
-- =============================================================================

-- ---------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_spaces (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    avatar TEXT,
    created_by BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chat_space_members (
    space_id BIGINT NOT NULL REFERENCES public.chat_spaces (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
    presence TEXT NOT NULL DEFAULT 'offline' CHECK (presence IN ('online', 'idle', 'offline')),
    created_at BIGINT NOT NULL,
    PRIMARY KEY (space_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_space_members_user ON public.chat_space_members (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_channels (
    id BIGSERIAL PRIMARY KEY,
    space_id BIGINT NOT NULL REFERENCES public.chat_spaces (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    topic TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    position INTEGER NOT NULL DEFAULT 0,
    created_by BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (space_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_chat_channels_space ON public.chat_channels (space_id, position, id);

CREATE TABLE IF NOT EXISTS public.chat_channel_members (
    channel_id BIGINT NOT NULL REFERENCES public.chat_channels (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    last_read_at BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user ON public.chat_channel_members (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id BIGSERIAL PRIMARY KEY,
    channel_id BIGINT NOT NULL REFERENCES public.chat_channels (id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    body TEXT NOT NULL DEFAULT '',
    shared_post_id BIGINT REFERENCES public.posts (id) ON DELETE SET NULL,
    created_at BIGINT NOT NULL,
    edited_at BIGINT,
    deleted_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON public.chat_messages (channel_id, id);

CREATE TABLE IF NOT EXISTS public.chat_message_media (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES public.chat_messages (id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'file')),
    mime_type TEXT,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    file_name TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_message_media_msg ON public.chat_message_media (message_id, position, id);

-- ---------------------------------------------------------------
-- Adicionar coluna edited_at em messages (DMs) se ausente
-- ---------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'edited_at'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN edited_at BIGINT;
    END IF;
END $$;

-- ---------------------------------------------------------------
-- Helpers RLS (SECURITY DEFINER, owner postgres)
-- ---------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Helper: resolve usuário interno via auth_uid, com search_path seguro
CREATE OR REPLACE FUNCTION private.current_vibra_user_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT u.id
    FROM public.users u
    WHERE u.auth_uid = auth.uid();
$$;

ALTER FUNCTION private.current_vibra_user_id() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.current_vibra_user_id() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.current_vibra_user_id() TO authenticated;

-- Helper: role do usuário no espaço
CREATE OR REPLACE FUNCTION private.chat_space_role(
    p_space_id BIGINT,
    p_user_id BIGINT
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT csm.role
    FROM public.chat_space_members csm
    WHERE csm.space_id = p_space_id
      AND csm.user_id = p_user_id
    LIMIT 1;
$$;

ALTER FUNCTION private.chat_space_role(BIGINT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.chat_space_role(BIGINT, BIGINT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.chat_space_role(BIGINT, BIGINT) TO authenticated;

-- Helper: criador do espaço (usado somente ao criar membership inicial)
CREATE OR REPLACE FUNCTION private.is_chat_space_creator(
    p_space_id BIGINT,
    p_user_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.chat_spaces cs
        WHERE cs.id = p_space_id
          AND cs.created_by = p_user_id
    );
$$;

ALTER FUNCTION private.is_chat_space_creator(BIGINT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.is_chat_space_creator(BIGINT, BIGINT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.is_chat_space_creator(BIGINT, BIGINT) TO authenticated;

-- Helper: dono do espaço com membership viva
CREATE OR REPLACE FUNCTION private.is_chat_space_owner(
    p_space_id BIGINT,
    p_user_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.chat_space_members csm
        JOIN public.chat_spaces cs ON cs.id = csm.space_id
        WHERE csm.space_id = p_space_id
          AND csm.user_id = p_user_id
          AND csm.role = 'owner'
          AND cs.created_by = p_user_id
    );
$$;

ALTER FUNCTION private.is_chat_space_owner(BIGINT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.is_chat_space_owner(BIGINT, BIGINT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.is_chat_space_owner(BIGINT, BIGINT) TO authenticated;

-- Helper: dono ou moderador do espaço
CREATE OR REPLACE FUNCTION private.can_manage_chat_space(
    p_space_id BIGINT,
    p_user_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.chat_space_members csm
        WHERE csm.space_id = p_space_id
          AND csm.user_id = p_user_id
          AND csm.role IN ('owner', 'moderator')
    );
$$;

ALTER FUNCTION private.can_manage_chat_space(BIGINT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.can_manage_chat_space(BIGINT, BIGINT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.can_manage_chat_space(BIGINT, BIGINT) TO authenticated;

-- Helper: membro do espaço
CREATE OR REPLACE FUNCTION private.is_chat_space_member(
    p_space_id BIGINT,
    p_user_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.chat_space_members csm
        WHERE csm.space_id = p_space_id
          AND csm.user_id = p_user_id
    );
$$;

ALTER FUNCTION private.is_chat_space_member(BIGINT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.is_chat_space_member(BIGINT, BIGINT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.is_chat_space_member(BIGINT, BIGINT) TO authenticated;

-- Helper: space_id a partir de channel
CREATE OR REPLACE FUNCTION private.chat_channel_space_id(
    p_channel_id BIGINT
)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT c.space_id
    FROM public.chat_channels c
    WHERE c.id = p_channel_id;
$$;

ALTER FUNCTION private.chat_channel_space_id(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.chat_channel_space_id(BIGINT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.chat_channel_space_id(BIGINT) TO authenticated;

-- Helper: membro explícito do canal E do espaço
CREATE OR REPLACE FUNCTION private.is_chat_channel_member(
    p_channel_id BIGINT,
    p_user_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.chat_channel_members ccm
        JOIN public.chat_channels c ON c.id = ccm.channel_id
        JOIN public.chat_space_members csm ON csm.space_id = c.space_id AND csm.user_id = ccm.user_id
        WHERE ccm.channel_id = p_channel_id
          AND ccm.user_id = p_user_id
    );
$$;

ALTER FUNCTION private.is_chat_channel_member(BIGINT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.is_chat_channel_member(BIGINT, BIGINT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.is_chat_channel_member(BIGINT, BIGINT) TO authenticated;

-- Helper: pode gerenciar canal (criador do canal OU dono/moderador do espaço)
CREATE OR REPLACE FUNCTION private.can_manage_chat_channel(
    p_channel_id BIGINT,
    p_user_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.chat_channels c
        JOIN public.chat_spaces cs ON cs.id = c.space_id
        JOIN public.chat_space_members csm ON csm.space_id = cs.id AND csm.user_id = p_user_id
        WHERE c.id = p_channel_id
          AND (c.created_by = p_user_id OR csm.role IN ('owner', 'moderator'))
    );
$$;

ALTER FUNCTION private.can_manage_chat_channel(BIGINT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.can_manage_chat_channel(BIGINT, BIGINT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.can_manage_chat_channel(BIGINT, BIGINT) TO authenticated;

-- Helper: membro do espaço do canal (para validação de adição de membros)
CREATE OR REPLACE FUNCTION private.is_chat_channel_space_member(
    p_channel_id BIGINT,
    p_user_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.chat_channels c
        JOIN public.chat_space_members csm ON csm.space_id = c.space_id
        WHERE c.id = p_channel_id
          AND csm.user_id = p_user_id
    );
$$;

ALTER FUNCTION private.is_chat_channel_space_member(BIGINT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.is_chat_channel_space_member(BIGINT, BIGINT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.is_chat_channel_space_member(BIGINT, BIGINT) TO authenticated;

-- Helper: pode acessar canal (público + membro do espaço OU membro explícito do canal)
CREATE OR REPLACE FUNCTION private.can_access_chat_channel(
    p_channel_id BIGINT,
    p_user_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.chat_channels c
        JOIN public.chat_space_members csm ON csm.space_id = c.space_id
        WHERE c.id = p_channel_id
          AND csm.user_id = p_user_id
          AND (
            c.visibility = 'public'
            OR EXISTS (
                SELECT 1 FROM public.chat_channel_members ccm
                WHERE ccm.channel_id = c.id
                  AND ccm.user_id = p_user_id
            )
          )
    );
$$;

ALTER FUNCTION private.can_access_chat_channel(BIGINT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.can_access_chat_channel(BIGINT, BIGINT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_chat_channel(BIGINT, BIGINT) TO authenticated;

-- ---------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------

-- chat_spaces
ALTER TABLE public.chat_spaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_spaces_select ON public.chat_spaces;
CREATE POLICY chat_spaces_select ON public.chat_spaces
    FOR SELECT TO authenticated
    USING (private.is_chat_space_member(id, private.current_vibra_user_id()));

DROP POLICY IF EXISTS chat_spaces_insert ON public.chat_spaces;
CREATE POLICY chat_spaces_insert ON public.chat_spaces
    FOR INSERT TO authenticated
    WITH CHECK (created_by = private.current_vibra_user_id());

DROP POLICY IF EXISTS chat_spaces_update ON public.chat_spaces;
CREATE POLICY chat_spaces_update ON public.chat_spaces
    FOR UPDATE TO authenticated
    USING (
        private.chat_space_role(id, private.current_vibra_user_id()) IN ('owner', 'moderator')
    )
    WITH CHECK (
        private.chat_space_role(id, private.current_vibra_user_id()) IN ('owner', 'moderator')
    );

DROP POLICY IF EXISTS chat_spaces_delete ON public.chat_spaces;
CREATE POLICY chat_spaces_delete ON public.chat_spaces
    FOR DELETE TO authenticated
    USING (
        private.is_chat_space_owner(id, private.current_vibra_user_id())
    );

-- chat_space_members
ALTER TABLE public.chat_space_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_space_members_select ON public.chat_space_members;
CREATE POLICY chat_space_members_select ON public.chat_space_members
    FOR SELECT TO authenticated
    USING (private.is_chat_space_member(space_id, private.current_vibra_user_id()));

DROP POLICY IF EXISTS chat_space_members_insert ON public.chat_space_members;
CREATE POLICY chat_space_members_insert ON public.chat_space_members
    FOR INSERT TO authenticated
    WITH CHECK (
        -- dono cria sua própria membership junto com o espaço
        (
            user_id = private.current_vibra_user_id()
            AND private.is_chat_space_creator(space_id, private.current_vibra_user_id())
        )
        -- dono/moderador adiciona outros
        OR private.chat_space_role(space_id, private.current_vibra_user_id()) IN ('owner', 'moderator')
    );

DROP POLICY IF EXISTS chat_space_members_delete ON public.chat_space_members;
CREATE POLICY chat_space_members_delete ON public.chat_space_members
    FOR DELETE TO authenticated
    USING (
        private.chat_space_role(space_id, private.current_vibra_user_id()) IN ('owner', 'moderator')
    );

-- chat_channels
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_channels_select ON public.chat_channels;
CREATE POLICY chat_channels_select ON public.chat_channels
    FOR SELECT TO authenticated
    USING (private.can_access_chat_channel(id, private.current_vibra_user_id()));

DROP POLICY IF EXISTS chat_channels_insert ON public.chat_channels;
CREATE POLICY chat_channels_insert ON public.chat_channels
    FOR INSERT TO authenticated
    WITH CHECK (
        private.can_manage_chat_space(space_id, private.current_vibra_user_id())
    );

DROP POLICY IF EXISTS chat_channels_update ON public.chat_channels;
CREATE POLICY chat_channels_update ON public.chat_channels
    FOR UPDATE TO authenticated
    USING (
        private.can_manage_chat_channel(id, private.current_vibra_user_id())
    )
    WITH CHECK (
        private.can_manage_chat_channel(id, private.current_vibra_user_id())
    );

DROP POLICY IF EXISTS chat_channels_delete ON public.chat_channels;
CREATE POLICY chat_channels_delete ON public.chat_channels
    FOR DELETE TO authenticated
    USING (
        private.can_manage_chat_channel(id, private.current_vibra_user_id())
    );

-- chat_channel_members
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_channel_members_select ON public.chat_channel_members;
CREATE POLICY chat_channel_members_select ON public.chat_channel_members
    FOR SELECT TO authenticated
    USING (private.is_chat_channel_member(channel_id, private.current_vibra_user_id()));

DROP POLICY IF EXISTS chat_channel_members_insert ON public.chat_channel_members;
CREATE POLICY chat_channel_members_insert ON public.chat_channel_members
    FOR INSERT TO authenticated
    WITH CHECK (
        private.can_manage_chat_channel(channel_id, private.current_vibra_user_id())
        AND private.is_chat_channel_space_member(channel_id, user_id)
    );

DROP POLICY IF EXISTS chat_channel_members_update ON public.chat_channel_members;
CREATE POLICY chat_channel_members_update ON public.chat_channel_members
    FOR UPDATE TO authenticated
    USING (private.is_chat_channel_member(channel_id, private.current_vibra_user_id()))
    WITH CHECK (private.is_chat_channel_member(channel_id, private.current_vibra_user_id()));

DROP POLICY IF EXISTS chat_channel_members_delete ON public.chat_channel_members;
CREATE POLICY chat_channel_members_delete ON public.chat_channel_members
    FOR DELETE TO authenticated
    USING (
        private.can_manage_chat_channel(channel_id, private.current_vibra_user_id())
    );

-- chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages
    FOR SELECT TO authenticated
    USING (
        private.can_access_chat_channel(channel_id, private.current_vibra_user_id())
    );

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = private.current_vibra_user_id()
        AND private.is_chat_channel_member(channel_id, private.current_vibra_user_id())
    );

DROP POLICY IF EXISTS chat_messages_update ON public.chat_messages;
CREATE POLICY chat_messages_update ON public.chat_messages
    FOR UPDATE TO authenticated
    USING (
        sender_id = private.current_vibra_user_id()
        AND private.is_chat_channel_member(channel_id, private.current_vibra_user_id())
    )
    WITH CHECK (
        sender_id = private.current_vibra_user_id()
        AND private.is_chat_channel_member(channel_id, private.current_vibra_user_id())
    );

DROP POLICY IF EXISTS chat_messages_delete ON public.chat_messages;
CREATE POLICY chat_messages_delete ON public.chat_messages
    FOR DELETE TO authenticated
    USING (
        sender_id = private.current_vibra_user_id()
        AND private.is_chat_channel_member(channel_id, private.current_vibra_user_id())
    );

-- chat_message_media
ALTER TABLE public.chat_message_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_message_media_select ON public.chat_message_media;
CREATE POLICY chat_message_media_select ON public.chat_message_media
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.chat_messages cm
            WHERE cm.id = chat_message_media.message_id
              AND cm.deleted_at IS NULL
              AND private.can_access_chat_channel(cm.channel_id, private.current_vibra_user_id())
        )
    );

-- ---------------------------------------------------------------
-- Grants: authenticated SELECT only; anon none; service_role full
-- ---------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE public.chat_spaces FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.chat_spaces_id_seq FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.chat_space_members FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.chat_channels FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.chat_channels_id_seq FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.chat_channel_members FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.chat_messages FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.chat_messages_id_seq FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.chat_message_media FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.chat_message_media_id_seq FROM anon, authenticated;

GRANT SELECT ON TABLE public.chat_spaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_spaces TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.chat_spaces_id_seq TO service_role;

GRANT SELECT ON TABLE public.chat_space_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_space_members TO service_role;

GRANT SELECT ON TABLE public.chat_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_channels TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.chat_channels_id_seq TO service_role;

GRANT SELECT ON TABLE public.chat_channel_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_channel_members TO service_role;

GRANT SELECT ON TABLE public.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_messages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.chat_messages_id_seq TO service_role;

GRANT SELECT ON TABLE public.chat_message_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_message_media TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.chat_message_media_id_seq TO service_role;

-- ---------------------------------------------------------------
-- Assertions pós-migração
-- ---------------------------------------------------------------

DO $$
DECLARE
    fn_row record;
    rls_enabled boolean;
    rls_table record;
    policy_row record;
    grant_row record;
    helper_count integer := 0;
BEGIN
    -- Helpers existem e são SECURITY DEFINER owner postgres
    FOR fn_row IN
        SELECT proname, prosrc, proconfig, prosecdef
        FROM pg_proc
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'private')
          AND proname IN (
              'chat_space_role',
              'is_chat_space_creator',
              'is_chat_space_owner',
              'can_manage_chat_space',
              'is_chat_space_member',
              'chat_channel_space_id',
              'is_chat_channel_member',
              'can_manage_chat_channel',
              'is_chat_channel_space_member',
              'can_access_chat_channel'
          )
    LOOP
        helper_count := helper_count + 1;
        IF NOT fn_row.prosecdef THEN RAISE EXCEPTION 'helper % não SECURITY DEFINER', fn_row.proname; END IF;
        -- verifica search_path seguro
        IF fn_row.proconfig IS NULL OR NOT (array_to_string(fn_row.proconfig, ',') ILIKE '%search_path=pg_catalog, public%') THEN
            RAISE EXCEPTION 'helper % search_path inseguro', fn_row.proname;
        END IF;
    END LOOP;
    IF helper_count <> 10 THEN RAISE EXCEPTION 'helpers esperados 10, encontrados %', helper_count; END IF;

    -- RLS habilitado nas 6 tabelas
    FOR rls_table IN SELECT 'chat_spaces' AS t UNION ALL SELECT 'chat_space_members'
        UNION ALL SELECT 'chat_channels' UNION ALL SELECT 'chat_channel_members'
        UNION ALL SELECT 'chat_messages' UNION ALL SELECT 'chat_message_media'
    LOOP
        EXECUTE format('SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=%L AND c.relname=%L', 'public', rls_table.t)
        INTO rls_enabled;
        IF NOT rls_enabled THEN RAISE EXCEPTION 'RLS não habilitado em %', rls_table.t; END IF;
    END LOOP;

    -- chat_message_media: apenas SELECT para authenticated
    FOR policy_row IN
        SELECT policyname, cmd, roles::text AS role_list
        FROM pg_policies
        WHERE schemaname='public' AND tablename='chat_message_media'
    LOOP
        IF policy_row.cmd <> 'SELECT' OR policy_row.role_list NOT LIKE '%authenticated%' THEN
            RAISE EXCEPTION 'política inesperada %: % %', policy_row.policyname, policy_row.cmd, policy_row.role_list;
        END IF;
    END LOOP;

    -- Grants table
    FOR grant_row IN
        SELECT grantee, privilege_type
        FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name='chat_message_media'
    LOOP
        IF grant_row.grantee = 'authenticated' AND grant_row.privilege_type <> 'SELECT' THEN
            RAISE EXCEPTION 'authenticated tem % em chat_message_media', grant_row.privilege_type;
        END IF;
        IF grant_row.grantee = 'anon' THEN
            RAISE EXCEPTION 'anon tem privilégio % em chat_message_media', grant_row.privilege_type;
        END IF;
    END LOOP;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name='chat_message_media'
          AND grantee='service_role' AND privilege_type IN ('INSERT','UPDATE','DELETE')
    ) THEN
        RAISE EXCEPTION 'service_role sem escrita completa em chat_message_media';
    END IF;

    -- Sequence grants
    IF EXISTS (
        SELECT 1 FROM information_schema.role_usage_grants
        WHERE object_schema='public' AND object_name='chat_message_media_id_seq'
          AND grantee IN ('authenticated','anon')
    ) THEN
        RAISE EXCEPTION 'authenticated/anon têm USAGE na sequence chat_message_media_id_seq';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.role_usage_grants
        WHERE object_schema='public' AND object_name='chat_message_media_id_seq'
          AND grantee='service_role' AND privilege_type='USAGE'
    ) THEN
        RAISE EXCEPTION 'service_role sem USAGE na sequence chat_message_media_id_seq';
    END IF;
END $$;