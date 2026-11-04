'use strict';

/**
 * Driver PostgreSQL para o Supabase.
 *
 * O backend Node.js foi escrito sobre a API síncrona do `node:sqlite`
 * (`db.prepare(sql).get(...)`, `.all(...)`, `.run(...)`). Manter essa
 * assinatura evita reescrever ~150 pontos de acesso ao banco no monólito.
 *
 * Como o cliente `pg` é assíncrono, as queries rodam em uma worker thread.
 * O resultado volta por memória compartilhada (SharedArrayBuffer) e a thread
 * principal acorda com `Atomics.wait`, preservando a semântica síncrona.
 *
 * A worker usa uma única conexão: o servidor já serializa as chamadas (a
 * thread principal bloqueia em cada query), e uma conexão só garante que
 * `BEGIN` / `COMMIT` / `ROLLBACK` caiam na mesma sessão.
 *
 * Diferenças em relação ao SQLite que o driver absorve:
 * - placeholders `?` → `$1`, `$2`, ...
 * - `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`
 * - `BEGIN IMMEDIATE` → `BEGIN`
 * - `LIKE` → `ILIKE` (SQLite ignora maiúsculas/minúsculas)
 * - `lastInsertRowid` → coluna `id` devolvida por `RETURNING id`
 * - `changes` → número de linhas afetadas
 */

const { Worker } = require('node:worker_threads');
const path = require('node:path');
const { translate, withReturningId, isInsert } = require('./sql-translate');

/** Limite de 8 MiB por resultado — folgado para feeds e rankings. */
const PAYLOAD_BYTES = 8 * 1024 * 1024;

/** Timeout máximo de uma query antes de desistir (ms). */
const QUERY_TIMEOUT_MS = 60_000;

/** Registro do worker e da memória compartilhada. */
let worker = null;
let control = null;
let payload = null;

/**
 * Cria o worker com seu bloco de memória compartilhada.
 */
function ensureWorker() {
  if (worker) return worker;

  const controlBuffer = new SharedArrayBuffer(2 * Int32Array.BYTES_PER_ELEMENT);
  const payloadBuffer = new SharedArrayBuffer(PAYLOAD_BYTES);

  worker = new Worker(path.resolve(__dirname, 'postgres-worker.js'), {
    workerData: {
      control: controlBuffer,
      payload: payloadBuffer,
      connectionString: process.env.DATABASE_URL || '',
      ssl: process.env.PGSSL === '1' || process.env.PGSSL === 'require',
    },
  });

  worker.on('error', (error) => {
    process.stderr.write(`[db] worker do Postgres falhou: ${error.message}\n`);
  });

  worker.unref();

  control = new Int32Array(controlBuffer);
  payload = new Uint8Array(payloadBuffer);
  return worker;
}

/**
 * Executa uma query e aguarda o resultado.
 */
function execute(sql, params, simple = false) {
  ensureWorker();

  Atomics.store(control, 0, 0);
  Atomics.store(control, 1, 0);
  worker.postMessage({ sql, params, simple });

  const deadline = Date.now() + QUERY_TIMEOUT_MS;
  while (Atomics.load(control, 0) === 0) {
    if (Date.now() > deadline) {
      throw new Error('Timeout ao executar query no PostgreSQL.');
    }
    Atomics.wait(control, 0, 0, 1_000);
  }

  const length = Atomics.load(control, 1);
  if (!length) {
    throw new Error('Postgres não devolveu resultado para a query.');
  }
  const text = new TextDecoder().decode(payload.subarray(0, length));
  const response = JSON.parse(text);
  if (!response.ok) {
    const error = new Error(response.error || 'Falha na query PostgreSQL.');
    error.code = response.code || null;
    throw error;
  }
  return response;
}

/** Statement prepared com a mesma API do SQLite. */
class PreparedStatement {
  constructor(sql) {
    this.sql = sql;
    this.insert = isInsert(sql);
    this.query = this.insert ? withReturningId(sql) : translate(sql);
  }

  get(...params) {
    const response = execute(this.query, params);
    return response.rows[0] || undefined;
  }

  all(...params) {
    const response = execute(this.query, params);
    return response.rows;
  }

  run(...params) {
    const response = execute(this.query, params);
    const result = { changes: response.rowCount || 0, lastInsertRowid: 0 };
    if (this.insert && response.rows && response.rows.length) {
      const inserted = response.rows[0];
      if (inserted && inserted.id !== undefined && inserted.id !== null) {
        result.lastInsertRowid = Number(inserted.id);
      }
    }
    return result;
  }
}

/** Instância compatível com `DatabaseSync`. */
class PostgresDatabase {
  exec(sql) {
    const text = String(sql).trim();
    /* PRAGMAs e DDL de SQLite não se aplicam ao Postgres. */
    if (!text || text.toUpperCase().startsWith('PRAGMA')) return undefined;
    execute(translate(text), [], true);
    return undefined;
  }

  prepare(sql) {
    return new PreparedStatement(sql);
  }

  close() {
    if (worker) {
      worker.terminate();
      worker = null;
      control = null;
      payload = null;
    }
  }
}

/**
 * Cria o handle do banco. Usa Postgres quando `DATABASE_URL` está definida.
 */
function createDatabase({ sqlitePath, connectionString } = {}) {
  const url = connectionString || process.env.DATABASE_URL || '';
  if (!url) {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(sqlitePath);
    db.mode = 'sqlite';
    return db;
  }
  process.env.DATABASE_URL = url;
  const db = new PostgresDatabase();
  db.mode = 'postgres';
  return db;
}

module.exports = { createDatabase, PostgresDatabase, PreparedStatement };
