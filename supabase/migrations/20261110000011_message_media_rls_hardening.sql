-- =============================================================================
-- Vibra · RLS seguro para conversas, mensagens e anexos
--
-- Helpers `SECURITY DEFINER` owned by `postgres` quebram recursão de RLS.
-- IDs externos do Supabase são UUID; IDs internos de conversa/usuário são BIGINT.
-- =============================================================================

-- Remove overload obsoleto (BIGINT, UUID) se existir (evita conflitos de política antigas).
DROP FUNCTION IF EXISTS private.is_conversation_member(BIGINT, UUID) CASCADE;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Helper principal (BIGINT, BIGINT). Owner postgres, SECURITY DEFINER, STABLE, search_path.
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

-- Owner deve ser postgres (bypass de RLS). SE o migração não rodar como postgres,
-- o ALTER pode falhar silenciosamente em role inexistente; ignora erro.
ALTER FUNCTION private.is_conversation_member(BIGINT, BIGINT) OWNER TO postgres;

REVOKE ALL ON FUNCTION private.is_conversation_member(BIGINT, BIGINT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.is_conversation_member(BIGINT, BIGINT) TO authenticated;

-- Políticas de conversas / mensagens (recreate usando helper BIGINT).
DROP POLICY IF EXISTS conversations_select ON public.conversations;
CREATE POLICY conversations_select ON public.conversations
    FOR SELECT TO authenticated
    USING (private.is_conversation_member(id, private.current_vibra_user_id()));

DROP POLICY IF EXISTS conversations_update ON public.conversations;
CREATE POLICY conversations_update ON public.conversations
    FOR UPDATE TO authenticated
    USING (private.is_conversation_member(id, private.current_vibra_user_id()))
    WITH CHECK (private.is_conversation_member(id, private.current_vibra_user_id()));

DROP POLICY IF EXISTS conversation_members_select ON public.conversation_members;
CREATE POLICY conversation_members_select ON public.conversation_members
    FOR SELECT TO authenticated
    USING (
        private.is_conversation_member(
            conversation_members.conversation_id,
            private.current_vibra_user_id()
        )
    );

DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages
    FOR SELECT TO authenticated
    USING (
        private.is_conversation_member(
            messages.conversation_id,
            private.current_vibra_user_id()
        )
    );

DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = private.current_vibra_user_id()
        AND private.is_conversation_member(
            messages.conversation_id,
            private.current_vibra_user_id()
        )
    );

-- message_media: apenas SELECT autenticado. Drop qualquer política de escrita antiga.
DROP POLICY IF EXISTS message_media_select ON public.message_media;
DROP POLICY IF EXISTS message_media_insert ON public.message_media;
DROP POLICY IF EXISTS message_media_update ON public.message_media;
DROP POLICY IF EXISTS message_media_delete ON public.message_media;

CREATE POLICY message_media_select ON public.message_media
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.messages m
            WHERE m.id = message_media.message_id
              AND m.deleted_at IS NULL
              AND private.is_conversation_member(
                  m.conversation_id,
                  private.current_vibra_user_id()
              )
        )
    );

-- Grants: authenticated SELECT only; anon none; service_role full CRUD + sequence.
REVOKE ALL PRIVILEGES ON TABLE public.message_media FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.message_media_id_seq FROM anon, authenticated;

GRANT SELECT ON TABLE public.message_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_media TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.message_media_id_seq TO service_role;

-- =============================================================================
-- Assertions pós-migração (falha se invariantes não satisfeitas)
-- =============================================================================
DO $$
DECLARE
  fn_row record;
  rls_enabled boolean;
  policy_row record;
  grant_row record;
BEGIN
  -- Helper existe com assinatura exata, owner postgres, security definer, stable, search_path
  SELECT proc.* INTO fn_row
  FROM pg_proc proc
  JOIN pg_namespace ns ON ns.oid = proc.pronamespace
  WHERE proc.oid = to_regprocedure('private.is_conversation_member(bigint,bigint)');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'helper is_conversation_member(bigint,bigint) ausente';
  END IF;
  IF NOT fn_row.prosecdef THEN RAISE EXCEPTION 'helper não SECURITY DEFINER'; END IF;
  IF fn_row.provolatile <> 's' THEN RAISE EXCEPTION 'helper não STABLE'; END IF;
  IF fn_row.proconfig IS NULL OR fn_row.proconfig::text !~ 'search_path\s*=\s*"?public,\s*private"?' THEN
    RAISE EXCEPTION 'helper search_path incorreto: %', fn_row.proconfig;
  END IF;
  IF fn_row.proowner <> (SELECT oid FROM pg_roles WHERE rolname = 'postgres') THEN
    RAISE EXCEPTION 'helper owner não postgres';
  END IF;

  -- Sobrecarga UUID inexistente
  IF to_regprocedure('private.is_conversation_member(bigint,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'sobrecarga UUID ainda presente';
  END IF;

  -- RLS habilitado
  SELECT c.relrowsecurity INTO rls_enabled
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='message_media';
  IF NOT rls_enabled THEN RAISE EXCEPTION 'RLS não habilitado em message_media'; END IF;

  -- Políticas message_media: apenas SELECT para authenticated
  FOR policy_row IN
    SELECT policyname, cmd, roles::text AS role_list
    FROM pg_policies
    WHERE schemaname='public' AND tablename='message_media'
  LOOP
    IF policy_row.cmd <> 'SELECT' OR policy_row.role_list NOT LIKE '%authenticated%' THEN
      RAISE EXCEPTION 'política inesperada %: % %', policy_row.policyname, policy_row.cmd, policy_row.role_list;
    END IF;
  END LOOP;

  -- Grants table
  FOR grant_row IN
    SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='message_media'
  LOOP
    IF grant_row.grantee = 'authenticated' AND grant_row.privilege_type <> 'SELECT' THEN
      RAISE EXCEPTION 'authenticated tem % em message_media', grant_row.privilege_type;
    END IF;
    IF grant_row.grantee = 'anon' THEN
      RAISE EXCEPTION 'anon tem privilégio % em message_media', grant_row.privilege_type;
    END IF;
  END LOOP;
  -- service_role deve ter INSERT/UPDATE/DELETE
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='message_media'
      AND grantee='service_role' AND privilege_type IN ('INSERT','UPDATE','DELETE')
  ) THEN
    RAISE EXCEPTION 'service_role sem escrita completa em message_media';
  END IF;

  -- Sequence grants
  IF EXISTS (
    SELECT 1 FROM information_schema.role_usage_grants
    WHERE object_schema='public' AND object_name='message_media_id_seq'
      AND grantee IN ('authenticated','anon')
  ) THEN
    RAISE EXCEPTION 'authenticated/anon têm USAGE na sequence';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_usage_grants
    WHERE object_schema='public' AND object_name='message_media_id_seq'
      AND grantee='service_role' AND privilege_type='USAGE'
  ) THEN
    RAISE EXCEPTION 'service_role sem USAGE na sequence';
  END IF;
END $$;
