-- =============================================================================
-- Vibra · view pública de usuários
--
-- `users` é controlada coluna a coluna para `anon` e `authenticated`, então
-- `select=*` no Data API é rejeitado (PostgREST expande para todas as colunas
-- e esbarra em `password_hash`). A view resolve isso sem abrir a tabela:
--
-- - `security_invoker = true` faz a consulta rodar com os privilégios de quem
--   chama, então as policies de `users` continuam valendo (`is_private = 0`
--   para `anon`, `auth_uid = auth.uid()` para `authenticated`).
-- - Só colunas públicas são projetadas; `password_hash` e `auth_uid` ficam de
--   fora do schema da view.
-- =============================================================================

CREATE OR REPLACE VIEW public.users_public
  WITH (security_invoker = true) AS
  SELECT
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
  FROM public.users;

GRANT SELECT ON public.users_public TO anon, authenticated;
