/**
 * Aplica as migrations de comunidades e configurações no Supabase e semeia
 * comunidades de demonstração.
 *
 * Uso: node scripts/apply-settings-and-communities.mjs
 */
import { Client } from 'pg';
import { appendFileSync, readFileSync, writeSync } from 'fs';
import { resolve } from 'path';

import { databaseUrl } from './lib/env.mjs';

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../supabase/migrations');

/** Log sincrono: stdout perde buffer quando o processo aborta com exception. */
function log(message) {
  writeSync(1, `${message}\n`);
}

const client = new Client({
  connectionString: databaseUrl(),
  ssl: { rejectUnauthorized: false },
});

await client.connect();

async function applyMigration(filename) {
  log(`Applying ${filename}...`);
  const sql = readFileSync(resolve(MIGRATIONS_DIR, filename), 'utf8');
  // Remove linhas de comentário antes de dividir: o header comentado seria
  // descartado junto com a primeira instrução (CREATE TABLE).
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const statements = withoutComments
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  log(`  Parsed ${statements.length} statements`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await client.query(stmt);
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('duplicate')) {
        log(`  [${i}] Skipped (already exists): ${stmt.slice(0, 80)}...`);
      } else {
        log(`  [${i}] Error: ${e.message}`);
        log(`  Statement: ${stmt.slice(0, 200)}...`);
        throw e;
      }
    }
  }
  log(`  ${filename} applied`);
}

await applyMigration('20261108000007_communities.sql');
await applyMigration('20261108000008_users_settings.sql');

log('Seeding demo communities...');
const users = await client.query(
  `SELECT id, username FROM public.users WHERE username IN ('vibra','ana.souza','bruno.dev','carla.arte','diego.foto')`,
);
const userMap = Object.fromEntries(users.rows.map((r) => [r.username, r.id]));
log(`User IDs: ${JSON.stringify(userMap)}`);

if (!userMap.vibra) throw new Error('User vibra not found');

const communities = [
  ['Fotografia', 'fotografia', 'Compartilhe suas melhores capturas, dicas de equipamento e técnicas.', 'vibra'],
  ['Desenvolvimento', 'desenvolvimento', 'Código, arquitetura, ferramentas e carreira para devs.', 'bruno.dev'],
  ['Arte & Design', 'arte-design', 'Ilustração, UI/UX, tipografia e processos criativos.', 'carla.arte'],
  ['Viagens', 'viagens', 'Roteiros, fotos, dicas e relatos de viagem.', 'vibra'],
];

const communityIds = {};
for (const [name, slug, description, owner] of communities) {
  const createdBy = userMap[owner] ?? userMap.vibra;
  const res = await client.query(
    `INSERT INTO public.communities (name, slug, description, avatar, created_by, created_at)
     VALUES ($1, $2, $3, NULL, $4, $5)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
     RETURNING id`,
    [name, slug, description, createdBy, Date.now()],
  );
  communityIds[slug] = res.rows[0].id;
  log(`  Community ${slug} id=${res.rows[0].id}`);
}

const memberships = [
  ['fotografia', ['vibra', 'ana.souza', 'bruno.dev', 'carla.arte', 'diego.foto']],
  ['desenvolvimento', ['vibra', 'bruno.dev', 'carla.arte']],
  ['arte-design', ['vibra', 'ana.souza', 'carla.arte', 'diego.foto']],
  ['viagens', ['vibra', 'ana.souza', 'diego.foto']],
];

for (const [slug, members] of memberships) {
  const cid = communityIds[slug];
  for (const username of members) {
    const uid = userMap[username];
    if (!uid) continue;
    await client.query(
      `INSERT INTO public.community_members (community_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (community_id, user_id) DO NOTHING`,
      [cid, uid, username === 'vibra' ? 'owner' : 'member', Date.now()],
    );
  }
}
log('Demo communities seeded.');

await client.end();
log('done');
