#!/usr/bin/env node
/** Inspeção rápida do Postgres local: papéis, extensões e permissões. */

import pg from 'pg';

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

await client.connect();

const queries = {
  roles: `SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles
          WHERE rolname IN ('postgres', 'anon', 'authenticated', 'service_role') ORDER BY rolname`,
  extensions: `SELECT e.extname, n.nspname FROM pg_extension e
               JOIN pg_namespace n ON n.oid = e.extnamespace ORDER BY e.extname`,
  searchPath: `SELECT current_setting('search_path') AS value`,
  usersColumns: `SELECT column_name, data_type FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position`,
  rowCounts: `SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM posts) AS posts`,
};

for (const [label, sql] of Object.entries(queries)) {
  try {
    const result = await client.query(sql);
    console.log(`\n== ${label} ==`);
    console.log(result.rows);
  } catch (error) {
    console.log(`\n== ${label} == ERRO: ${error.message}`);
  }
}

await client.end();
