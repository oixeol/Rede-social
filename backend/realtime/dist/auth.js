import { jwtVerify } from 'jose';
import { parse } from 'cookie';
import { z } from 'zod';
import { getRedis, REDIS_KEYS } from './redis.js';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://rede-social-rho-five.vercel.app').split(',');
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'change-me-in-production');
const JWT_ISSUER = process.env.JWT_ISSUER || 'orbit';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'orbit-client';
const sessionSchema = z.object({
    sub: z.string().uuid(), // user id
    email: z.string().email(),
    username: z.string().min(3).max(30),
    sid: z.string().uuid(), // session id
    iat: z.number(),
    exp: z.number(),
    iss: z.string().optional(),
    aud: z.string().optional(),
});
async function verifySessionCookie(socket) {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader)
        return null;
    const cookies = parse(cookieHeader);
    const token = cookies['vibra_session'];
    if (!token)
        return null;
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
        const parsed = sessionSchema.safeParse(payload);
        if (!parsed.success)
            return null;
        // Check revocation in Redis
        const redis = getRedis();
        const revoked = await redis.sIsMember(REDIS_KEYS.revokedTokens, parsed.data.sid);
        if (revoked)
            return null;
        return parsed.data;
    }
    catch {
        return null;
    }
}
function verifyOrigin(socket) {
    const origin = socket.handshake.headers.origin;
    if (!origin)
        return false;
    return ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed.trim()));
}
export async function authMiddleware(socket, next) {
    // 1. Origin check
    if (!verifyOrigin(socket)) {
        return next(new Error('unauthorized'));
    }
    // 2. Cookie + JWT verification
    const session = await verifySessionCookie(socket);
    if (!session) {
        return next(new Error('unauthorized'));
    }
    // 3. Register socket in Redis for revocation tracking
    const redis = getRedis();
    await redis.sAdd(REDIS_KEYS.userSessions(session.sub), session.sid);
    await redis.hSet(REDIS_KEYS.socketMeta(socket.id), {
        userId: session.sub,
        sessionId: session.sid,
        connectedAt: Date.now().toString(),
    });
    await redis.expire(REDIS_KEYS.socketMeta(socket.id), 86400); // 24h TTL
    // 4. Attach user data to socket
    socket.data.user = {
        id: session.sub,
        email: session.email,
        username: session.username,
        sessionId: session.sid,
    };
    // 5. Auto-disconnect when token expires
    const ttlMs = (session.exp - Math.floor(Date.now() / 1000)) * 1000;
    if (ttlMs > 0) {
        setTimeout(() => {
            socket.disconnect(true);
        }, ttlMs).unref();
    }
    next();
}
export async function assertRoomMember(socket, roomId) {
    const redis = getRedis();
    const isMember = await redis.sIsMember(REDIS_KEYS.roomMembers(roomId), socket.data.user.id);
    return isMember;
}
export async function revokeSession(userId, sessionId) {
    const redis = getRedis();
    await redis.sAdd(REDIS_KEYS.revokedTokens, sessionId);
    await redis.sRem(REDIS_KEYS.userSessions(userId), sessionId);
}
export async function revokeAllUserSessions(userId) {
    const redis = getRedis();
    const sessions = await redis.sMembers(REDIS_KEYS.userSessions(userId));
    if (sessions.length > 0) {
        await redis.sAdd(REDIS_KEYS.revokedTokens, sessions);
    }
    await redis.del(REDIS_KEYS.userSessions(userId));
}
//# sourceMappingURL=auth.js.map