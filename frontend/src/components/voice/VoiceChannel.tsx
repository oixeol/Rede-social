'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWebRTCVoice, VoiceParticipant } from '@/hooks/useWebRTCVoice';
import { cn } from '@/lib/cn';
import { VoiceParticipant as VoiceParticipantType } from '@/hooks/useWebRTCVoice';

interface VoiceChannelProps {
  channelId: number | null;
  spaceId: number | null;
  userId: number;
  username: string;
  token: string;
  onClose: () => void;
}

export function VoiceChannel({
  channelId,
  spaceId,
  userId,
  username,
  token,
  onClose,
}: VoiceChannelProps) {
  const [showParticipants, setShowParticipants] = useState(true);
  const [speakingUsers, setSpeakingUsers] = useState<Set<number>>(new Set());

  const {
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
  } = useWebRTCVoice({
    channelId,
    spaceId,
    userId,
    username,
    token,
    onParticipantsChange: (ps) => {
      // Update speaking users
      const newSpeaking = new Set(ps.filter((p) => p.isSpeaking).map((p) => p.userId));
      setSpeakingUsers(newSpeaking);
    },
    onError: (err) => {
      console.error('[VoiceChannel] Error:', err);
      alert(err.message);
    },
  });

  // Auto-join when channelId changes
  useEffect(() => {
    if (channelId && !isConnected && !isJoining) {
      join();
    }
  }, [channelId, isConnected, isJoining, join]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        leave();
      }
    };
  }, [isConnected, leave]);

  const handleLeave = useCallback(async () => {
    await leave();
    onClose();
  }, [leave, onClose]);

  const handleToggleMute = useCallback(async () => {
    await toggleMute();
  }, [toggleMute]);

  const handleToggleDeafen = useCallback(async () => {
    await toggleDeafen();
  }, [toggleDeafen]);

  const otherParticipants = participants.filter((p) => p.userId !== userId);

  if (!channelId) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeave}
            className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Sair do canal de voz"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <div>
            <p className="text-white font-medium">Canal de Voz</p>
            <p className="text-xs text-white/50">
              {isConnected ? (
                <>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    Conectado
                  </span>
                  {' • '}
                  {participants.length} {participants.length === 1 ? 'pessoa' : 'pessoas'}
                </>
              ) : isJoining ? (
                'Conectando...'
              ) : (
                'Desconectado'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className={cn(
              'p-2 rounded-full transition-colors',
              showParticipants
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            )}
            aria-label={showParticipants ? 'Ocultar participantes' : 'Mostrar participantes'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid / Participants */}
        <div className={cn('flex-1 flex flex-col', showParticipants ? 'md:pl-64' : '')}>
          <div className="flex-1 flex items-center justify-center p-8">
            {participants.length === 0 ? (
              <div className="text-center text-white/60">
                <svg className="mx-auto h-16 w-16 mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-lg">Ninguém no canal de voz</p>
                <p className="text-sm mt-1">Convide amigos para conversar</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-6xl w-full">
                {participants.map((participant) => (
                  <ParticipantTile
                    key={participant.userId}
                    participant={participant}
                    isCurrentUser={participant.userId === userId}
                    isSpeaking={speakingUsers.has(participant.userId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-center gap-4 p-6 border-t border-white/10">
            <button
              onClick={handleToggleDeafen}
              className={cn(
                'p-4 rounded-full transition-all',
                isDeafened
                  ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50'
                  : 'bg-white/10 text-white hover:bg-white/20'
              )}
              aria-label={isDeafened ? 'Remover surdez' : 'Surdez'}
              disabled={!isConnected}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <button
              onClick={handleToggleMute}
              className={cn(
                'p-4 rounded-full transition-all',
                isMuted
                  ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50'
                  : 'bg-white/10 text-white hover:bg-white/20'
              )}
              aria-label={isMuted ? 'Ativar microfone' : 'Silenciar microfone'}
              disabled={!isConnected}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMuted ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7H5m14 0a7 7 0 01-14 0M17 17l-10-10" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                )}
              </svg>
            </button>

            <button
              onClick={handleLeave}
              className="p-4 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all ring-2 ring-red-500/30"
              aria-label="Sair do canal"
              disabled={!isConnected}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Participants Sidebar */}
        {showParticipants && (
          <aside className="fixed right-0 top-0 bottom-0 w-64 md:relative md:w-64 border-l border-white/10 bg-black/90 flex flex-col">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-white font-medium">Participantes ({participants.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {participants.map((participant) => (
                <ParticipantListItem
                  key={participant.userId}
                  participant={participant}
                  isCurrentUser={participant.userId === userId}
                  isSpeaking={speakingUsers.has(participant.userId)}
                />
              ))}
              {participants.length === 0 && (
                <p className="text-white/50 text-center py-8">Nenhum participante</p>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

interface ParticipantTileProps {
  participant: VoiceParticipantType;
  isCurrentUser: boolean;
  isSpeaking: boolean;
}

function ParticipantTile({ participant, isCurrentUser, isSpeaking }: ParticipantTileProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden bg-white/5 border border-white/10 transition-all',
        isSpeaking && 'ring-2 ring-orange-400/50 shadow-lg shadow-orange-400/10'
      )}
    >
      {participant.stream && !isCurrentUser ? (
        <audio
          ref={(el) => {
            if (el && participant.stream) {
              el.srcObject = participant.stream;
            }
          }}
          autoPlay
          playsInline
          className="w-full h-full"
        />
      ) : (
        <div className="w-full h-48 flex items-center justify-center bg-gradient-to-br from-orange-500/20 to-orange-900/20">
          <div className="text-center">
            <div className={cn(
              'mx-auto w-20 h-20 rounded-full border-2 border-white/20 bg-white/5 flex items-center justify-center text-2xl font-bold text-white',
              isSpeaking && 'animate-pulse ring-2 ring-orange-400'
            )}>
              {participant.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <p className="mt-2 text-white font-medium truncate px-2">{participant.name}</p>
            <p className="text-white/50 text-xs truncate px-2">@{participant.username}</p>
          </div>
        </div>
      )}

      {/* Speaking indicator */}
      {isSpeaking && !participant.stream && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 text-orange-400 text-xs font-medium animate-pulse">
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          Falando
        </div>
      )}

      {/* User status badges */}
      <div className="absolute top-2 right-2 flex gap-1">
        {participant.isMuted && (
          <span className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
            <svg className="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7H5m14 0a7 7 0 01-14 0M17 17l-10-10" />
            </svg>
          </span>
        )}
        {participant.isDeafened && (
          <span className="px-1.5 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded-full">
            <svg className="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </span>
        )}
        {isCurrentUser && (
          <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">Você</span>
        )}
      </div>
    </div>
  );
}

interface ParticipantListItemProps {
  participant: VoiceParticipantType;
  isCurrentUser: boolean;
  isSpeaking: boolean;
}

function ParticipantListItem({ participant, isCurrentUser, isSpeaking }: ParticipantListItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-lg transition-colors',
        isSpeaking && 'bg-orange-500/10 ring-1 ring-orange-400/30',
        !isSpeaking && 'hover:bg-white/5'
      )}
    >
      <div className={cn(
        'relative w-10 h-10 rounded-full border-2 border-white/20 bg-white/5 flex items-center justify-center text-sm font-bold text-white overflow-hidden',
        isSpeaking && 'ring-2 ring-orange-400 animate-pulse'
      )}>
        {participant.avatar ? (
          <img src={participant.avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          participant.name?.charAt(0).toUpperCase() || '?'
        )}
        {isSpeaking && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-orange-400 rounded-full border-2 border-black flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
              <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{participant.name}</p>
        <p className="text-white/50 text-xs truncate">@{participant.username}</p>
      </div>
      <div className="flex items-center gap-1">
        {participant.isMuted && (
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7H5m14 0a7 7 0 01-14 0M17 17l-10-10" />
          </svg>
        )}
        {participant.isDeafened && (
          <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
        {isCurrentUser && (
          <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">Você</span>
        )}
      </div>
    </div>
  );
}