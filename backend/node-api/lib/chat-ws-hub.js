'use strict';

/**
 * WebSocket manager (ws nativo) para chat, presence, typing e voice signaling.
 * Zero dependência paga, 100% self-hosted no Node.js.
 */

const { WebSocketServer, WebSocket } = require('ws');

class ChatWsHub {
  constructor({ isSessionActive = null, maxConnectionsPerUser = 5 } = {}) {
    this.wss = null;
    this.clients = new Map(); // userId -> Set<ClientInfo>
    this.typingTimeouts = new Map(); // key -> Timeout
    this.isSessionActive = typeof isSessionActive === 'function' ? isSessionActive : null;
    this.maxConnectionsPerUser = maxConnectionsPerUser;
  }

  /**
   * Attaches WSS to an HTTP/HTTPS server.
   */
  attach(server, sessionValidator) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', async (req, socket, head) => {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (url.pathname !== '/api/v1/ws') {
        socket.destroy();
        return;
      }

      // Authenticate connection via query token or cookie
      const token = url.searchParams.get('token') || this.extractCookie(req, 'vibra_session');
      if (!token || !sessionValidator) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const user = sessionValidator(token);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req, user, token);
      });
    });

    this.wss.on('connection', (ws, req, user, sessionToken) => {
      this.handleConnection(ws, req, user, sessionToken);
    });

    console.log('[WebSocket] Server attached to /api/v1/ws');
  }

  extractCookie(req, name) {
    const header = req.headers.cookie || '';
    const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  handleConnection(ws, req, user, sessionToken) {
    const userId = Number(user.id);

    // Limit per user
    const existing = this.clients.get(userId) || new Set();
    if (existing.size >= this.maxConnectionsPerUser) {
      ws.close(4008, 'Limite de conexões WebSocket atingido');
      return;
    }

    const client = {
      ws,
      userId,
      user,
      sessionToken,
      channels: new Set(),
      conversations: new Set(),
      spaces: new Set(),
      isAlive: true,
    };

    existing.add(client);
    this.clients.set(userId, existing);

    // Setup ping/pong
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Handle messages
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        this.handleMessage(client, msg);
      } catch (err) {
        this.sendError(ws, 'JSON inválido');
      }
    });

    ws.on('close', () => this.cleanup(client));
    ws.on('error', () => this.cleanup(client));

    // Send initial ACK + online status to friends/members
    this.send(ws, 'connected', { userId, serverTime: Date.now() });
    this.broadcastPresence(userId, 'online');
  }

  handleMessage(client, msg) {
    const { type, payload } = msg || {};

    switch (type) {
      case 'ping':
        this.send(client.ws, 'pong', { time: Date.now() });
        break;

      case 'subscribe':
        // Subscribe to space, channel, or conversation
        if (payload?.spaceId) client.spaces.add(Number(payload.spaceId));
        if (payload?.channelId) client.channels.add(Number(payload.channelId));
        if (payload?.conversationId) client.conversations.add(Number(payload.conversationId));
        this.send(client.ws, 'subscribed', payload);
        break;

      case 'unsubscribe':
        if (payload?.spaceId) client.spaces.delete(Number(payload.spaceId));
        if (payload?.channelId) client.channels.delete(Number(payload.channelId));
        if (payload?.conversationId) client.conversations.delete(Number(payload.conversationId));
        this.send(client.ws, 'unsubscribed', payload);
        break;

      case 'typing':
        // Broadcast typing indicator
        this.handleTyping(client, payload);
        break;

      case 'voice.signal':
        // WebRTC signaling (offer, answer, candidate)
        this.handleVoiceSignal(client, payload);
        break;

      default:
        this.sendError(client.ws, `Tipo de mensagem desconhecido: ${type}`);
    }
  }

  handleTyping(client, payload) {
    const { channelId, conversationId, isTyping = true } = payload || {};
    const key = channelId ? `ch_${channelId}_${client.userId}` : `cv_${conversationId}_${client.userId}`;

    // Clear existing timeout
    if (this.typingTimeouts.has(key)) {
      clearTimeout(this.typingTimeouts.get(key));
      this.typingTimeouts.delete(key);
    }

    const eventData = {
      userId: client.userId,
      username: client.user.username,
      name: client.user.name,
      channelId: channelId || null,
      conversationId: conversationId || null,
      isTyping,
    };

    if (channelId) {
      this.broadcastToChannel(channelId, 'user.typing', eventData, client.userId);
    } else if (conversationId) {
      this.broadcastToConversation(conversationId, 'user.typing', eventData, client.userId);
    }

    // Auto-stop typing after 5 seconds if not explicitly stopped
    if (isTyping) {
      const timeout = setTimeout(() => {
        const stopData = { ...eventData, isTyping: false };
        if (channelId) this.broadcastToChannel(channelId, 'user.typing', stopData);
        else if (conversationId) this.broadcastToConversation(conversationId, 'user.typing', stopData);
        this.typingTimeouts.delete(key);
      }, 5000);
      this.typingTimeouts.set(key, timeout);
    }
  }

  handleVoiceSignal(client, payload) {
    const { targetUserId, signal, roomId } = payload || {};
    if (!targetUserId || !signal) return;

    // Direct signaling to target user
    this.sendToUser(targetUserId, 'voice.signal', {
      fromUserId: client.userId,
      fromUsername: client.user.username,
      signal,
      roomId,
    });
  }

  broadcastPresence(userId, status) {
    const payload = { userId, status, timestamp: Date.now() };
    for (const clients of this.clients.values()) {
      for (const client of clients) {
        if (client.userId !== userId && client.ws.readyState === WebSocket.OPEN) {
          this.send(client.ws, 'presence.update', payload);
        }
      }
    }
  }

  broadcastToChannel(channelId, type, payload, excludeUserId = null) {
    for (const clients of this.clients.values()) {
      for (const client of clients) {
        if (excludeUserId && client.userId === excludeUserId) continue;
        if (client.channels.has(Number(channelId)) && client.ws.readyState === WebSocket.OPEN) {
          this.send(client.ws, type, payload);
        }
      }
    }
  }

  broadcastToConversation(conversationId, type, payload, excludeUserId = null) {
    for (const clients of this.clients.values()) {
      for (const client of clients) {
        if (excludeUserId && client.userId === excludeUserId) continue;
        if (client.conversations.has(Number(conversationId)) && client.ws.readyState === WebSocket.OPEN) {
          this.send(client.ws, type, payload);
        }
      }
    }
  }

  sendToUser(userId, type, payload) {
    const clients = this.clients.get(Number(userId));
    if (!clients) return false;
    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        this.send(client.ws, type, payload);
      }
    }
    return true;
  }

  send(ws, type, payload) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }

  sendError(ws, message) {
    this.send(ws, 'error', { message });
  }

  cleanup(client) {
    const clients = this.clients.get(client.userId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.clients.delete(client.userId);
        this.broadcastPresence(client.userId, 'offline');
      }
    }
  }

  // Ping all connections every 30s to detect stale sockets
  startPingInterval(intervalMs = 30000) {
    setInterval(() => {
      for (const clients of this.clients.values()) {
        for (const client of clients) {
          if (!client.ws.isAlive) {
            client.ws.terminate();
            this.cleanup(client);
            continue;
          }
          client.ws.isAlive = false;
          client.ws.ping();
        }
      }
    }, intervalMs);
  }

  close() {
    if (this.wss) this.wss.close();
    this.clients.clear();
  }
}

module.exports = { ChatWsHub };