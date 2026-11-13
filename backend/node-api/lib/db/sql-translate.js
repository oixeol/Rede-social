'use strict';

/**
 * Tradução de SQL: SQLite (`node:sqlite`) → PostgreSQL (Supabase).
 *
 * O backend foi escrito sobre a API síncrona do SQLite. O driver Postgres roda
 * em uma worker thread e recebe o SQL já convertido para o dialeto do
 * PostgreSQL, que usa placeholders `$1`, `$2`, ... no lugar de `?`.
 *
 * Regras aplicadas:
 * - `?` → `$1`, `$2`, ...
 * - `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
 * - `BEGIN IMMEDIATE` → `BEGIN`
 * - `lower(hex(randomblob(n)))` → `lower(encode(gen_random_bytes(n), 'hex'))`
 * - `instr(coluna, valor)` → `position(valor in coluna)`
 * - `LIKE` → `ILIKE` (no SQLite o `LIKE` ignora maiúsculas/minúsculas)
 */

/** Tabelas sem coluna `id` — não podem receber `RETURNING id`. */
const TABLES_WITHOUT_ID = new Set([
  'sessions',
  'likes',
  'follows',
  'close_friends',
  'story_views',
  'story_reactions',
  'shares',
  'reposts',
  'saved_posts',
  'blocks',
  'conversation_members',
  'location_consents',
  'radar_alerts',
  'dating_profiles',
  'dating_likes',
  'location_snapshots',
  'radar_prefs',
  'compatibility_answers',
  'community_members',
  'chat_space_members',
  'chat_channel_members',
]);

/**
 * Aplica uma transformação apenas fora de literais de texto e comentários.
 * Evita mexer em conteúdo como `'%like%'` dentro de uma string.
 */
function transformOutsideLiterals(sql, transform) {
  let out = '';
  let segment = '';
  let quote = null;

  const flush = () => {
    if (segment) {
      out += transform(segment);
      segment = '';
    }
  };

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (quote) {
      out += char;
      if (char === quote) {
        if (next === quote) {
          out += next;
          i += 1;
        } else {
          quote = null;
        }
      } else if (char === '\\' && quote === "'") {
        out += next ?? '';
        i += 1;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      flush();
      quote = char;
      out += char;
      continue;
    }

    if (char === '-' && next === '-') {
      flush();
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(i, stop);
      i = stop - 1;
      continue;
    }

    if (char === '/' && next === '*') {
      flush();
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      out += sql.slice(i, stop);
      i = stop - 1;
      continue;
    }

    segment += char;
  }

  flush();
  return out;
}

/**
 * Converte placeholders `?` em `$1`, `$2`, ...
 * Ignora `?` dentro de literais de texto, identificadores e comentários.
 */
function convertPlaceholders(sql) {
  let out = '';
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      out += char;
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      out += char;
      if (char === '*' && next === '/') {
        out += next;
        i += 1;
        blockComment = false;
      }
      continue;
    }
    if (!inSingle && !inDouble && char === '-' && next === '-') {
      lineComment = true;
      out += char;
      continue;
    }
    if (!inSingle && !inDouble && char === '/' && next === '*') {
      blockComment = true;
      out += char;
      continue;
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      out += char;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      out += char;
      continue;
    }
    if (char === '?' && !inSingle && !inDouble) {
      index += 1;
      out += `$${index}`;
      continue;
    }
    out += char;
  }

  return out;
}

/** Extrai o nome da tabela alvo de um INSERT. */
function insertedTable(sql) {
  const match = /INSERT\s+INTO\s+([a-zA-Z_][\w]*)/.exec(sql);
  return match ? match[1].toLowerCase() : null;
}

/** Indica se o comando é um INSERT. */
function isInsert(sql) {
  return /^\s*INSERT\b/i.test(sql);
}

/** Indica se o comando já traz uma cláusula RETURNING. */
function hasReturning(sql) {
  return /\bRETURNING\b/i.test(sql);
}

/** Indica se o comando já traz uma cláusula ON CONFLICT. */
function hasOnConflict(sql) {
  return /\bON\s+CONFLICT\b/i.test(sql);
}

/**
 * Converte o SQL do SQLite para o PostgreSQL.
 * Serve para qualquer comando (SELECT, INSERT, UPDATE, DELETE, transações).
 */
function translate(sql) {
  let text = convertPlaceholders(String(sql));

  const insertOrIgnore = /INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(text);
  if (insertOrIgnore) {
    text = text.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+/gi, 'INSERT INTO ');
  }

  text = transformOutsideLiterals(text, (segment) =>
    segment
      /* `lower(hex(randomblob(8)))` → `lower(encode(gen_random_bytes(8), 'hex'))` */
      .replace(
        /lower\s*\(\s*hex\s*\(\s*randomblob\s*\(\s*(\d+)\s*\)\s*\)\s*\)/gi,
        (_match, digits) => `lower(encode(gen_random_bytes(${digits}), 'hex'))`
      )
      /* `instr(coluna, valor)` → `position(valor in coluna)` */
      .replace(
        /\binstr\s*\(\s*([a-zA-Z_][\w.]*)\s*,\s*(\$\d+|'[^']*')\s*\)/gi,
        (_match, column, value) => `position(${value} in ${column})`
      )
      /* O `LIKE` do SQLite ignora maiúsculas/minúsculas; no Postgres é `ILIKE`. */
      .replace(/\bLIKE\b/gi, 'ILIKE')
  );

  /* `BEGIN IMMEDIATE` não existe no PostgreSQL. */
  text = text.replace(/^\s*BEGIN\s+IMMEDIATE\b/i, 'BEGIN');

  const trimmed = text.trim().replace(/;+$/, '');

  if (isInsert(trimmed) && insertOrIgnore && !hasOnConflict(trimmed)) {
    return `${trimmed} ON CONFLICT DO NOTHING`;
  }

  return trimmed;
}

/**
 * Prepara o INSERT final, acrescentando `RETURNING id` quando a tabela tem
 * chave primária `id` (o código Node usa `result.lastInsertRowid`).
 */
function withReturningId(sql) {
  const text = translate(sql);
  if (!isInsert(text) || hasReturning(text)) return text;

  const table = insertedTable(text);
  if (!table || TABLES_WITHOUT_ID.has(table)) return text;

  return `${text} RETURNING id`;
}

module.exports = {
  convertPlaceholders,
  insertedTable,
  isInsert,
  hasReturning,
  hasOnConflict,
  translate,
  withReturningId,
  TABLES_WITHOUT_ID,
};
