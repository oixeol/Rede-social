'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as socketIoClient from 'socket.io-client';
import type { Socket } from 'socket.io-client';

const { io: socketIo } = socketIoClient;

interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  replyToId?: string;
  mediaIds?: string[];
  timestamp: number;
}

interface TypingUser {
  userId: string;
  username: string;
}

interface PresenceUpdate {
  userId: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  customStatus?: string;
  at: number;
}

interface Notification {
  id: string;
  kind: string;
  text: string;
  link?: string;
  createdAt: number;
}

interface UseRealtimeOptions {
  onMessage?: (msg: Message) => void;
  onTypingStart?: (user: TypingUser) => void;
  onTypingStop?: (userId: string) => void;
  onPresenceUpdate?: (update: PresenceUpdate) => void;
  onNotification?: (notif: Notification) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = socketIo('/socket.io', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      options.onConnect?.();
    });

    socket.on('disconnect', (reason: string) => {
      setConnected(false);
      options.onDisconnect?.(reason);
    });

    socket.on('connect_error', (err: Error) => {
      setError(err.message);
    });

    socket.on('message:new', (msg: Message) => {
      options.onMessage?.(msg);
    });

    socket.on('typing:start', (data: TypingUser & { roomId: string }) => {
      options.onTypingStart?.(data);
    });

    socket.on('typing:stop', (data: { userId: string; roomId: string }) => {
      options.onTypingStop?.(data.userId);
    });

    socket.on('presence:update', (update: PresenceUpdate) => {
      options.onPresenceUpdate?.(update);
    });

    socket.on('presence:snapshot', (states: Array<{ userId: string; status: string }>) => {
      states.forEach((s) => options.onPresenceUpdate?.({
        userId: s.userId,
        status: s.status as PresenceUpdate['status'],
        at: Date.now(),
      }));
    });

    socket.on('read:ack', (data: { roomId: string; userId: string; lastReadMessageId: string }) => {
      // Handle read receipts if needed
    });

    socket.on('notification:new', (notif: Notification) => {
      options.onNotification?.(notif);
    });

    return () => {
      socket.disconnect();
    };
  }, [options.onMessage, options.onTypingStart, options.onTypingStop, options.onPresenceUpdate, options.onNotification, options.onConnect, options.onDisconnect]);

  const joinRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('room:join', { roomId }, (ack: { ok: boolean; error?: string }) => {
      if (!ack.ok) console.error('Failed to join room:', ack.error);
    });
  }, []);

  const sendMessage = useCallback((
    roomId: string,
    content: string,
    opts?: { replyToId?: string; mediaIds?: string[] }
  ) => {
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    socketRef.current?.emit('message:create', {
      roomId,
      content,
      nonce,
      ...opts,
    }, (ack: { ok: boolean; error?: string }) => {
      if (!ack.ok) console.error('Failed to send message:', ack.error);
    });
  }, []);

  const startTyping = useCallback((roomId: string) => {
    socketRef.current?.emit('typing:start', { roomId });
  }, []);

  const stopTyping = useCallback((roomId: string) => {
    socketRef.current?.emit('typing:stop', { roomId });
  }, []);

  const markRead = useCallback((roomId: string, lastReadMessageId: string) => {
    socketRef.current?.emit('read:ack', { roomId, lastReadMessageId });
  }, []);

  const updatePresence = useCallback((status: PresenceUpdate['status'], customStatus?: string) => {
    socketRef.current?.emit('presence:update', { status, customStatus });
  }, []);

  return {
    socket: socketRef.current,
    connected,
    error,
    joinRoom,
    sendMessage,
    startTyping,
    stopTyping,
    markRead,
    updatePresence,
  };
}