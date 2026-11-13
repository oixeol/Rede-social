'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ChatEventEnvelope } from '@/lib/chat-events.ts';
import { parseSseEnvelope, dispatchSseEvent } from '@/lib/chat-events.ts';

export type SseStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface UseChatEventsOptions {
  /** Callback para envelopes já normalizados. */
  onEvent: (envelope: ChatEventEnvelope) => void;
  /** Chamado ao reconectar (após erro) para eventual reconciliação. */
  onReconnect?: () => void;
}

export function useChatEvents({ onEvent, onReconnect }: UseChatEventsOptions) {
  const esRef = useRef<EventSource | null>(null);
  const statusRef = useRef<SseStatus>('connecting');
  const [status, setStatus] = useState<SseStatus>('connecting');
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  const reconnectingRef = useRef(false);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    const source = new EventSource('/api/events');
    esRef.current = source;
    let wasConnected = false;

    const setStatusState = (next: SseStatus) => {
      statusRef.current = next;
      setStatus(next);
    };

    const handleOpen = () => {
      if (wasConnected && reconnectingRef.current) {
        reconnectingRef.current = false;
        onReconnectRef.current?.();
      }
      wasConnected = true;
      setStatusState('connected');
    };

    const handleError = () => {
      if (source.readyState === EventSource.CLOSED) {
        setStatusState('disconnected');
      } else if (source.readyState === EventSource.CONNECTING) {
        if (wasConnected) {
          reconnectingRef.current = true;
          setStatusState('reconnecting');
        }
      }
    };

    const handleMessage = (event: MessageEvent<string>) => {
      const envelope = parseSseEnvelope(event.data, event.type);
      if (envelope) onEventRef.current(envelope);
    };

    source.addEventListener('message.created', handleMessage as EventListener);
    source.addEventListener('message.updated', handleMessage as EventListener);
    source.addEventListener('message.deleted', handleMessage as EventListener);
    source.addEventListener('channel.created', handleMessage as EventListener);
    source.onmessage = handleMessage;
    source.onopen = handleOpen;
    source.onerror = handleError;

    setStatusState('connecting');

    return () => {
      source.removeEventListener('message.created', handleMessage as EventListener);
      source.removeEventListener('message.updated', handleMessage as EventListener);
      source.removeEventListener('message.deleted', handleMessage as EventListener);
      source.removeEventListener('channel.created', handleMessage as EventListener);
      source.onmessage = null;
      source.onopen = null;
      source.onerror = null;
      source.close();
      esRef.current = null;
    };
  }, []);

  return status;
}