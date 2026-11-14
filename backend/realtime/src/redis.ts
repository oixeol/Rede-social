import { createClient, RedisClientType } from 'redis';

let redis: RedisClientType | null = null;

export function getRedis(): RedisClientType {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = createClient({ url });
    redis.on('error', (err) => console.error('[Redis] Error:', err));
    redis.connect().catch((err) => console.error('[Redis] Connect failed:', err));
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
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
} as const;

export const REDIS_KEYS = {
  session: (sid: string) => `session:${sid}`,
  userSessions: (userId: string) => `user:sessions:${userId}`,
  userSockets: (userId: string) => `user:sockets:${userId}`,
  socketMeta: (socketId: string) => `socket:meta:${socketId}`,
  roomMembers: (roomId: string) => `room:members:${roomId}`,
  typing: (roomId: string, userId: string) => `typing:${roomId}:${userId}`,
  presenceWatchers: (userId: string) => `presence:watchers:${userId}`,
  rateLimit: (userId: string, event: string) => `ratelimit:${userId}:${event}`,
  revokedTokens: 'auth:revoked_tokens',
} as const;