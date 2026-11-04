#!/usr/bin/env node
/**
 * Migração de dados: SQLite (`data/vibra.db`) → PostgreSQL (Supabase).
 *
 * Usa o cliente `pg` (conexão direta) em vez do Data API porque a migração
 * precisa preservar os IDs originais — as chaves estrangeiras entre as 29
 * tabelas continuam válidas sem remapear nada.
 *
 * Uso:
 *   node qa/migrate-sqlite-to-supabase.mjs
 *
 * Variáveis de ambiente:
 *   DATABASE_URL          conexão Postgres do Supabase (obrigatória)
 *   SUPABASE_DB_PATH      caminho do SQLite de origem (padrão: data/vibra.db)
 *   MIGRATE_TRUNCATE=1    limpa as tabelas de destino antes de copiar
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

const DB_PATH =
  process.env.SUPABASE_DB_PATH || path.resolve(import.meta.dirname, '..', 'data', 'vibra.db');
const DATABASE_URL = process.env.DATABASE_URL || '';

/** Ordem importa: pais antes dos filhos (chaves estrangeiras). */
const TABLES = [
  'users',
  'sessions',
  'posts',
  'post_media',
  'likes',
  'comments',
  'follows',
  'follow_requests',
  'close_friends',
  'stories',
  'story_views',
  'story_reactions',
  'shares',
  'blocks',
  'reports',
  'problem_reports',
  'notifications',
  'identity_verifications',
  'dating_profiles',
  'compatibility_answers',
  'dating_likes',
  'matches',
  'conversations',
  'conversation_members',
  'messages',
  'location_consents',
  'location_snapshots',
  'radar_prefs',
  'radar_alerts',
];

if (!DATABASE_URL) {
  console.error('DATABASE_URL é obrigatória (conexão Postgres do Supabase).');
  console.error('Exemplo: postgresql://postgres:senha@db.seu-projeto.supabase.co:5432/postgres');
  process.exit(1);
}

if (!process.env.SUPABASE_DB_PATH && !DATABASE_URL) {
  process.exit(1);
}

/** Lê o schema de uma tabela no SQLite. */
function sqliteColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

/** Lê as colunas de uma tabela no Postgres. */
async function postgresColumns(client, table) {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return result.rows.map((row) => row.column_name);
}

/**
 * Converte um valor do SQLite para o tipo aceito pelo Postgres.
 * `undefined` vira NULL; booleanos viram 0/1 (as colunas são INTEGER).
 */
function toPostgres(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'bigint') return Number(value);
  return value;
}

async function main() {
  const sqlite = new DatabaseSync(DB_PATH, { readOnly: true });
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('='.repeat(64));
  console.log('Migração SQLite → Supabase (PostgreSQL)');
  console.log('='.repeat(64));
  console.log(`Origem: ${DB_PATH}`);
  console.log(`Destino: ${DATABASE_URL.replace(/:[^:@/]+@/, ':***@')}`);
  console.log('');

  if (process.env.MIGRATE_TRUNCATE === '1') {
    console.log('Limpando tabelas de destino...');
    await client.query('BEGIN');
    try {
      for (const table of [...TABLES].reverse()) {
        await client.query(`TRUNCATE TABLE public.${table} RESTART IDENTITY CASCADE`);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  const summary = [];
  await client.query('BEGIN');

  try {
    for (const table of TABLES) {
      const sourceColumns = sqliteColumns(sqlite, table);
      const targetColumns = await postgresColumns(client, table);
      const shared = sourceColumns.filter((column) => targetColumns.includes(column));
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();

      if (!rows.length) {
        summary.push({ table, copied: 0, source: 0 });
        console.log(`  ${table.padEnd(26)} 0 linhas`);
        continue;
      }

      const columnList = shared.map((column) => `"${column}"`).join(', ');
      const placeholders = shared.map((_, index) => `$${index + 1}`).join(', ');
      const insertSql = `INSERT INTO public.${table} (${columnList}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = shared.map((column) => toPostgres(row[column]));
        await client.query(insertSql, values);
      }

      summary.push({ table, copied: rows.length, source: rows.length });
      console.log(`  ${table.padEnd(26)} ${rows.length} linhas copiadas`);
    }

    /* Sequências: os IDs foram preservados, então o próximo INSERT continua após o maior. */
    const serialTables = [
      'users',
      'posts',
      'post_media',
      'comments',
      'follow_requests',
      'stories',
      'reports',
      'problem_reports',
      'notifications',
      'identity_verifications',
      'matches',
      'conversations',
      'messages',
    ];
    for (const table of serialTables) {
      await client.query(
        `SELECT setval(
           pg_get_serial_sequence('public.${table}', 'id'),
           GREATEST(COALESCE((SELECT MAX(id) FROM public.${table}), 0), 1)
         )`
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    sqlite.close();
    await client.end();
    throw error;
  }

  /* Verificação: contagem no destino confere com a origem. */
  console.log('');
  console.log('Verificação:');
  let mismatch = 0;
  for (const item of summary) {
    const result = await client.query(`SELECT COUNT(*)::bigint AS n FROM public.${item.table}`);
    const target = Number(result.rows[0].n);
    const ok = target === item.source;
    if (!ok) mismatch += 1;
    console.log(`  ${ok ? '✓' : '✗'} ${item.table.padEnd(26)} origem=${item.source} destino=${target}`);
  }

  sqlite.close();
  await client.end();

  console.log('');
  console.log(mismatch === 0 ? 'Migração concluída com sucesso.' : `Atenção: ${mismatch} tabela(s) divergem.`);
  process.exit(mismatch === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERRO FATAL:', error.message);
  process.exit(1);
});
