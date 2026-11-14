import { getRedis, PUBSUB_CHANNELS } from '../redis.js';
import { checkRateLimit } from '../rate-limit.js';
import { presenceUpdateSchema } from '../schemas.js';
export function registerPresenceEvents(io, socket) {
    const userId = socket.data.user.id;
    socket.on('presence:update', async (payload, ack) => {
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
    socket.on('presence:get', async (targetUserId, ack) => {
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
export async function subscribeToPubSub(io) {
    const redis = getRedis();
    const subscriber = redis.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(PUBSUB_CHANNELS.MESSAGE_NEW, (msg) => {
        const event = JSON.parse(msg);
        io.to(`room:${event.payload.roomId}`).emit('message:new', event.payload);
    });
    await subscriber.subscribe(PUBSUB_CHANNELS.MESSAGE_READ, (msg) => {
        const event = JSON.parse(msg);
        io.to(`room:${event.roomId}`).emit('read:ack', event);
    });
    await subscriber.subscribe(PUBSUB_CHANNELS.TYPING_START, (msg) => {
        const event = JSON.parse(msg);
        io.to(`room:${event.roomId}`).emit('typing:start', event);
    });
    await subscriber.subscribe(PUBSUB_CHANNELS.TYPING_STOP, (msg) => {
        const event = JSON.parse(msg);
        io.to(`room:${event.roomId}`).emit('typing:stop', event);
    });
    await subscriber.subscribe(PUBSUB_CHANNELS.PRESENCE_UPDATE, (msg) => {
        const event = JSON.parse(msg);
        io.to(`watch:${event.userId}`).emit('presence:update', event);
    });
    await subscriber.subscribe(PUBSUB_CHANNELS.NOTIFICATION_NEW, (msg) => {
        const event = JSON.parse(msg);
        io.to(`user:${event.userId}`).emit('notification:new', event.payload);
    });
    return subscriber;
}
//# sourceMappingURL=presence.js.map