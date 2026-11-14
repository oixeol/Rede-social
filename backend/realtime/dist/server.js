import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedis, closeRedis } from './redis.js';
import { authMiddleware } from './auth.js';
import { onPresenceConnect, startPresenceHeartbeat } from './presence.js';
import { registerMessageEvents } from './events/messages.js';
import { registerPresenceEvents, subscribeToPubSub } from './events/presence.js';
const PORT = parseInt(process.env.PORT || '3002', 10);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
async function bootstrap() {
    const httpServer = createServer();
    const io = new Server(httpServer, {
        cors: {
            origin: (process.env.ALLOWED_ORIGINS || 'https://rede-social-rho-five.vercel.app').split(','),
            credentials: true,
            methods: ['GET', 'POST'],
        },
        pingInterval: 20_000,
        pingTimeout: 10_000,
        maxHttpBufferSize: 1e6,
    });
    const redis = getRedis();
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    await pubClient.connect();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    io.use(authMiddleware);
    io.on('connection', async (socket) => {
        const user = socket.data.user;
        console.log(`[WS] Connected: ${user.username} (${socket.id})`);
        const friendIds = await fetchFriendIds(user.id);
        await onPresenceConnect(io, socket, friendIds);
        registerMessageEvents(io, socket);
        registerPresenceEvents(io, socket);
        socket.on('disconnect', (reason) => {
            console.log(`[WS] Disconnected: ${user.username} - ${reason}`);
        });
        socket.on('error', (err) => {
            console.error(`[WS] Socket error: ${user.username}`, err);
        });
    });
    await subscribeToPubSub(io);
    startPresenceHeartbeat(io);
    httpServer.listen(PORT, () => {
        console.log(`[WS] Server running on port ${PORT}`);
    });
    const shutdown = async (signal) => {
        console.log(`[WS] ${signal} received, shutting down...`);
        await closeRedis();
        await pubClient.quit();
        await subClient.quit();
        httpServer.close(() => process.exit(0));
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
async function fetchFriendIds(userId) {
    try {
        const apiUrl = process.env.API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/users/${userId}/friends`, {
            headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}` },
        });
        if (!res.ok)
            return [];
        const data = (await res.json());
        return data.friends?.map((f) => f.id) || [];
    }
    catch {
        return [];
    }
}
bootstrap().catch((err) => {
    console.error('[WS] Bootstrap failed:', err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map