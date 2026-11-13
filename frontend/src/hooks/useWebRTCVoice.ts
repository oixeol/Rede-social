'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface VoiceParticipant {
  userId: number;
  username: string;
  name: string;
  avatar: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  joinedAt: number;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
}

interface UseWebRTCVoiceOptions {
  channelId: number | null;
  spaceId: number | null;
  userId: number;
  username: string;
  token: string;
  onParticipantsChange?: (participants: VoiceParticipant[]) => void;
  onError?: (error: Error) => void;
}

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const ICE_SERVERS = { iceServers: STUN_SERVERS };

export function useWebRTCVoice({
  channelId,
  spaceId,
  userId,
  username,
  token,
  onParticipantsChange,
  onError,
}: UseWebRTCVoiceOptions) {
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get API base URL
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

  // Initialize local media stream
  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
        video: false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Setup audio analysis for voice activity detection
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      return stream;
    } catch (err) {
      const error = err as Error;
      console.error('[Voice] Failed to get user media:', error);
      onError?.(new Error('Não foi possível acessar o microfone. Verifique as permissões.'));
      throw error;
    }
  }, [onError]);

  // Create peer connection for a remote user
  const createPeerConnection = useCallback(
    (remoteUserId: number, remoteUsername: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle incoming track
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === remoteUserId ? { ...p, stream: remoteStream } : p
          )
        );
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'voice.signal',
              payload: {
                targetUserId: remoteUserId,
                roomId: channelId,
                signal: {
                  type: 'candidate',
                  candidate: event.candidate.candidate,
                  sdpMid: event.candidate.sdpMid,
                  sdpMLineIndex: event.candidate.sdpMLineIndex,
                },
              },
            })
          );
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(`[Voice] Connection state with ${remoteUsername}:`, pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          // Attempt restart
          pc.restartIce();
        }
      };

      peerConnectionsRef.current.set(remoteUserId, pc);
      return pc;
    },
    [channelId]
  );

  // Create offer for a remote user
  const createOffer = useCallback(
    async (remoteUserId: number, remoteUsername: string) => {
      const pc = createPeerConnection(remoteUserId, remoteUsername);
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'voice.signal',
              payload: {
                targetUserId: remoteUserId,
                roomId: channelId,
                signal: { type: 'offer', sdp: offer.sdp },
              },
            })
          );
        }
      } catch (err) {
        console.error('[Voice] Failed to create offer:', err);
      }
    },
    [channelId, createPeerConnection]
  );

  // Handle incoming signaling message
  const handleSignal = useCallback(
    async (message: {
      fromUserId: number;
      fromUsername: string;
      signal: { type: 'offer' | 'answer'; sdp?: string } | { type: 'candidate'; candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
      roomId: number;
    }) => {
      const { fromUserId, fromUsername, signal, roomId } = message;
      if (roomId !== channelId) return;

      let pc = peerConnectionsRef.current.get(fromUserId);
      if (!pc) {
        pc = createPeerConnection(fromUserId, fromUsername);
      }

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'voice.signal',
                payload: {
                  targetUserId: fromUserId,
                  roomId: channelId,
                  signal: { type: 'answer', sdp: answer.sdp },
                },
              })
            );
          }
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.type === 'candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(signal));
        }
      } catch (err) {
        console.error('[Voice] Signal handling error:', err);
      }
    },
    [channelId, createPeerConnection]
  );

  // Handle voice state update from server
  const handleVoiceState = useCallback(
    (data: {
      channelId: number;
      userId: number;
      joined?: boolean;
      username?: string;
      name?: string;
      avatar?: string | null;
      isMuted?: boolean;
      isDeafened?: boolean;
      isSpeaking?: boolean;
    }) => {
      if (data.channelId !== channelId) return;

      if (data.joined === false) {
        // User left
        const pc = peerConnectionsRef.current.get(data.userId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(data.userId);
        }
        setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
      } else if (data.joined === true) {
        // User joined - create offer if it's not us
        if (data.userId !== userId) {
          setParticipants((prev) => {
            const exists = prev.some((p) => p.userId === data.userId);
            if (exists) return prev;
            return [
              ...prev,
              {
                userId: data.userId!,
                username: data.username || '',
                name: data.name || '',
                avatar: data.avatar || null,
                isMuted: false,
                isDeafened: false,
                isSpeaking: false,
                joinedAt: Date.now(),
              },
            ];
          });
          // Small delay to ensure participant is in state before creating offer
          setTimeout(() => createOffer(data.userId!, data.username || ''), 100);
        }
      } else {
        // State update (mute, deafen, speaking)
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === data.userId
              ? {
                  ...p,
                  isMuted: data.isMuted ?? p.isMuted,
                  isDeafened: data.isDeafened ?? p.isDeafened,
                  isSpeaking: data.isSpeaking ?? p.isSpeaking,
                }
              : p
          )
        );
      }
    },
    [channelId, userId, createOffer]
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!channelId || !token) return;

    const wsUrl = `${apiBase.replace('http', 'ws')}/api/v1/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Voice] WebSocket connected');
      setIsConnected(true);

      // Subscribe to voice channel
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          payload: { channelId, spaceId },
        })
      );

      // Join voice channel via REST
      fetch(`${apiBase}/api/channels/${channelId}/voice/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      }).catch((err) => console.error('[Voice] Join failed:', err));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'voice.state':
            handleVoiceState(message.payload);
            break;
          case 'voice.speaking':
            handleVoiceState({ ...message.payload, isSpeaking: message.payload.isSpeaking });
            break;
          case 'voice.signal':
            handleSignal(message.payload);
            break;
          case 'connected':
            console.log('[Voice] Server connected:', message.payload);
            break;
          case 'error':
            console.error('[Voice] Server error:', message.payload);
            onError?.(new Error(message.payload.message));
            break;
        }
      } catch (err) {
        console.error('[Voice] Message parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[Voice] WebSocket disconnected');
      setIsConnected(false);
      setParticipants([]);
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
    };

    ws.onerror = (err) => {
      console.error('[Voice] WebSocket error:', err);
      onError?.(new Error('Erro de conexão de voz'));
    };
  }, [channelId, spaceId, token, apiBase, handleVoiceState, handleSignal, onError]);

  // Disconnect from voice channel
  const disconnect = useCallback(async () => {
    if (!channelId) return;

    try {
      await fetch(`${apiBase}/api/channels/${channelId}/voice/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } catch (err) {
      console.error('[Voice] Leave failed:', err);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current = null;
    }

    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }

    setIsConnected(false);
    setParticipants([]);
    setIsMuted(false);
    setIsDeafened(false);
  }, [channelId, apiBase]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (!channelId) return;
    const newMuted = !isMuted;

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMuted;
      });
    }

    setIsMuted(newMuted);

    try {
      await fetch(`${apiBase}/api/channels/${channelId}/voice/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ muted: newMuted }),
      });
    } catch (err) {
      console.error('[Voice] Mute toggle failed:', err);
      setIsMuted(!newMuted);
    }
  }, [channelId, isMuted, apiBase]);

  // Toggle deafen
  const toggleDeafen = useCallback(async () => {
    if (!channelId) return;
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);

    try {
      await fetch(`${apiBase}/api/channels/${channelId}/voice/deafen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ deafened: newDeafened }),
      });
    } catch (err) {
      console.error('[Voice] Deafen toggle failed:', err);
      setIsDeafened(!newDeafened);
    }
  }, [channelId, isDeafened, apiBase]);

  // Voice activity detection
  const startVoiceDetection = useCallback(() => {
    if (!analyserRef.current || speakingIntervalRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    let wasSpeaking = false;

    const checkSpeaking = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const isSpeaking = average > 15; // Threshold for voice activity

      if (isSpeaking !== wasSpeaking) {
        wasSpeaking = isSpeaking;

        // Send speaking state to server
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'voice.speaking',
              payload: { channelId, isSpeaking },
            })
          );
        }
      }
    };

    speakingIntervalRef.current = setInterval(checkSpeaking, 100);
  }, [channelId]);

  // Join voice channel
  const join = useCallback(async () => {
    if (!channelId || isJoining || isConnected) return;

    setIsJoining(true);
    try {
      await initializeMedia();
      startVoiceDetection();
      connect();
    } catch (err) {
      console.error('[Voice] Join error:', err);
      setIsJoining(false);
    }
  }, [channelId, isJoining, isConnected, initializeMedia, connect, startVoiceDetection]);

  // Leave voice channel
  const leave = useCallback(async () => {
    await disconnect();
    setIsJoining(false);
  }, [disconnect]);

  // Effect for channelId changes
  const hasJoinedRef = useRef(false);
  useEffect(() => {
    if (channelId && !isConnected && !isJoining && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      // Defer join to avoid setState in effect
      setTimeout(() => join(), 0);
    } else if (!channelId && isConnected) {
      hasJoinedRef.current = false;
      // Defer leave to avoid setState in effect
      setTimeout(() => leave(), 0);
    }

    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [channelId, isConnected, isJoining, join, leave, disconnect]);

  // Notify participants change
  useEffect(() => {
    onParticipantsChange?.(participants);
  }, [participants, onParticipantsChange]);

  return {
    participants,
    isConnected,
    isJoining,
    localStream,
    isMuted,
    isDeafened,
    join,
    leave,
    toggleMute,
    toggleDeafen,
  };
}

export type { VoiceParticipant };