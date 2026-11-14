import { getRedis, REDIS_KEYS, PUBSUB_CHANNELS } from '../redis.js';
import { assertRoomMember } from '../auth.js';
import { checkRateLimit } from '../rate-limit.js';
import { roomJoinSchema, messageCreateSchema, typingStartSchema, readAckSchema, } from '../schemas.js';
export function registerMessageEvents(io, socket) {
    const userId = socket.data.user.id;
    socket.on('room:join', async (payload, ack) => {
        const parsed = roomJoinSchema.safeParse(payload);
        if (!parsed.success) {
            return ack?.({ ok: false, error: 'invalid_payload', details: parsed.error.flatten() });
        }
        const rl = await checkRateLimit(userId, 'room:join');
        if (!rl.allowed) {
            return ack?.({ ok: false, error: 'rate_limited' });
        }
        const isMember = await assertRoomMember(socket, parsed.data.roomId);
        if (!isMember) {
            return ack?.({ ok: false, error: 'forbidden' });
        }
        socket.join(`room:${parsed.data.roomId}`);
        const redis = getRedis();
        await redis.sAdd(REDIS_KEYS.roomMembers(parsed.data.roomId), userId);
        ack?.({ ok: true, roomId: parsed.data.roomId });
    });
    socket.on('message:create', async (payload, ack) => {
        const parsed = messageCreateSchema.safeParse(payload);
        if (!parsed.success) {
            return ack?.({ ok: false, error: 'invalid_payload', details: parsed.error.flatten() });
        }
        const rl = await checkRateLimit(userId, 'message:create');
        if (!rl.allowed) {
            return ack?.({ ok: false, error: 'rate_limited' });
        }
        const isMember = await assertRoomMember(socket, parsed.data.roomId);
        if (!isMember) {
            return ack?.({ ok: false, error: 'forbidden' });
        }
        // Nonce deduplication
        const redis = getRedis();
        const nonceKey = `nonce:${parsed.data.nonce}`;
        const nonceExists = await redis.set(nonceKey, userId, { NX: true, EX: 86400 });
        if (!nonceExists) {
            return ack?.({ ok: false, error: 'duplicate_nonce' });
        }
        // Message is saved via REST API, we just fan-out via Redis pub/sub
        const messageEvent = {
            type: 'message:new',
            payload: {
                ...parsed.data,
                userId,
                username: socket.data.user.username,
                timestamp: Date.now(),
            },
        };
        await redis.publish(PUBSUB_CHANNELS.MESSAGE_NEW, JSON.stringify(messageEvent));
        ack?.({ ok: true, nonce: parsed.data.nonce });
    });
    socket.on('typing:start', async (payload, ack) => {
        const parsed = typingStartSchema.safeParse(payload);
        if (!parsed.success) {
            return ack?.({ ok: false, error: 'invalid_payload' });
        }
        const rl = await checkRateLimit(userId, 'typing:start');
        if (!rl.allowed) {
            return ack?.({ ok: false, error: 'rate_limited' });
        }
        const isMember = await assertRoomMember(socket, parsed.data.roomId);
        if (!isMember) {
            return ack?.({ ok: false, error: 'forbidden' });
        }
        const redis = getRedis();
        const typingKey = REDIS_KEYS.typing(parsed.data.roomId, userId);
        await redis.set(typingKey, '1', { EX: 5 }); // 5s TTL, auto-expires
        await redis.publish(PUBSUB_CHANNELS.TYPING_START, JSON.stringify({
            roomId: parsed.data.roomId,
            userId,
            username: socket.data.user.username,
        }));
        ack?.({ ok: true });
    });
    socket.on('typing:stop', async (payload) => {
        const parsed = typingStartSchema.safeParse(payload);
        if (!parsed.success)
            return;
        const isMember = await assertRoomMember(socket, parsed.data.roomId);
        if (!isMember)
            return;
        const redis = getRedis();
        await redis.del(REDIS_KEYS.typing(parsed.data.roomId, userId));
        await redis.publish(PUBSUB_CHANNELS.TYPING_STOP, JSON.stringify({
            roomId: parsed.data.roomId,
            userId,
        }));
    });
    socket.on('read:ack', async (payload, ack) => {
        const parsed = readAckSchema.safeParse(payload);
        if (!parsed.success) {
            return ack?.({ ok: false, error: 'invalid_payload' });
        }
        const rl = await checkRateLimit(userId, 'read:ack');
        if (!rl.allowed) {
            return ack?.({ ok: false, error: 'rate_limited' });
        }
        const isMember = await assertRoomMember(socket, parsed.data.roomId);
        if (!isMember) {
            return ack?.({ ok: false, error: 'forbidden' });
        }
        const redis = getRedis();
        await redis.publish(PUBSUB_CHANNELS.MESSAGE_READ, JSON.stringify({
            roomId: parsed.data.roomId,
            userId,
            lastReadMessageId: parsed.data.lastReadMessageId,
        }));
        ack?.({ ok: true });
    });
}
//# sourceMappingURL=messages.js.map