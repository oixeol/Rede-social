/**
 * Carrega o `.env` da raiz do repositório sem dependência externa.
 *
 * Usa o mesmo formato do backend (`KEY=value`, valores opcionalmente entre
 * aspas) e não sobrescreve variáveis já presentes em `process.env`.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

/* `scripts/lib/` → `backend/node-api/` → `backend/` → raiz do repositório. */
const REPO_ENV_PATH = resolve(import.meta.dirname, '../../../../.env');

export function loadRepoEnv() {
  let text;
  try {
    text = readFileSync(REPO_ENV_PATH, 'utf8');
  } catch {
    return;
  }

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

loadRepoEnv();

/** URL de conexão do Postgres a partir do ambiente. */
export function databaseUrl() {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL ausente. Defina a variável no .env da raiz do repositório.',
    );
  }
  return url;
}
