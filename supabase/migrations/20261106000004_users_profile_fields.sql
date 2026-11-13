-- =============================================================================
-- Vibra · adiciona campos de perfil (e-mail, género, país, estado) à tabela users
-- =============================================================================

-- 1. Colunas novas (compatíveis com o schema SQLite já em produção)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

-- 2. Índice único case-insensitive para e-mail (permite NULL repetido)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key
  ON public.users (lower(email))
  WHERE email IS NOT NULL;

-- 3. View pública atualizada (security_invoker preserva RLS)
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
  state
FROM public.users;

-- 4. Privilégios coluna-a-coluna (anon não lê e-mail)
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
  state
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
  state
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
  state
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
  state
) ON public.users TO authenticated;

GRANT DELETE ON public.users TO authenticated;

GRANT SELECT ON public.users_public TO anon, authenticated;