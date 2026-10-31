/**
 * Testes de retenção (LGPD): localização temporária e sessões expiradas.
 * Sobe um servidor próprio com janela de retenção curta.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';

const port = 4950 + Math.floor(Math.random() * 300);
const dataDir = mkdtempSync(path.join(os.tmpdir(), 'vibra-retention-'));
const baseUrl = `http://127.0.0.1:${port}`;
const dbPath = path.join(dataDir, 'vibra.db');
const demoPassword = process.env.VIBRA_DEMO_PASSWORD || `qa-demo-${Math.random().toString(16).slice(2)}`;
const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(port),
  HOST: '127.0.0.1',
  VIBRA_DATA_DIR: dataDir,
  VIBRA_SEED_DEMO: '1',
  VIBRA_SEED_ONLY: '0',
  VIBRA_DEMO_PASSWORD: demoPassword,
  COOKIE_SECURE: '0',
  LOCATION_RETENTION_MS: '1500',
  CLEANUP_INTERVAL_MS: '0',
};

let failures = 0;
function ok(label, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let output = '';
const server = spawn(process.execPath, ['server.js'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (chunk) => {
  output += chunk;
});
server.stderr.on('data', (chunk) => {
  output += chunk;
});

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/api/config`)).ok) return;
    } catch {
      /* ainda subindo */
    }
    await sleep(250);
  }
  throw new Error(`Servidor de retenção não respondeu.\n${output}`);
}

let cookie = '';
async function api(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(baseUrl + pathname, { ...options, headers });
  for (const value of response.headers.getSetCookie?.() || []) {
    const pair = value.split(';')[0];
    if (pair.startsWith('vibra_session=')) cookie = pair.endsWith('=') ? '' : pair;
  }
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data, headers: response.headers };
}

let exitCode = 1;
try {
  await waitForServer();
  const login = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'vibra', password: demoPassword }),
  });
  ok('login demo', login.status === 200);

  const share = await api('/api/dating/location', {
    method: 'PUT',
    body: JSON.stringify({ lat: -23.55, lng: -46.63, accuracy: 30 }),
  });
  ok('localização compartilhada', share.status === 200 && share.data.shared === true);

  const immediate = await api('/api/dating/status');
  ok('localização recente disponível', immediate.status === 200 && immediate.data.location.shared === true);

  await sleep(1900);
  const expired = await api('/api/dating/status');
  ok(
    'limpeza remove localização após o prazo',
    expired.status === 200 && expired.data.location.shared === false,
    JSON.stringify(expired.data?.location)
  );

  const secondLogin = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'vibra', password: demoPassword }),
  });
  ok('novo login para testar sessão', secondLogin.status === 200);
  const token = cookie.split('=')[1];
  ok('cookie de sessão presente', !!token);

  const db = new DatabaseSync(dbPath);
  db.prepare('UPDATE sessions SET created_at = 0 WHERE token = ?').run(token);
  db.close();

  const me = await api('/api/me');
  ok('sessão expirada é rejeitada', me.status === 401);

  const dbAfter = new DatabaseSync(dbPath);
  const row = dbAfter.prepare('SELECT 1 AS ok FROM sessions WHERE token = ?').get(token);
  dbAfter.close();
  ok('sessão expirada é removida do banco', !row);

  exitCode = failures ? 1 : 0;
} catch (error) {
  console.error(error.message);
  exitCode = 1;
} finally {
  server.kill();
  await sleep(350);
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Não foi possível remover o diretório temporário: ${error.message}`);
  }
}

console.log(failures ? `\n${failures} FALHA(S) NA RETENÇÃO` : '\nTESTES DE RETENÇÃO PASSARAM');
process.exit(exitCode);
