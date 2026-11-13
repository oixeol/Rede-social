-- =============================================================================
-- Orbit · Códigos de Convite para Espaços (space_invites)
-- =============================================================================
-- Tabela para códigos de convite alfanuméricos de 5 caracteres,
-- válidos por 1 hora, reutilizáveis após expiração.
-- =============================================================================

-- ---------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.space_invites (
    id BIGSERIAL PRIMARY KEY,
    code CHAR(5) NOT NULL UNIQUE,
    space_id BIGINT NOT NULL REFERENCES public.chat_spaces (id) ON DELETE CASCADE,
    created_by BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL,
    used_at BIGINT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_space_invites_space ON public.space_invites (space_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_space_invites_code ON public.space_invites (code);

-- ---------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------

ALTER TABLE public.space_invites ENABLE ROW LEVEL SECURITY;

-- Apenas donos/moderadores do espaço podem ver/criar convites
DROP POLICY IF EXISTS space_invites_select ON public.space_invites;
CREATE POLICY space_invites_select ON public.space_invites
    FOR SELECT TO authenticated
    USING (
        private.can_manage_chat_space(space_id, private.current_vibra_user_id())
    );

DROP POLICY IF EXISTS space_invites_insert ON public.space_invites;
CREATE POLICY space_invites_insert ON public.space_invites
    FOR INSERT TO authenticated
    WITH CHECK (
        private.can_manage_chat_space(space_id, private.current_vibra_user_id())
    );

-- ---------------------------------------------------------------
-- Grants: authenticated SELECT only; anon none; service_role full
-- ---------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE public.space_invites FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.space_invites_id_seq FROM anon, authenticated;

GRANT SELECT ON TABLE public.space_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.space_invites TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.space_invites_id_seq TO service_role;

-- ---------------------------------------------------------------
-- Helper: validar e consumir código de convite (para endpoint join)
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.consume_space_invite(
    p_code TEXT,
    p_user_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_invite record;
    v_now BIGINT := extract(epoch from now()) * 1000;
    v_space_id BIGINT;
    v_result JSONB;
BEGIN
    -- Buscar convite válido (não expirado, não usado)
    SELECT si.*, cs.created_by AS space_owner
    INTO v_invite
    FROM public.space_invites si
    JOIN public.chat_spaces cs ON cs.id = si.space_id
    WHERE si.code = p_code
      AND si.expires_at > v_now
      AND si.used_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Código de convite inválido ou expirado.',
            'code', 'INVALID_INVITE'
        );
    END IF;

    v_space_id := v_invite.space_id;

    -- Verificar se usuário já é membro
    IF EXISTS (
        SELECT 1 FROM public.chat_space_members
        WHERE space_id = v_space_id AND user_id = p_user_id
    ) THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Você já é membro deste espaço.',
            'code', 'ALREADY_MEMBER'
        );
    END IF;

    -- Adicionar usuário ao espaço
    INSERT INTO public.chat_space_members (space_id, user_id, role, created_at)
    VALUES (v_space_id, p_user_id, 'member', v_now);

    -- Adicionar aos canais públicos do espaço
    INSERT INTO public.chat_channel_members (channel_id, user_id, last_read_at, created_at)
    SELECT c.id, p_user_id, 0, v_now
    FROM public.chat_channels c
    WHERE c.space_id = v_space_id
      AND c.visibility = 'public'
      AND c.type = 'text'
    ON CONFLICT (channel_id, user_id) DO NOTHING;

    -- Marcar convite como usado
    UPDATE public.space_invites
    SET used_at = v_now
    WHERE id = v_invite.id;

    v_result := jsonb_build_object(
        'ok', true,
        'spaceId', v_space_id
    );
    RETURN v_result;
END;
$$;

ALTER FUNCTION private.consume_space_invite(TEXT, BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.consume_space_invite(TEXT, BIGINT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.consume_space_invite(TEXT, BIGINT) TO authenticated;

-- ---------------------------------------------------------------
-- Assertions pós-migração
-- ---------------------------------------------------------------

DO $$
DECLARE
    rls_enabled boolean;
BEGIN
    EXECUTE format('SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=%L AND c.relname=%L', 'public', 'space_invites')
    INTO rls_enabled;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'RLS não habilitado em space_invites'; END IF;
END $$;