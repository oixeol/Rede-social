console.log('=== MIGRATION SCRIPT START ===');

import pg from 'pg';
const { Client } = pg;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

console.log('Imports loaded');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* Carrega .env da raiz do repositório (sem dependência externa). */
function loadRepoEnv() {
  const envPath = path.resolve(__dirname, '../../../.env');
  console.log('Looking for .env at:', envPath);
  try {
    const text = fs.readFileSync(envPath, 'utf8');
    console.log('Found .env, loading...');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(m[1] in process.env)) {
        process.env[m[1]] = value;
      }
    }
  } catch (e) {
    console.error('Failed to load .env:', e.message);
    /* arquivo opcional — segue sem .env local */
  }
}
loadRepoEnv();

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('process.env keys:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('SUPABASE')));

// Parse DATABASE_URL manually to avoid pg connection string parsing issues
function parseDatabaseUrl(url) {
  // postgresql://user:password@host:port/database?param=value
  const match = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(?:\?.*)?$/);
  if (!match) throw new Error('Invalid DATABASE_URL format: ' + url);
  const [, user, password, host, port, database] = match;
  return { user, password, host, port: parseInt(port), database };
}

const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);
console.log('Parsed config:', { user: dbConfig.user, host: dbConfig.host, port: dbConfig.port, database: dbConfig.database, password: dbConfig.password });

import { lookup } from 'node:dns/promises';

// Resolve hostname to IPv4 to avoid IPv6 timeout issues
const ipv4 = await lookup(dbConfig.host, { family: 4 });
console.log('Resolved to IPv4:', ipv4.address);

const client = new Client({
  user: dbConfig.user,
  password: dbConfig.password,
  host: ipv4.address,
  port: dbConfig.port,
  database: dbConfig.database,
  ssl: { rejectUnauthorized: false },
});

async function runBetterAuthMigrations() {
  console.log('Running Better Auth migrations...');
  await client.connect();

  // Better Auth tables
  const migrations = [
    // user table
    `CREATE TABLE IF NOT EXISTS "user" (
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
    );`,

    // session table
    `CREATE TABLE IF NOT EXISTS "session" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      expires_at TIMESTAMP NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ip_address TEXT,
      user_agent TEXT,
      user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    );`,

    // account table (for OAuth)
    `CREATE TABLE IF NOT EXISTS "account" (
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
    );`,

    // verification table
    `CREATE TABLE IF NOT EXISTS "verification" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );`,

    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);`,
    `CREATE INDEX IF NOT EXISTS idx_user_username ON "user"(username);`,
    `CREATE INDEX IF NOT EXISTS idx_user_legacy_user_id ON "user"(legacy_user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_session_token ON "session"(token);`,
    `CREATE INDEX IF NOT EXISTS idx_session_user_id ON "session"(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_account_user_id ON "account"(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_verification_identifier ON "verification"(identifier);`,
  ];

  try {
    await client.query('BEGIN');
    for (const sql of migrations) {
      console.log(`Executing: ${sql.substring(0, 80)}...`);
      await client.query(sql);
    }
    await client.query('COMMIT');
    console.log('Better Auth migrations completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

runBetterAuthMigrations().catch(console.error);