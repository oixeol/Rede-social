import type { Server, Socket } from 'socket.io';
import { getRedis, REDIS_KEYS, PUBSUB_CHANNELS } from '../redis.js';
import { checkRateLimit } from '../rate-limit.js';
import { presenceUpdateSchema, type PresenceUpdatePayload } from '../schemas.js';

export function registerPresenceEvents(io: Server, socket: Socket) {
  const userId = socket.data.user.id;

  socket.on('presence:update', async (payload: PresenceUpdatePayload, ack) => {
    const parsed = presenceUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return ack?.({ ok: false, error: 'invalid_payload' });
    }

    const rl = await checkRateLimit(userId, 'presence:update');
    if (!rl.allowed) {
      return ack?.({ ok: false, error: 'rate_limited' });
    }

    const redis = getRedis();
    const presenceKey = `presence:status:${userId}`;
    await redis.hSet(presenceKey, {
      status: parsed.data.status,
      customStatus: parsed.data.customStatus || '',
      updatedAt: Date.now().toString(),
    });
    await redis.expire(presenceKey, 86400);

    await redis.publish(PUBSUB_CHANNELS.PRESENCE_UPDATE, JSON.stringify({
      userId,
      status: parsed.data.status,
      customStatus: parsed.data.customStatus,
      at: Date.now(),
    }));

    ack?.({ ok: true });
  });

  socket.on('presence:get', async (targetUserId: string, ack) => {
    const redis = getRedis();
    const presenceKey = `presence:status:${targetUserId}`;
    const data = await redis.hGetAll(presenceKey);

    if (Object.keys(data).length === 0) {
      return ack?.({ ok: true, status: 'offline' });
    }

    ack?.({
      ok: true,
      status: data.status,
      customStatus: data.customStatus,
      updatedAt: parseInt(data.updatedAt),
    });
  });
}

export async function subscribeToPubSub(io: Server) {
  const redis = getRedis();
  const subscriber = redis.duplicate();
  await subscriber.connect();

  await subscriber.subscribe(PUBSUB_CHANNELS.MESSAGE_NEW, (msg: string) => {
    const event = JSON.parse(msg);
    io.to(`room:${event.payload.roomId}`).emit('message:new', event.payload);
  });

  await subscriber.subscribe(PUBSUB_CHANNELS.MESSAGE_READ, (msg: string) => {
    const event = JSON.parse(msg);
    io.to(`room:${event.roomId}`).emit('read:ack', event);
  });

  await subscriber.subscribe(PUBSUB_CHANNELS.TYPING_START, (msg: string) => {
    const event = JSON.parse(msg);
    io.to(`room:${event.roomId}`).emit('typing:start', event);
  });

  await subscriber.subscribe(PUBSUB_CHANNELS.TYPING_STOP, (msg: string) => {
    const event = JSON.parse(msg);
    io.to(`room:${event.roomId}`).emit('typing:stop', event);
  });

  await subscriber.subscribe(PUBSUB_CHANNELS.PRESENCE_UPDATE, (msg: string) => {
    const event = JSON.parse(msg);
    io.to(`watch:${event.userId}`).emit('presence:update', event);
  });

  await subscriber.subscribe(PUBSUB_CHANNELS.NOTIFICATION_NEW, (msg: string) => {
    const event = JSON.parse(msg);
    io.to(`user:${event.userId}`).emit('notification:new', event.payload);
  });

  return subscriber;
}