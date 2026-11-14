import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedis, closeRedis } from './redis.js';
import { authMiddleware, AuthenticatedSocket } from './auth.js';
import { onPresenceConnect, startPresenceHeartbeat } from './presence.js';
import { registerMessageEvents } from './events/messages.js';
import { registerPresenceEvents, subscribeToPubSub } from './events/presence.js';

const PORT = parseInt(process.env.PORT || '3002', 10);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function connectWithRetry(redis: any, name: string, maxRetries = 10, delayMs = 2000): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await redis.connect();
      console.log(`[WS] ${name} Redis connected successfully`);
      return true;
    } catch (err) {
      console.warn(`[WS] ${name} Redis connection attempt ${i + 1}/${maxRetries} failed:`, err instanceof Error ? err.message : err);
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  console.error(`[WS] ${name} Failed to connect to Redis after ${maxRetries} retries`);
  return false;
}

async function bootstrap() {
  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const io = new Server<AuthenticatedSocket>(httpServer, {
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
  
  // Start HTTP server immediately so health check works
  httpServer.listen(PORT, () => {
    console.log(`[WS] Server running on port ${PORT}`);
  });
  
  // Connect to Redis in background, don't block startup
  const pubConnected = connectWithRetry(pubClient, 'pub');
  const subConnected = connectWithRetry(subClient, 'sub');
  
  // Wait for both connections, but don't crash if they fail
  const [pubOk, subOk] = await Promise.all([pubConnected, subConnected]);
  
  if (pubOk && subOk) {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[WS] Redis adapter enabled');
  } else {
    console.warn('[WS] Running without Redis adapter (single-instance mode)');
  }

  io.use(authMiddleware);

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const user = socket.data.user;
    console.log(`[WS] Connected: ${user.username} (${socket.id})`);

    const friendIds = await fetchFriendIds(user.id);
    await onPresenceConnect(io, socket, friendIds);

    registerMessageEvents(io, socket);
    registerPresenceEvents(io, socket);

    socket.on('disconnect', (reason: string) => {
      console.log(`[WS] Disconnected: ${user.username} - ${reason}`);
    });

    socket.on('error', (err: Error) => {
      console.error(`[WS] Socket error: ${user.username}`, err);
    });
  });

  await subscribeToPubSub(io);
  startPresenceHeartbeat(io);

  httpServer.listen(PORT, () => {
    console.log(`[WS] Server running on port ${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[WS] ${signal} received, shutting down...`);
    await closeRedis();
    await pubClient.quit();
    await subClient.quit();
    httpServer.close(() => process.exit(0));
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

async function fetchFriendIds(userId: string): Promise<string[]> {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/users/${userId}/friends`, {
      headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { friends?: Array<{ id: string }> };
    return data.friends?.map((f) => f.id) || [];
  } catch {
    return [];
  }
}

bootstrap().catch((err) => {
  console.error('[WS] Bootstrap failed:', err);
  process.exit(1);
});