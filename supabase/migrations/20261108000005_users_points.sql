-- =============================================================================
-- Vibra · adiciona coluna points à tabela users
-- =============================================================================

-- 1. Adiciona coluna points com default 0
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS points BIGINT NOT NULL DEFAULT 0;

-- 2. Atualiza a view pública
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
  created_at,
  gender,
  country,
  state,
  points
FROM public.users;

-- 3. Privilégios coluna-a-coluna (inclui points)
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
  points
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
  points
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
  created_at,
  email,
  gender,
  country,
  state,
  points
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
  created_at,
  email,
  gender,
  country,
  state,
  points
) ON public.users TO authenticated;

GRANT DELETE ON public.users TO authenticated;

GRANT SELECT ON public.users_public TO anon, authenticated;