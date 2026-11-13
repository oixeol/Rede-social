-- =============================================================================
-- Vibra · adiciona coluna highlights à tabela users
--
-- Destaques são livres: nome escolhido pelo usuário + ícone de um conjunto
-- fechado. Persistidos como JSON (array de {id, label, icon}).
-- =============================================================================

-- 1. Coluna nova (compatível com o schema SQLite já em produção)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS highlights TEXT NOT NULL DEFAULT '[]';

-- 2. View pública atualizada (security_invoker preserva RLS)
-- A coluna `highlights` entra por último: `CREATE OR REPLACE VIEW` exige que a
-- ordem e os nomes das colunas existentes sejam preservados.
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
  points,
  highlights
FROM public.users;

-- 3. Privilégios coluna-a-coluna (inclui highlights e points)
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
  points
) ON public.users TO authenticated;

GRANT DELETE ON public.users TO authenticated;

GRANT SELECT ON public.users_public TO anon, authenticated;
