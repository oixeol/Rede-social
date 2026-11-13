-- =============================================================================
-- Vibra · campos de configurações da conta (link externo e preferências)
--
-- - `external_link`: link público exibido no perfil (http/https).
-- - `preferences`: JSON com as preferências de notificação, privacidade e
--   aparência. Persistido como TEXT (string JSON), igual às demais listas.
--
-- Colunas novas entram por último na view `users_public`: `CREATE OR REPLACE
-- VIEW` exige preservar a ordem e os nomes das colunas existentes.
-- =============================================================================

-- 1. Colunas novas (compatíveis com o schema SQLite já em produção)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS external_link TEXT,
  ADD COLUMN IF NOT EXISTS preferences TEXT NOT NULL DEFAULT '{}';

-- 2. View pública recriada (remover colunas exige DROP + CREATE).
-- `preferences` NÃO entra na view: são preferências privadas da conta.
DROP VIEW IF EXISTS public.users_public;

CREATE VIEW public.users_public
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
  created_at,
  gender,
  country,
  state,
  points,
  highlights,
  external_link
FROM public.users;

-- 3. Privilégios coluna-a-coluna
-- `preferences` é privado: só a sessão autenticada (e o backend) enxerga.
REVOKE ALL ON public.users FROM anon;
GRANT SELECT (
  id,
  username,
  name,
  bio,
  avatar,
  banner,
  birth_date,
  interests,
  highlights,
  message_policy,
  is_private,
  last_active_at,
  theme_palette,
  subscription_status,
  subscription_ends_at,
  created_at,
  gender,
  country,
  state,
  points,
  external_link
) ON public.users TO anon;

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
  highlights,
  message_policy,
  is_private,
  last_active_at,
  theme_palette,
  subscription_status,
  subscription_ends_at,
  created_at,
  gender,
  country,
  state,
  points,
  external_link,
  preferences
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
  highlights,
  message_policy,
  is_private,
  last_active_at,
  theme_palette,
  subscription_status,
  subscription_ends_at,
  password_hash,
  created_at,
  email,
  gender,
  country,
  state,
  points,
  external_link,
  preferences
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
  highlights,
  message_policy,
  is_private,
  last_active_at,
  theme_palette,
  subscription_status,
  subscription_ends_at,
  password_hash,
  created_at,
  email,
  gender,
  country,
  state,
  points,
  external_link,
  preferences
) ON public.users TO authenticated;

GRANT DELETE ON public.users TO authenticated;

GRANT SELECT ON public.users_public TO anon, authenticated;
