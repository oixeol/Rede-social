#!/usr/bin/env node
/**
 * Compara as colunas do SQLite de origem com as tabelas do PostgreSQL.
 * Serve para garantir que nenhuma coluna foi silenciosamente descartada
 * durante a migração (o script de cópia só usa colunas em comum).
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

const DB_PATH = process.env.SUPABASE_DB_PATH || path.resolve('data/vibra.db');
const DATABASE_URL = process.env.DATABASE_URL || '';

if (!DATABASE_URL) {
  console.error('DATABASE_URL é obrigatória.');
  process.exit(1);
}

const sqlite = new DatabaseSync(DB_PATH, { readOnly: true });
const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

const sqliteTables = sqlite
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((row) => row.name);

const pgTables = (
  await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
  )
).rows.map((row) => row.table_name);

const missingTables = sqliteTables.filter((table) => !pgTables.includes(table));
const extraTables = pgTables.filter((table) => !sqliteTables.includes(table));

console.log(`SQLite: ${sqliteTables.length} tabelas · Postgres: ${pgTables.length} tabelas`);
if (missingTables.length) console.log(`Tabelas só no SQLite: ${missingTables.join(', ')}`);
if (extraTables.length) console.log(`Tabelas só no Postgres: ${extraTables.join(', ')}`);

let problems = 0;
for (const table of sqliteTables) {
  if (!pgTables.includes(table)) continue;
  const sqliteColumns = sqlite.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
  const pgColumns = (
    await client.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
      ['public', table]
    )
  ).rows.map((row) => row.column_name);

  const missing = sqliteColumns.filter((column) => !pgColumns.includes(column));
  const extra = pgColumns.filter((column) => !sqliteColumns.includes(column));
  if (missing.length || extra.length) {
    problems += 1;
    console.log(`✗ ${table}`);
    if (missing.length) console.log(`    faltando: ${missing.join(', ')}`);
    if (extra.length) console.log(`    extra:    ${extra.join(', ')}`);
  }
}

console.log(problems === 0 ? 'Schema equivalente.' : `${problems} tabela(s) com divergência.`);

sqlite.close();
await client.end();
process.exit(problems === 0 ? 0 : 1);
