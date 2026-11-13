-- =============================================================================
-- Vibra · message_media table for real message attachments (ETAPA 2)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.message_media (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES public.messages (id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image','video','file')),
    mime_type TEXT,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    file_name TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_media_msg ON public.message_media (message_id, position, id);

-- RLS: somente membros da conversa leem. Backend controla escrita.
ALTER TABLE public.message_media ENABLE ROW LEVEL SECURITY;

-- Helper não recursivo. `postgres` owns a função SECURITY DEFINER e ignora RLS
-- ao ler `conversation_members`; IDs internos são BIGINT.
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

DROP POLICY IF EXISTS message_media_select ON public.message_media;
CREATE POLICY message_media_select ON public.message_media
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.id = message_media.message_id
          AND m.deleted_at IS NULL
          AND private.is_conversation_member(
              m.conversation_id,
              private.current_vibra_user_id()
          )
      )
    );

-- Data API: autenticados somente leem. Backend controla escrita.
REVOKE ALL PRIVILEGES ON TABLE public.message_media FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.message_media_id_seq FROM anon, authenticated;
GRANT SELECT ON TABLE public.message_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_media TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.message_media_id_seq TO service_role;
