import { createClient } from 'redis';
let redis = null;
export function getRedis() {
    if (!redis) {
        const url = process.env.REDIS_URL || 'redis://localhost:6379';
        redis = createClient({ url });
        redis.on('error', (err) => console.error('[Redis] Error:', err));
        redis.connect().catch((err) => console.error('[Redis] Connect failed:', err));
    }
    return redis;
}
export async function closeRedis() {
    if (redis) {
        await redis.quit();
        redis = null;
    }
}
export const PUBSUB_CHANNELS = {
    MESSAGE_NEW: 'realtime:message:new',
    MESSAGE_READ: 'realtime:message:read',
    TYPING_START: 'realtime:typing:start',
    TYPING_STOP: 'realtime:typing:stop',
    PRESENCE_UPDATE: 'realtime:presence:update',
    NOTIFICATION_NEW: 'realtime:notification:new',
    ROOM_EVENT: 'realtime:room:event',
};
export const REDIS_KEYS = {
    session: (sid) => `session:${sid}`,
    userSessions: (userId) => `user:sessions:${userId}`,
    userSockets: (userId) => `user:sockets:${userId}`,
    socketMeta: (socketId) => `socket:meta:${socketId}`,
    roomMembers: (roomId) => `room:members:${roomId}`,
    typing: (roomId, userId) => `typing:${roomId}:${userId}`,
    presenceWatchers: (userId) => `presence:watchers:${userId}`,
    rateLimit: (userId, event) => `ratelimit:${userId}:${event}`,
    revokedTokens: 'auth:revoked_tokens',
};
//# sourceMappingURL=redis.js.map