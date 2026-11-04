/**
 * Cria os dados de demonstração em um banco vazio.
 *
 * Uso:
 *   $env:VIBRA_DEMO_PASSWORD='uma-senha-forte'; npm run seed:demo
 *
 * O script nunca usa senha padrão e nunca deve ser executado em produção.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const password = process.env.VIBRA_DEMO_PASSWORD || '';
if (password.length < 8) {
  console.error('Defina VIBRA_DEMO_PASSWORD com pelo menos 8 caracteres antes de rodar o seed.');
  process.exit(1);
}

const child = spawn(process.execPath, ['server.js'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: {
    ...process.env,
    VIBRA_SEED_DEMO: '1',
    VIBRA_SEED_ONLY: '1',
  },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Não foi possível iniciar o seed: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Seed interrompido por ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
