import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL ausente');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  const cols = await client.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position`,
  );
  console.log('USERS COLUMNS:');
  for (const c of cols.rows) console.log(' -', c.column_name, c.data_type, c.is_nullable, c.column_default ?? '');

  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
  );
  console.log('\nTABLES:', tables.rows.map((r) => r.table_name).join(', '));

  const n = await client.query('SELECT count(*)::int AS n FROM public.users');
  console.log('\nusers rows:', n.rows[0].n);
  const users = await client.query('SELECT id, username, name, email FROM public.users ORDER BY id LIMIT 20');
  console.log(JSON.stringify(users.rows, null, 1));

  const views = await client.query(
    `SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name`,
  );
  console.log('\nVIEWS:', views.rows.map((r) => r.table_name).join(', '));

  const migrations = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='supabase_migrations' ORDER BY table_name`,
  );
  console.log('migration table exists:', migrations.rows.length > 0);
} catch (error) {
  console.error('ERR', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
