-- =============================================================================
-- Vibra · coluna de presença do usuário (status online)
--
-- Valores permitidos: 'available' | 'away' | 'dnd' | 'invisible'
-- =============================================================================

-- 1. Coluna nova (compatível com schema SQLite via ensureColumn)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS presence TEXT NOT NULL DEFAULT 'available'
    CHECK (presence IN ('available', 'away', 'dnd', 'invisible'));

-- 2. View pública recriada (preservar ordem das colunas existentes)
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
  external_link,
  presence
FROM public.users;

-- 3. Privilégios coluna-a-coluna
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
  external_link,
  presence
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
  preferences,
  presence
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
  preferences,
  presence
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
  preferences,
  presence
) ON public.users TO authenticated;

GRANT DELETE ON public.users TO authenticated;

GRANT SELECT ON public.users_public TO anon, authenticated;