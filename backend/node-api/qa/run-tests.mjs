import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const port = 4300 + Math.floor(Math.random() * 500);
const dataDir = mkdtempSync(path.join(os.tmpdir(), 'vibra-test-'));
const baseUrl = `http://127.0.0.1:${port}`;
const webhookSecret = `qa-webhook-${Math.random().toString(16).slice(2)}`;
const adminToken = `qa-admin-${Math.random().toString(16).slice(2)}`;
const demoPassword = `qa-demo-${Math.random().toString(16).slice(2)}`;
const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(port),
  HOST: '127.0.0.1',
  VIBRA_DATA_DIR: dataDir,
  /* Banco temporário isolado: ignora o DATABASE_URL do .env da raiz. */
  DATABASE_URL: '',
  VIBRA_SEED_DEMO: '1',
  VIBRA_SEED_ONLY: '0',
  VIBRA_DEMO_PASSWORD: demoPassword,
  IDENTITY_PROVIDER: 'webhook',
  IDENTITY_WEBHOOK_SECRET: webhookSecret,
  ADMIN_TOKEN: adminToken,
  COOKIE_SECURE: '0',
  LOCATION_RETENTION_MS: String(24 * 60 * 60 * 1000),
  CLEANUP_INTERVAL_MS: '0',
};

let serverOutput = '';
const server = spawn(process.execPath, ['server.js'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (chunk) => {
  serverOutput += chunk;
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk;
});

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/config`);
      if (response.ok) return;
    } catch {
      /* o servidor ainda está subindo */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Servidor de teste não respondeu.\n${serverOutput}`);
}

function run(file) {
  const tests = spawn(process.execPath, [file], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...env, BASE_URL: baseUrl },
    stdio: 'inherit',
  });
  return new Promise((resolve) => tests.on('exit', (code) => resolve(code ?? 1)));
}

let exitCode = 1;
try {
  await waitForServer();
  const configCode = await run('qa/production-tests.mjs');
  const smokeCode = await run('qa/smoke.mjs');
  const datingCode = smokeCode === 0 ? await run('qa/dating-tests.mjs') : 1;
  const retentionCode = smokeCode === 0 ? await run('qa/retention-tests.mjs') : 1;
  exitCode =
    configCode === 0 && smokeCode === 0 && datingCode === 0 && retentionCode === 0 ? 0 : 1;
} catch (error) {
  console.error(error.message);
} finally {
  server.kill();
  await new Promise((resolve) => setTimeout(resolve, 400));
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Não foi possível remover o diretório temporário: ${error.message}`);
  }
}

process.exit(exitCode);
