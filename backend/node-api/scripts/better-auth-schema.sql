-- Better Auth Schema for PostgreSQL/Supabase
-- Run this in Supabase SQL Editor or via psql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- user table
CREATE TABLE IF NOT EXISTS "user" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  username TEXT UNIQUE,
  bio TEXT,
  avatar TEXT,
  banner TEXT,
  birth_date DATE,
  gender TEXT,
  country TEXT,
  state TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  message_policy TEXT DEFAULT 'connections',
  points INTEGER DEFAULT 0,
  subscription_status TEXT DEFAULT 'none',
  subscription_ends_at TIMESTAMP,
  theme_palette TEXT DEFAULT 'default',
  preferences JSONB DEFAULT '{}',
  external_link TEXT,
  legacy_user_id INTEGER
);

-- session table
CREATE TABLE IF NOT EXISTS "session" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

-- account table (for OAuth)
CREATE TABLE IF NOT EXISTS "account" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- verification table
CREATE TABLE IF NOT EXISTS "verification" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_user_username ON "user"(username);
CREATE INDEX IF NOT EXISTS idx_user_legacy_user_id ON "user"(legacy_user_id);
CREATE INDEX IF NOT EXISTS idx_session_token ON "session"(token);
CREATE INDEX IF NOT EXISTS idx_session_user_id ON "session"(user_id);
CREATE INDEX IF NOT EXISTS idx_account_user_id ON "account"(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON "verification"(identifier);

-- Migration script to copy existing users from old 'users' table to new 'user' table
-- Run this AFTER the tables are created and you have existing users
/*
INSERT INTO "user" (
  id, name, email, email_verified, image, created_at, updated_at,
  username, bio, avatar, banner, birth_date, gender, country, state,
  is_private, message_policy, points, subscription_status, subscription_ends_at,
  theme_palette, preferences, external_link, legacy_user_id
)
SELECT
  gen_random_uuid() as id,
  name,
  email,
  CASE WHEN email IS NOT NULL THEN TRUE ELSE FALSE END as email_verified,
  avatar as image,
  created_at,
  created_at as updated_at,
  username,
  bio,
  avatar,
  banner,
  birth_date,
  gender,
  country,
  state,
  is_private,
  message_policy,
  points,
  subscription_status,
  subscription_ends_at,
  theme_palette,
  preferences,
  external_link,
  id as legacy_user_id
FROM users
WHERE email IS NOT NULL
ON CONFLICT (email) DO NOTHING;
*/

-- After migration, update foreign keys in other tables to reference new user IDs
-- This requires mapping old user.id -> new user.id via legacy_user_id
-- Example for posts table:
/*
UPDATE posts SET user_id = u.id
FROM "user" u
WHERE posts.user_id = u.legacy_user_id;
*/

-- Then drop legacy_user_id column if no longer needed
-- ALTER TABLE "user" DROP COLUMN legacy_user_id;