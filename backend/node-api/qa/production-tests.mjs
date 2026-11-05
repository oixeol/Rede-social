/**
 * Verifica as travas de configuração da Etapa 0 sem depender do servidor
 * de fumaça. Cada cenário usa um banco temporário e uma porta aleatória.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
let failures = 0;

function ok(label, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer(extraEnv, { expectExit = false } = {}) {
  const port = 4700 + Math.floor(Math.random() * 200);
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'vibra-config-'));
  let output = '';
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      VIBRA_DATA_DIR: dataDir,
      COOKIE_SECURE: '0',
      CLEANUP_INTERVAL_MS: '0',
      /* Neutraliza o ambiente herdado do runner para cada cenário. */
      VIBRA_SEED_DEMO: '0',
      VIBRA_SEED_ONLY: '0',
      VIBRA_DEMO_PASSWORD: '',
      IDENTITY_PROVIDER: '',
      IDENTITY_WEBHOOK_SECRET: '',
      ADMIN_TOKEN: '',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => {
    output += chunk;
  });
  server.stderr.on('data', (chunk) => {
    output += chunk;
  });

  async function stop() {
    if (server.exitCode === null && server.signalCode === null) server.kill();
    await sleep(250);
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Não foi possível remover ${dataDir}: ${error.message}`);
    }
  }

  if (expectExit) {
    const code = await new Promise((resolve) => server.on('exit', (value) => resolve(value ?? 1)));
    const result = { output, code };
    await stop();
    return result;
  }

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) break;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/config`);
      if (response.ok) return { server, output: () => output, port, dataDir, stop };
    } catch {
      /* ainda subindo */
    }
    await sleep(100);
  }
  const failure = new Error(`Servidor de configuração não respondeu.\n${output}`);
  await stop();
  throw failure;
}

try {
  const production = await startServer(
    { NODE_ENV: 'production', VIBRA_SEED_DEMO: '1', VIBRA_DEMO_PASSWORD: 'senha-de-teste' },
    { expectExit: true }
  );
  ok(
    'produção recusa seed de demonstração',
    production.code !== 0 && production.output.includes('VIBRA_SEED_DEMO'),
    `exit ${production.code}`
  );

  const missingSecret = await startServer(
    { NODE_ENV: 'production', IDENTITY_PROVIDER: 'webhook' },
    { expectExit: true }
  );
  ok(
    'webhook sem segredo interrompe a inicialização',
    missingSecret.code !== 0 && missingSecret.output.includes('IDENTITY_WEBHOOK_SECRET'),
    `exit ${missingSecret.code}`
  );

  const simulatedProduction = await startServer(
    { NODE_ENV: 'production', IDENTITY_PROVIDER: 'dev' },
    { expectExit: true }
  );
  ok(
    'simulação de identidade é recusada em produção',
    simulatedProduction.code !== 0 && simulatedProduction.output.includes('IDENTITY_PROVIDER=dev'),
    `exit ${simulatedProduction.code}`
  );

  const insecureCookie = await startServer(
    { NODE_ENV: 'production', COOKIE_SECURE: '0' },
    { expectExit: true }
  );
  ok(
    'cookie inseguro é recusado em produção',
    insecureCookie.code !== 0 && insecureCookie.output.includes('COOKIE_SECURE'),
    `exit ${insecureCookie.code}`
  );

  const shortPassword = await startServer(
    { NODE_ENV: 'test', VIBRA_SEED_DEMO: '1', VIBRA_DEMO_PASSWORD: 'curta' },
    { expectExit: true }
  );
  ok(
    'seed exige senha de demonstração com 8 caracteres',
    shortPassword.code !== 0 && shortPassword.output.includes('VIBRA_DEMO_PASSWORD'),
    `exit ${shortPassword.code}`
  );

  const empty = await startServer({ NODE_ENV: 'test' });
  const login = await fetch(`http://127.0.0.1:${empty.port}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'vibra', password: 'qualquer-senha' }),
  });
  ok('banco vazio não cria a conta de demonstração', login.status === 401);
  const output = empty.output();
  ok('inicialização não imprime credenciais', !/conta demo|APP\.demo|senha:/i.test(output));
  await empty.stop();

  const productionServer = await startServer({
    NODE_ENV: 'production',
    IDENTITY_PROVIDER: 'webhook',
    IDENTITY_WEBHOOK_SECRET: 'segredo-de-teste',
    ADMIN_TOKEN: 'token-de-teste',
    COOKIE_SECURE: '1',
  });
  const config = await fetch(`http://127.0.0.1:${productionServer.port}/api/config`).then((response) => response.json());
  ok(
    'produção com webhook fica configurada sem simulação',
    config.identity?.mode === 'webhook' && config.identity?.simulation === false
  );
  const registration = await fetch(`http://127.0.0.1:${productionServer.port}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'prod.qa',
      name: 'Produção QA',
      birthDate: '1994-01-02',
      password: 'SenhaSegura1!',
    }),
  });
  const session = registration.headers.get('set-cookie') || '';
  ok('cookie de produção inclui Secure', session.includes('Secure'));
  await productionServer.stop();
} catch (error) {
  console.error(error.message);
  failures += 1;
}

console.log(failures ? `\n${failures} FALHA(S) DE CONFIGURAÇÃO` : '\nTESTES DE CONFIGURAÇÃO PASSARAM');
process.exit(failures ? 1 : 0);
