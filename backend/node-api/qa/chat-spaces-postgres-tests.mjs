/**
 * QA RLS: espaços e canais de chat no PostgreSQL/Supabase.
 *
 * Exige banco PostgreSQL já migrado (supabase/migrations/*.sql) e conexão com
 * privilégio de criar roles e linhas de teste.
 *
 * Uso:
 *   POSTGRES_QA=1 POSTGRES_QA_DATABASE_URL=postgresql://... \
 *     node qa/chat-spaces-postgres-tests.mjs
 *
 * Sem POSTGRES_QA=1 o script imprime SKIP e termina com sucesso, mantendo
 * `npm test` (SQLite) independente de um servidor PostgreSQL local.
 */
import { randomUUID } from 'node:crypto';

import pg from 'pg';

const { Client } = pg;

const DATABASE_URL = process.env.POSTGRES_QA_DATABASE_URL || process.env.DATABASE_URL || '';
const ENABLED = process.env.POSTGRES_QA === '1' && Boolean(DATABASE_URL);
let failures = 0;

function ok(label, condition, detail = '') {
  if (!condition) {
    failures += 1;
    console.error(`  [FAIL] ${label}${detail ? ': ' + detail : ''}`);
  } else {
    console.log(`  [OK]   ${label}`);
  }
}

async function expectPrivilegeDenied(client, label, sql, params = []) {
  try {
    await client.query(sql, params);
    ok(label, false, 'comando deveria ter sido negado');
  } catch (error) {
    ok(label, error.code === '42501', `código ${error.code || 'desconhecido'}`);
  }
}

/**
 * Garante que auth.uid() responda ao claim da sessão, como no Supabase.
 * Retorna a definição original para restauração ao final do teste.
 */
async function ensureUidReadsClaim(client, uid) {
  const original = await client.query(
    `SELECT pg_get_functiondef(p.oid) AS definition
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'auth' AND p.proname = 'uid'`
  );
  await client.query(`SET request.jwt.claim.sub = '${uid}'`);
  const current = await client.query('SELECT auth.uid()::text AS uid');
  if (current.rows[0]?.uid === uid) return null;

  await client.query(
    `CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
       SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
     $$`
  );
  const patched = await client.query('SELECT auth.uid()::text AS uid');
  if (patched.rows[0]?.uid !== uid) {
    throw new Error('auth.uid() não lê request.jwt.claim.sub neste banco.');
  }
  return original.rows[0]?.definition || null;
}

async function main() {
  if (!ENABLED) {
    console.log('--- Chat Spaces PostgreSQL/RLS QA (SKIP) ---');
    console.log('  Defina POSTGRES_QA=1 e POSTGRES_QA_DATABASE_URL para executar.');
    return;
  }

  console.log('--- Chat Spaces PostgreSQL/RLS QA ---');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: process.env.PGSSL === '1' || process.env.PGSSL === 'require'
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await client.connect();

  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const ownerUid = randomUUID();
  const memberUid = randomUUID();
  const outsiderUid = randomUUID();
  const ownerName = `rls_owner_${suffix}`;
  const memberName = `rls_member_${suffix}`;
  const outsiderName = `rls_outsider_${suffix}`;
  const spaceSlug = `rls-space-${suffix}`;
  const otherSpaceSlug = `rls-other-${suffix}`;
  const publicSlug = `rls-public-${suffix}`;
  const privateSlug = `rls-private-${suffix}`;
  const otherPublicSlug = `rls-other-public-${suffix}`;
  const mediaUrl = `/uploads/rls-${suffix}.png`;

  let spaceId = null;
  let otherSpaceId = null;
  let publicChannelId = null;
  let privateChannelId = null;
  let otherPublicChannelId = null;
  let messageId = null;
  let uidPatch = null;

  try {
    /* ---------- Infraestrutura mínima ---------- */
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await client.query(`DO $$ BEGIN CREATE ROLE ${role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    }
    await client.query('CREATE SCHEMA IF NOT EXISTS auth');
    await client.query('CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY)');
    const hasUid = await client.query(
      "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'auth' AND p.proname = 'uid'"
    );
    if (!hasUid.rowCount) {
      await client.query(
        `CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
           SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
         $$`
      );
    }
    uidPatch = await ensureUidReadsClaim(client, ownerUid);

    /* ---------- Usuários de teste ---------- */
    const ids = {};
    for (const [uid, username] of [
      [ownerUid, ownerName],
      [memberUid, memberName],
      [outsiderUid, outsiderName],
    ]) {
      await client.query('INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [uid]);
      const inserted = await client.query(
        `INSERT INTO public.users (auth_uid, username, name, password_hash, created_at)
         VALUES ($1, $2, $2, 'qa', 1)
         ON CONFLICT (auth_uid) DO UPDATE SET username = EXCLUDED.username
         RETURNING id`,
        [uid, username]
      );
      ids[username] = inserted.rows[0].id;
    }
    const ownerId = ids[ownerName];
    const memberId = ids[memberName];
    const outsiderId = ids[outsiderName];

    /* ---------- Espaço do membro, espaço alheio, canais e mensagem ---------- */
    const space = await client.query(
      `INSERT INTO public.chat_spaces (name, slug, description, created_by, created_at, updated_at)
       VALUES ($1, $2, '', $3, 1, 1) RETURNING id`,
      ['RLS QA', spaceSlug, ownerId]
    );
    spaceId = space.rows[0].id;

    const otherSpace = await client.query(
      `INSERT INTO public.chat_spaces (name, slug, description, created_by, created_at, updated_at)
       VALUES ($1, $2, '', $3, 1, 1) RETURNING id`,
      ['RLS QA Alheio', otherSpaceSlug, ownerId]
    );
    otherSpaceId = otherSpace.rows[0].id;

    await client.query(
      `INSERT INTO public.chat_space_members (space_id, user_id, role, created_at)
       VALUES ($1, $2, 'owner', 1), ($1, $3, 'member', 1)`,
      [spaceId, ownerId, memberId]
    );
    await client.query(
      `INSERT INTO public.chat_space_members (space_id, user_id, role, created_at)
       VALUES ($1, $2, 'owner', 1)`,
      [otherSpaceId, ownerId]
    );

    const publicChannel = await client.query(
      `INSERT INTO public.chat_channels (space_id, name, slug, topic, visibility, created_by, created_at, updated_at)
       VALUES ($1, 'Public', $2, '', 'public', $3, 1, 1) RETURNING id`,
      [spaceId, publicSlug, ownerId]
    );
    publicChannelId = publicChannel.rows[0].id;

    const privateChannel = await client.query(
      `INSERT INTO public.chat_channels (space_id, name, slug, topic, visibility, created_by, created_at, updated_at)
       VALUES ($1, 'Private', $2, '', 'private', $3, 1, 1) RETURNING id`,
      [spaceId, privateSlug, ownerId]
    );
    privateChannelId = privateChannel.rows[0].id;

    const otherPublicChannel = await client.query(
      `INSERT INTO public.chat_channels (space_id, name, slug, topic, visibility, created_by, created_at, updated_at)
       VALUES ($1, 'Outro', $2, '', 'public', $3, 1, 1) RETURNING id`,
      [otherSpaceId, otherPublicSlug, ownerId]
    );
    otherPublicChannelId = otherPublicChannel.rows[0].id;

    await client.query(
      `INSERT INTO public.chat_channel_members (channel_id, user_id, last_read_at, created_at)
       VALUES ($1, $2, 0, 1), ($1, $3, 0, 1)`,
      [publicChannelId, ownerId, memberId]
    );

    const message = await client.query(
      `INSERT INTO public.chat_messages (channel_id, sender_id, body, created_at)
       VALUES ($1, $2, 'mensagem pública', 1) RETURNING id`,
      [publicChannelId, ownerId]
    );
    messageId = message.rows[0].id;

    await client.query(
      `INSERT INTO public.chat_message_media
         (message_id, url, media_type, mime_type, size_bytes, file_name, position, created_at)
       VALUES ($1, $2, 'image', 'image/png', 10, $3, 0, 1)`,
      [messageId, mediaUrl, `rls-${suffix}.png`]
    );

    /* ---------- Membro do espaço ---------- */
    await client.query('SET ROLE authenticated');
    await client.query(`SET request.jwt.claim.sub = '${memberUid}'`);

    const ownSpace = await client.query('SELECT id FROM public.chat_spaces WHERE id = $1', [spaceId]);
    const otherVisible = await client.query('SELECT id FROM public.chat_spaces WHERE id = $1', [otherSpaceId]);
    ok('RLS: membro vê o próprio espaço', ownSpace.rows.length === 1);
    ok('RLS: membro não vê espaço alheio', otherVisible.rows.length === 0);

    const ownChannel = await client.query('SELECT id FROM public.chat_channels WHERE id = $1', [publicChannelId]);
    const otherChannel = await client.query('SELECT id FROM public.chat_channels WHERE id = $1', [otherPublicChannelId]);
    ok('RLS: membro vê canal público', ownChannel.rows.length === 1);
    ok('RLS: membro não vê canal de outro espaço', otherChannel.rows.length === 0);

    const messages = await client.query('SELECT id FROM public.chat_messages WHERE id = $1', [messageId]);
    ok('RLS: membro lê mensagens do canal público', messages.rows.length === 1);

    const media = await client.query('SELECT id FROM public.chat_message_media WHERE message_id = $1', [messageId]);
    ok('RLS: membro lê mídia do canal público', media.rows.length === 1);

    const members = await client.query(
      'SELECT user_id FROM public.chat_space_members WHERE space_id = $1 ORDER BY user_id',
      [spaceId]
    );
    ok('RLS: membro lê lista de membros do espaço', members.rows.length === 2);

    const privateSeen = await client.query(
      'SELECT id FROM public.chat_channels WHERE id = $1',
      [privateChannelId]
    );
    ok('RLS: canal privado exige membership explícita', privateSeen.rows.length === 0);

    await client.query('RESET ROLE');

    /* ---------- Convite explícito libera canal privado ---------- */
    await client.query(
      `INSERT INTO public.chat_channel_members (channel_id, user_id, last_read_at, created_at)
       VALUES ($1, $2, 0, 1) ON CONFLICT DO NOTHING`,
      [privateChannelId, memberId]
    );
    await client.query('SET ROLE authenticated');
    await client.query(`SET request.jwt.claim.sub = '${memberUid}'`);
    const privateAfter = await client.query('SELECT id FROM public.chat_channels WHERE id = $1', [privateChannelId]);
    ok('RLS: convite explícito libera canal privado', privateAfter.rows.length === 1);
    await client.query('RESET ROLE');

    /* ---------- Outsider ---------- */
    await client.query('SET ROLE authenticated');
    await client.query(`SET request.jwt.claim.sub = '${outsiderUid}'`);
    for (const [label, sql, params] of [
      ['espaços', 'SELECT id FROM public.chat_spaces WHERE id = ANY($1)', [[spaceId, otherSpaceId]]],
      ['canais', 'SELECT id FROM public.chat_channels WHERE id = ANY($1)', [[publicChannelId, privateChannelId, otherPublicChannelId]]],
      ['mensagens', 'SELECT id FROM public.chat_messages WHERE id = ANY($1)', [[messageId]]],
      ['mídias', 'SELECT id FROM public.chat_message_media WHERE message_id = ANY($1)', [[messageId]]],
      [
        'membros do espaço alheio',
        'SELECT user_id FROM public.chat_space_members WHERE space_id = ANY($1)',
        [[spaceId, otherSpaceId]],
      ],
    ]) {
      const rows = await client.query(sql, params);
      ok(`RLS: outsider não vê ${label}`, rows.rows.length === 0);
    }
    await client.query('RESET ROLE');

    /* ---------- Revogação de membership ao vivo ---------- */
    await client.query('DELETE FROM public.chat_space_members WHERE space_id = $1 AND user_id = $2', [
      spaceId,
      memberId,
    ]);
    await client.query('SET ROLE authenticated');
    await client.query(`SET request.jwt.claim.sub = '${memberUid}'`);
    const afterRevoke = await client.query('SELECT id FROM public.chat_spaces WHERE id = $1', [spaceId]);
    ok('RLS: revogação de membership remove acesso a espaços', afterRevoke.rows.length === 0);
    const afterRevokeMessages = await client.query('SELECT id FROM public.chat_messages WHERE id = $1', [messageId]);
    ok('RLS: revogação de membership remove acesso a mensagens', afterRevokeMessages.rows.length === 0);
    await client.query('RESET ROLE');

    /* ---------- Grants: authenticated somente leitura ---------- */
    await client.query('SET ROLE authenticated');
    await client.query(`SET request.jwt.claim.sub = '${ownerUid}'`);
    await expectPrivilegeDenied(
      client,
      'Grant: authenticated não insere em chat_space_members',
      'INSERT INTO public.chat_space_members (space_id, user_id, role, created_at) VALUES ($1, $2, $3, 1)',
      [spaceId, outsiderId, 'member']
    );
    await expectPrivilegeDenied(
      client,
      'Grant: authenticated não insere em chat_channel_members',
      'INSERT INTO public.chat_channel_members (channel_id, user_id, last_read_at, created_at) VALUES ($1, $2, 0, 1)',
      [publicChannelId, outsiderId]
    );
    await expectPrivilegeDenied(
      client,
      'Grant: authenticated não insere em chat_messages',
      'INSERT INTO public.chat_messages (channel_id, sender_id, body, created_at) VALUES ($1, $2, $3, 1)',
      [publicChannelId, outsiderId, 'x']
    );
    await expectPrivilegeDenied(
      client,
      'Grant: authenticated não insere em chat_message_media',
      `INSERT INTO public.chat_message_media
         (message_id, url, media_type, mime_type, size_bytes, file_name, position, created_at)
       VALUES ($1, $2, 'image', 'image/png', 1, 'x.png', 0, 1)`,
      [messageId, `/uploads/negado-${suffix}.png`]
    );
    await client.query('RESET ROLE');

    /* ---------- Grants: anon sem acesso ---------- */
    await client.query('SET ROLE anon');
    await expectPrivilegeDenied(client, 'Grant: anon não lê chat_spaces', 'SELECT 1 FROM public.chat_spaces');
    await expectPrivilegeDenied(
      client,
      'Grant: anon não escreve em chat_space_members',
      'INSERT INTO public.chat_space_members (space_id, user_id, role, created_at) VALUES ($1, $2, $3, 1)',
      [spaceId, outsiderId, 'member']
    );
    await client.query('RESET ROLE');

    /* ---------- Grants: service_role com DML completo ---------- */
    const serviceGrants = await client.query(
      `SELECT privilege_type FROM information_schema.role_table_grants
       WHERE table_schema = 'public' AND table_name = 'chat_message_media' AND grantee = 'service_role'`
    );
    const servicePrivileges = new Set(serviceGrants.rows.map((row) => row.privilege_type));
    ok(
      'Grant: service_role tem escrita completa em chat_message_media',
      ['INSERT', 'UPDATE', 'DELETE'].every((privilege) => servicePrivileges.has(privilege))
    );
    const sequenceGrants = await client.query(
      `SELECT grantee FROM information_schema.role_usage_grants
       WHERE object_schema = 'public' AND object_name = 'chat_message_media_id_seq'`
    );
    const sequenceUsers = sequenceGrants.rows.map((row) => row.grantee);
    ok(
      'Grant: authenticated/anon sem uso de sequence de chat_message_media',
      !sequenceUsers.includes('authenticated') && !sequenceUsers.includes('anon')
    );

    /* ---------- service_role escreve ignorando RLS ---------- */
    const bypass = await client.query(
      "SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'"
    );
    if (bypass.rows[0]?.rolbypassrls) {
      await client.query('SET ROLE service_role');
      const serviceInsert = await client.query(
        `INSERT INTO public.chat_messages (channel_id, sender_id, body, created_at)
         VALUES ($1, $2, 'qa service role', 2) RETURNING id`,
        [publicChannelId, ownerId]
      );
      ok('Grant: service_role escreve ignorando RLS', serviceInsert.rows.length === 1);
      await client.query('RESET ROLE');
    } else {
      console.log('  [SKIP] service_role sem BYPASSRLS neste banco de teste');
    }
  } finally {
    try {
      await client.query('RESET ROLE');
      if (messageId) {
        await client.query('DELETE FROM public.chat_message_media WHERE message_id = $1', [messageId]);
      }
      if (spaceId) {
        await client.query('DELETE FROM public.chat_spaces WHERE id = $1', [spaceId]);
      }
      if (otherSpaceId) {
        await client.query('DELETE FROM public.chat_spaces WHERE id = $1', [otherSpaceId]);
      }
      await client.query('DELETE FROM public.users WHERE username = ANY($1)', [
        [ownerName, memberName, outsiderName],
      ]);
      await client.query('DELETE FROM auth.users WHERE id = ANY($1)', [[ownerUid, memberUid, outsiderUid]]);
    } catch (error) {
      console.warn(`  [WARN] limpeza do banco de teste falhou: ${error.message}`);
    }
    if (uidPatch) {
      try {
        await client.query(uidPatch);
      } catch (error) {
        console.warn(`  [WARN] restauração de auth.uid() falhou: ${error.message}`);
      }
    }
    await client.end();
  }

  if (failures > 0) {
    console.error(`\n--- Chat Spaces PostgreSQL/RLS QA FALHOU com ${failures} erros ---`);
    process.exit(1);
  }
  console.log('\n--- Chat Spaces PostgreSQL/RLS QA SUCESSO ---');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
