-- =============================================================================
-- Vibra · privilégios do Data API (PostgREST)
--
-- A migração inicial concede `SELECT, INSERT, UPDATE, DELETE` para `anon`,
-- `authenticated` e `service_role` em todas as tabelas. No Supabase Cloud os
-- defaults do projeto são mais amplos ainda (inclusive TRUNCATE e TRIGGER).
--
-- O backend Node.js conecta com a role `postgres` (bypass de RLS) e não depende
-- desses privilégios. Este arquivo deixa o Data API seguro por padrão:
--
-- - `anon` só lê conteúdo público (posts, mídias, curtidas, comentários,
--   seguidores e stories reactions) e nunca toca em sessões, mensagens,
--   notificações, localização ou dados de namoro.
-- - `authenticated` mantém CRUD, mas a RLS continua decidindo linha a linha.
-- - `users` perde o acesso de tabela: `password_hash` e `auth_uid` são
--   concedidos coluna a coluna, e `password_hash` nunca é exposta.
-- - `service_role` continua com acesso total (usado pelo backend e por jobs).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- anon: leitura mínima do conteúdo público
-- -----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

GRANT SELECT ON public.posts TO anon;
GRANT SELECT ON public.post_media TO anon;
GRANT SELECT ON public.likes TO anon;
GRANT SELECT ON public.comments TO anon;
GRANT SELECT ON public.follows TO anon;
GRANT SELECT ON public.shares TO anon;
GRANT SELECT ON public.story_reactions TO anon;

-- `users` aparece no feed público, mas sem as colunas sensíveis: a policy
-- `users_select_anon` já limita as linhas a `is_private = 0`.
-- Sem privilégio de tabela: só as colunas abaixo ficam legíveis, então
-- `password_hash` e `auth_uid` não vazam.
GRANT SELECT (
    id,
    username,
    name,
    bio,
    avatar,
    banner,
    birth_date,
    interests,
    message_policy,
    is_private,
    last_active_at,
    theme_palette,
    subscription_status,
    subscription_ends_at,
    created_at
) ON public.users TO anon;

-- -----------------------------------------------------------------------------
-- authenticated: mantém CRUD, com `users` controlada coluna a coluna
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.users FROM authenticated;

GRANT SELECT (
    id,
    username,
    name,
    bio,
    avatar,
    banner,
    birth_date,
    interests,
    message_policy,
    is_private,
    last_active_at,
    theme_palette,
    subscription_status,
    subscription_ends_at,
    created_at
) ON public.users TO authenticated;

GRANT INSERT (
    id,
    auth_uid,
    username,
    name,
    bio,
    avatar,
    banner,
    birth_date,
    interests,
    message_policy,
    is_private,
    last_active_at,
    theme_palette,
    subscription_status,
    subscription_ends_at,
    password_hash,
    created_at
) ON public.users TO authenticated;

GRANT UPDATE (
    id,
    auth_uid,
    username,
    name,
    bio,
    avatar,
    banner,
    birth_date,
    interests,
    message_policy,
    is_private,
    last_active_at,
    theme_palette,
    subscription_status,
    subscription_ends_at,
    password_hash,
    created_at
) ON public.users TO authenticated;

GRANT DELETE ON public.users TO authenticated;

-- -----------------------------------------------------------------------------
-- message_media é criada em migration posterior. Quando já existir, mantém
-- leitura autenticada e escrita exclusiva do backend.
-- -----------------------------------------------------------------------------
DO $grants$
BEGIN
    IF to_regclass('public.message_media') IS NOT NULL THEN
        REVOKE ALL PRIVILEGES ON TABLE public.message_media FROM anon, authenticated;
        REVOKE ALL PRIVILEGES ON SEQUENCE public.message_media_id_seq FROM anon, authenticated;
        GRANT SELECT ON TABLE public.message_media TO authenticated;
    END IF;
END
$grants$;

-- -----------------------------------------------------------------------------
-- service_role: acesso total, sem depender de RLS
-- -----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
