/**
 * Aplica migrations de anexos de mensagem (message_media) no Supabase.
 *
 * Uso: node scripts/apply-message-media.mjs
 *
 * Cada arquivo roda como uma única query PostgreSQL. Protocolo simple query
 * preserva corpos dollar-quoted e evita splitter caseiro quebrando SQL.
 */
import { Client } from 'pg';
import { readFileSync, writeSync } from 'fs';
import { resolve } from 'path';

import { databaseUrl } from './lib/env.mjs';

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../supabase/migrations');
const MIGRATIONS = [
  '20261110000010_message_media.sql',
  '20261110000011_message_media_rls_hardening.sql',
];

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
  for (const migration of MIGRATIONS) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, migration), 'utf8');

    log(`Applying ${migration}...`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    log('  migration applied');
  }

  const table = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'message_media'`,
  );
  log(`table message_media: ${table.rows.length ? 'ok' : 'MISSING'}`);

  const functions = await client.query(
    `SELECT
       pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       p.provolatile AS volatility,
       p.proconfig
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'private' AND p.proname = 'is_conversation_member'
     ORDER BY args`,
  );
  for (const fn of functions.rows) {
    log(
      `  helper(${fn.args}): owner=${fn.owner}, security_definer=${fn.security_definer}, ` +
        `volatility=${fn.volatility}, config=${JSON.stringify(fn.proconfig)}`,
    );
  }

  const policies = await client.query(
    `SELECT policyname, cmd, roles::text FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'message_media'
     ORDER BY policyname`,
  );
  for (const policy of policies.rows) {
    log(`  policy ${policy.policyname}: ${policy.cmd} -> ${policy.roles}`);
  }

  const grants = await client.query(
    `SELECT grantee, privilege_type
     FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'message_media'
     ORDER BY grantee, privilege_type`,
  );
  for (const grant of grants.rows) {
    log(`  grant ${grant.grantee}: ${grant.privilege_type}`);
  }

  const sequenceGrants = await client.query(
    `SELECT grantee, privilege_type
     FROM information_schema.role_usage_grants
     WHERE object_schema = 'public' AND object_name = 'message_media_id_seq'
     ORDER BY grantee, privilege_type`,
  );
  for (const grant of sequenceGrants.rows) {
    log(`  sequence grant ${grant.grantee}: ${grant.privilege_type}`);
  }
} finally {
  await client.end();
}

log('done');
