/**
 * Aplica migration de community posts no Supabase/PostgreSQL.
 *
 * Uso: node scripts/apply-community-posts.mjs
 *
 * Migration roda em transação única. Falha em qualquer statement desfaz todas
 * as alterações da execução.
 */
import { Client } from 'pg';
import { readFileSync, writeSync } from 'fs';
import { resolve } from 'path';

import { databaseUrl } from './lib/env.mjs';

const MIGRATION = '20261113000000_community_posts.sql';
const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../supabase/migrations');

/** Log síncrono: stdout perde buffer quando processo aborta com exception. */
function log(message) {
  writeSync(1, `${message}\n`);
}

const client = new Client({
  connectionString: databaseUrl(),
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  const sql = readFileSync(resolve(MIGRATIONS_DIR, MIGRATION), 'utf8');

  log(`Applying ${MIGRATION}...`);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  log('  migration applied');

  const tables = await client.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'community_posts',
          'community_post_media',
          'community_post_likes',
          'community_post_reposts'
        )
      ORDER BY table_name`,
  );
  log(`tables: ${tables.rows.map((row) => row.table_name).join(', ')}`);

  const policies = await client.query(
    `SELECT tablename, policyname, cmd
       FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename LIKE 'community_post_%'
      ORDER BY tablename, policyname`,
  );
  log(`policies: ${policies.rows.length}`);

  const grants = await client.query(
    `SELECT grantee, table_name, privilege_type
       FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name LIKE 'community_post_%'
        AND grantee IN ('anon', 'authenticated', 'service_role')
      ORDER BY table_name, grantee, privilege_type`,
  );
  log(`grants: ${grants.rows.length}`);
} finally {
  await client.end();
}

log('done');