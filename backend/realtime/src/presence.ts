import type { Server, Socket } from 'socket.io';
import { getRedis, REDIS_KEYS } from './redis.js';

const HEARTBEAT_MS = 20_000;
const STALE_MS = 45_000;
const OFFLINE_GRACE_MS = 15_000;

const key = (userId: string) => `presence:${userId}`;

async function isOnline(userId: string): Promise<boolean> {
  const redis = getRedis();
  const cutoff = Date.now() - STALE_MS;
  await redis.zRemRangeByScore(key(userId), 0, cutoff);
  return (await redis.zCard(key(userId))) > 0;
}

function broadcast(io: Server, userId: string, status: 'online' | 'offline') {
  io.to(`watch:${userId}`).emit('presence:update', {
    userId,
    status,
    at: Date.now(),
  });
}

export async function onPresenceConnect(
  io: Server,
  socket: Socket,
  friendIds: string[]
) {
  const userId: string = socket.data.user.id;

  const wasOnline = await isOnline(userId);
  const redis = getRedis();
  await redis
    .multi()
    .zAdd(key(userId), { score: Date.now(), value: socket.id })
    .pExpire(key(userId), STALE_MS * 2)
    .exec();

  for (const id of friendIds) socket.join(`watch:${id}`);
  const states = await Promise.all(
    friendIds.map(async (id) => ({
      userId: id,
      status: (await isOnline(id)) ? 'online' : 'offline',
    }))
  );
  socket.emit('presence:snapshot', states);

  if (!wasOnline) broadcast(io, userId, 'online');

  socket.on('disconnect', async () => {
    const redis = getRedis();
    await redis.zRem(key(userId), socket.id);

    setTimeout(async () => {
      const redis = getRedis();
      if (!(await isOnline(userId))) broadcast(io, userId, 'offline');
    }, OFFLINE_GRACE_MS);
  });
}

export function startPresenceHeartbeat(io: Server) {
  setInterval(async () => {
    const now = Date.now();
    const redis = getRedis();
    const pipe = redis.multi();
    for (const [, s] of io.sockets.sockets) {
      const userId: string | undefined = s.data.user?.id;
      if (!userId) continue;
      pipe.zAdd(key(userId), { score: now, value: s.id });
      pipe.pExpire(key(userId), STALE_MS * 2);
    }
    await pipe.exec();
  }, HEARTBEAT_MS).unref();
}