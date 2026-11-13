import { Client } from 'pg';

import { databaseUrl } from './lib/env.mjs';

const client = new Client({
  connectionString: databaseUrl(),
  ssl: { rejectUnauthorized: false },
});

await client.connect();

console.log('Applying highlights migration...');

// 1. Add highlights column
await client.query(`
  ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS highlights TEXT NOT NULL DEFAULT '[]'
`);
console.log('  highlights column added');

// 2. Recreate users_public view (highlights appended last so CREATE OR REPLACE keeps column order)
await client.query(`
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
  FROM public.users
`);
console.log('  users_public view updated');

// 3. Revoke/grant on users (for anon)
await client.query(`
  REVOKE ALL ON public.users FROM anon;
  GRANT SELECT (
    id, username, name, bio, avatar, banner, birth_date, interests, highlights,
    message_policy, is_private, last_active_at, theme_palette,
    subscription_status, subscription_ends_at, created_at,
    gender, country, state, points
  ) ON public.users TO anon;
`);
console.log('  anon grants updated');

// 4. Revoke/grant on users (for authenticated)
await client.query(`
  REVOKE ALL ON public.users FROM authenticated;
  GRANT SELECT (
    id, username, name, bio, avatar, banner, birth_date, interests, highlights,
    message_policy, is_private, last_active_at, theme_palette,
    subscription_status, subscription_ends_at, created_at,
    gender, country, state, points
  ) ON public.users TO authenticated;

  GRANT INSERT (
    id, auth_uid, username, name, bio, avatar, banner, birth_date, interests,
    highlights, message_policy, is_private, last_active_at, theme_palette,
    subscription_status, subscription_ends_at, password_hash, created_at,
    email, gender, country, state, points
  ) ON public.users TO authenticated;

  GRANT UPDATE (
    id, auth_uid, username, name, bio, avatar, banner, birth_date, interests,
    highlights, message_policy, is_private, last_active_at, theme_palette,
    subscription_status, subscription_ends_at, password_hash, created_at,
    email, gender, country, state, points
  ) ON public.users TO authenticated;

  GRANT DELETE ON public.users TO authenticated;
`);
console.log('  authenticated grants updated');

// 5. Grant on users_public
await client.query(`
  GRANT SELECT ON public.users_public TO anon, authenticated;
`);
console.log('  users_public grants updated');

await client.end();
console.log('Migration complete!');