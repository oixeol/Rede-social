import { Client } from 'pg';

import { databaseUrl } from './lib/env.mjs';

const client = new Client({
  connectionString: databaseUrl(),
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const tables = await client.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
);
console.log('tables:', tables.rows.map((r) => r.table_name).join(', '));

const cols = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position`,
);
console.log('users columns:', cols.rows.map((r) => r.column_name).join(', '));

await client.end();
