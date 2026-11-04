'use strict';

/**
 * Worker thread que executa as queries PostgreSQL do Supabase.
 *
 * Protocolo (memória compartilhada):
 * - `control[0]`: sinalizador (0 = pendente, 1 = concluído)
 * - `control[1]`: tamanho do payload JSON
 * - `payload`: bytes UTF-8 com o resultado
 *
 * A thread principal fica bloqueada em `Atomics.wait`, então o resultado não
 * pode voltar por `postMessage` (a fila de mensagens não é processada
 * enquanto a thread principal está bloqueada).
 *
 * Uma única conexão é mantida para que transações (`BEGIN` / `COMMIT`) e
 * `ROLLBACK` caiam sempre na mesma sessão.
 */

const { parentPort, workerData } = require('node:worker_threads');

const control = new Int32Array(workerData.control);
const payloadBytes = new Uint8Array(workerData.payload);

let client = null;
let connecting = null;
let closed = false;

/** Conecta (ou reconecta) o cliente `pg`. */
async function getClient() {
  if (closed) throw new Error('Conexão com o PostgreSQL foi encerrada.');
  if (client) return client;
  if (connecting) return connecting;

  const { Client, types } = require('pg');
  /* `int8` e `numeric` vêm como string; o app espera number. */
  types.setTypeParser(20, (value) => Number(value));
  types.setTypeParser(1700, (value) => Number(value));

  connecting = (async () => {
    const next = new Client({
      connectionString: workerData.connectionString,
      ssl: workerData.ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 15_000,
    });
    next.on('error', (error) => {
      process.stderr.write(`[db] conexão do Postgres: ${error.message}\n`);
    });
    next.on('end', () => {
      client = null;
    });
    await next.connect();
    client = next;
    connecting = null;
    return next;
  })();

  try {
    return await connecting;
  } catch (error) {
    connecting = null;
    throw error;
  }
}

/** Normaliza parâmetros que o PostgreSQL não aceita. */
function normalizeParams(params) {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}

async function run(message) {
  const connection = await getClient();

  if (message.simple) {
    /* Protocolo simples: aceita vários comandos (BEGIN/COMMIT, DDL). */
    const result = await connection.query(message.sql);
    const last = Array.isArray(result) ? result[result.length - 1] : result;
    return {
      ok: true,
      rows: last && last.rows ? last.rows : [],
      rowCount: last && last.rowCount ? last.rowCount : 0,
    };
  }

  const result = await connection.query({
    text: message.sql,
    values: normalizeParams(message.params || []),
  });
  return {
    ok: true,
    rows: result.rows,
    rowCount: result.rowCount,
  };
}

/** Escreve o resultado no bloco compartilhado e acorda a thread principal. */
function respond(payload) {
  let bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.byteLength > payloadBytes.byteLength) {
    bytes = new TextEncoder().encode(
      JSON.stringify({ ok: false, error: 'Resultado excede o limite de 8 MiB.' })
    );
  }
  payloadBytes.set(bytes);
  Atomics.store(control, 1, bytes.byteLength);
  Atomics.store(control, 0, 1);
  Atomics.notify(control, 0);
}

/* Fila serial: garante ordem entre comandos e transações. */
let queue = Promise.resolve();

parentPort.on('message', (message) => {
  queue = queue
    .then(() => run(message))
    .then((result) => respond(result))
    .catch((error) => {
      process.stderr.write(`[db] query falhou: ${error.message}\n`);
      respond({ ok: false, error: error.message, code: error.code || null });
    });
});

parentPort.on('close', () => {
  closed = true;
  if (client) client.end().catch(() => {});
});
