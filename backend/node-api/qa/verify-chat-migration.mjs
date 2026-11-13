import { Client } from 'pg';
import { databaseUrl } from '../scripts/lib/env.mjs';

const client = new Client({
  connectionString: databaseUrl(),
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  const roles = await client.query(`SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') ORDER BY rolname`);
  console.log('roles', roles.rows);
  const schemaOwner = await client.query(`SELECT nspname, pg_get_userbyid(nspowner) owner, has_schema_privilege(current_user, n.oid, 'USAGE') usage FROM pg_namespace n WHERE nspname IN ('auth','private')`);
  console.log('schemas', schemaOwner.rows);
  const authTable = await client.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema='auth' AND table_name='users'`);
  console.log('auth users', authTable.rows);
  const edited = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='edited_at'`);
  console.log('edited_at', edited.rows);
  const functions = await client.query(`SELECT p.proname, pg_get_function_identity_arguments(p.oid) args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname LIKE '%chat%' ORDER BY 1,2`);
  console.log('chat functions', functions.rows);
} finally {
  await client.end();
}
