import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { databaseUrl } from '../scripts/lib/env.mjs';

const client = new Client({ connectionString: databaseUrl(), ssl: { rejectUnauthorized: false } });
await client.connect();
const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
const ownerUid = randomUUID();
const memberUid = randomUUID();
const outsiderUid = randomUUID();
const ownerName = `rls_owner_${suffix}`;
const memberName = `rls_member_${suffix}`;
const outsiderName = `rls_outsider_${suffix}`;
let spaceId; let otherSpaceId; let publicChannelId; let privateChannelId; let messageId;
try {
  for (const [uid, username] of [[ownerUid, ownerName], [memberUid, memberName], [outsiderUid, outsiderName]]) {
    await client.query('INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [uid]);
    const r = await client.query(`INSERT INTO public.users (auth_uid, username, name, password_hash, created_at) VALUES ($1,$2,$2,'qa',1) ON CONFLICT (auth_uid) DO UPDATE SET username=EXCLUDED.username RETURNING id`, [uid, username]);
    if (uid === ownerUid) global.ownerId = r.rows[0].id;
    if (uid === memberUid) global.memberId = r.rows[0].id;
    if (uid === outsiderUid) global.outsiderId = r.rows[0].id;
  }
  const ownerId = global.ownerId, memberId = global.memberId, outsiderId = global.outsiderId;
  let r = await client.query(`INSERT INTO public.chat_spaces(name,slug,description,created_by,created_at,updated_at) VALUES('QA',$1,'',$2,1,1) RETURNING id`, [`qa-${suffix}`, ownerId]); spaceId=r.rows[0].id;
  r = await client.query(`INSERT INTO public.chat_spaces(name,slug,description,created_by,created_at,updated_at) VALUES('QA2',$1,'',$2,1,1) RETURNING id`, [`qa2-${suffix}`, ownerId]); otherSpaceId=r.rows[0].id;
  await client.query(`INSERT INTO public.chat_space_members(space_id,user_id,role,created_at) VALUES($1,$2,'owner',1),($1,$3,'member',1)`, [spaceId, ownerId, memberId]);
  await client.query(`INSERT INTO public.chat_space_members(space_id,user_id,role,created_at) VALUES($1,$2,'owner',1)`, [otherSpaceId, ownerId]);
  r = await client.query(`INSERT INTO public.chat_channels(space_id,name,slug,topic,visibility,created_by,created_at,updated_at) VALUES($1,'Public',$2,'','public',$3,1,1) RETURNING id`, [spaceId, `pub-${suffix}`, ownerId]); publicChannelId=r.rows[0].id;
  r = await client.query(`INSERT INTO public.chat_channels(space_id,name,slug,topic,visibility,created_by,created_at,updated_at) VALUES($1,'Private',$2,'','private',$3,1,1) RETURNING id`, [spaceId, `priv-${suffix}`, ownerId]); privateChannelId=r.rows[0].id;
  await client.query(`INSERT INTO public.chat_channel_members(channel_id,user_id,last_read_at,created_at) VALUES($1,$2,0,1),($1,$3,0,1)`, [publicChannelId, ownerId, memberId]);
  r = await client.query(`INSERT INTO public.chat_messages(channel_id,sender_id,body,created_at) VALUES($1,$2,'msg',1) RETURNING id`, [publicChannelId, ownerId]); messageId=r.rows[0].id;

  await client.query('SET ROLE authenticated');
  await client.query(`SET request.jwt.claim.sub = '${memberUid}'`);
  const space = await client.query('SELECT id FROM public.chat_spaces WHERE id=$1',[spaceId]);
  const other = await client.query('SELECT id FROM public.chat_spaces WHERE id=$1',[otherSpaceId]);
  const channel = await client.query('SELECT id FROM public.chat_channels WHERE id=$1',[publicChannelId]);
  const priv = await client.query('SELECT id FROM public.chat_channels WHERE id=$1',[privateChannelId]);
  const messages = await client.query('SELECT id FROM public.chat_messages WHERE id=$1',[messageId]);
  console.log({space:space.rows,other:other.rows,channel:channel.rows,private:priv.rows,messages:messages.rows});
  await client.query('RESET ROLE');
} finally {
  await client.query('RESET ROLE');
  if(messageId) await client.query('DELETE FROM public.chat_message_media WHERE message_id=$1',[messageId]);
  if(spaceId) await client.query('DELETE FROM public.chat_spaces WHERE id=$1',[spaceId]);
  if(otherSpaceId) await client.query('DELETE FROM public.chat_spaces WHERE id=$1',[otherSpaceId]);
  await client.query('DELETE FROM public.users WHERE username = ANY($1)', [[ownerName,memberName,outsiderName]]);
  await client.query('DELETE FROM auth.users WHERE id = ANY($1)', [[ownerUid,memberUid,outsiderUid]]);
  await client.end();
}
