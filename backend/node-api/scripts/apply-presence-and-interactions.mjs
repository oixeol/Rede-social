/**
 * Aplica as migrations de presença e interações (repost/save) no Supabase.
 *
 * Uso: node scripts/apply-presence-and-interactions.mjs
 */
import { Client } from 'pg';
import { readFileSync, writeSync } from 'fs';
import { resolve } from 'path';

import { databaseUrl } from './lib/env.mjs';

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../supabase/migrations');

/** Log sincrono: stdout perde buffer quando o processo aborta com exception. */
function log(message) {
  writeSync(1, `${message}\n`);
}

const client = new Client({
  connectionString: databaseUrl(),
  ssl: { rejectUnauthorized: false },
});

await client.connect();

async function applyMigration(filename) {
  log(`Applying ${filename}...`);
  const sql = readFileSync(resolve(MIGRATIONS_DIR, filename), 'utf8');
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const statements = withoutComments
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  log(`  Parsed ${statements.length} statements`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await client.query(stmt);
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('duplicate')) {
        log(`  [${i}] Skipped (already exists)`);
      } else {
        log(`  [${i}] Error: ${e.message}`);
        log(`  Statement: ${stmt.slice(0, 300)}...`);
        throw e;
      }
    }
  }
  log(`  ${filename} applied`);
}

await applyMigration('20261108000009_users_presence.sql');
await applyMigration('20261108000010_post_interactions.sql');

const check = await client.query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'presence'`,
);
log(`users.presence: ${check.rows.length ? 'ok' : 'MISSING'}`);

const tables = await client.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name IN ('reposts', 'saved_posts')`,
);
log(`tables: ${tables.rows.map((r) => r.table_name).join(', ') || 'MISSING'}`);

await client.end();
log('done');
