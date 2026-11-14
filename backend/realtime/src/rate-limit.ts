import { getRedis, REDIS_KEYS } from './redis.js';

interface RateLimitConfig {
  max: number;
  windowMs: number;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  'room:join': { max: 20, windowMs: 60_000 },
  'message:create': { max: 30, windowMs: 60_000 },
  'typing:start': { max: 60, windowMs: 60_000 },
  'read:ack': { max: 100, windowMs: 60_000 },
  'presence:update': { max: 10, windowMs: 60_000 },
};

export async function checkRateLimit(
  userId: string,
  event: string,
  customLimit?: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const limit = customLimit || DEFAULT_LIMITS[event] || { max: 50, windowMs: 60_000 };
  const redis = getRedis();
  const key = REDIS_KEYS.rateLimit(userId, event);
  const now = Date.now();
  const windowStart = now - limit.windowMs;

  await redis.zRemRangeByScore(key, 0, windowStart);
  await redis.zAdd(key, { score: now, value: `${now}:${Math.random()}` });
  const current = await redis.zCard(key);
  await redis.pExpire(key, limit.windowMs);

  const allowed = current <= limit.max;
  const remaining = Math.max(0, limit.max - current);
  const resetAt = now + limit.windowMs;

  if (!allowed) {
    await redis.zRem(key, `${now}:${Math.random()}`);
  }

  return { allowed, remaining, resetAt };
}

export function createRateLimitMiddleware() {
  return async (socket: any, next: (err?: Error) => void) => {
    const event = socket.event?.name || 'unknown';
    const userId = socket.data.user?.id;
    if (!userId) return next(new Error('unauthorized'));

    const { allowed } = await checkRateLimit(userId, event);
    if (!allowed) {
      return next(new Error('rate_limited'));
    }
    next();
  };
}