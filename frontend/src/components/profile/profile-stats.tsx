'use client';

import { useCallback, useRef, useState } from 'react';

import { FollowListModal, type FollowListKind } from '@/components/profile/follow-list-modal';
import { cn } from '@/lib/cn';

export interface ProfileStatsProps {
  posts: number;
  followers: number;
  following: number;
  username: string;
  isMe: boolean;
  onFollowersChange?: (delta: number) => void;
  onFollowingChange?: (delta: number) => void;
}

/** Estatísticas do perfil: publicações, seguidores e seguindo. */
export function ProfileStats({
  posts,
  followers,
  following,
  username,
  isMe,
  onFollowersChange,
  onFollowingChange,
}: ProfileStatsProps) {
  const [openKind, setOpenKind] = useState<FollowListKind | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleClose = useCallback(() => {
    setOpenKind(null);
    triggerRef.current?.focus();
  }, []);

  const handleFollowersChange = useCallback(
    (delta: number) => onFollowersChange?.(delta),
    [onFollowersChange],
  );

  const handleFollowingChange = useCallback(
    (delta: number) => onFollowingChange?.(delta),
    [onFollowingChange],
  );

  const items = [
    { key: 'posts', value: posts, label: 'publicações' },
    { key: 'followers', value: followers, label: 'seguidores' },
    { key: 'following', value: following, label: 'seguindo' },
  ] as const;

  return (
    <>
      <div className="relative flex flex-wrap gap-x-8 gap-y-4 pb-2">
        {/* Subtle brand glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand/30 to-transparent -ml-4 -mr-4" />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 relative z-10" aria-label="Estatísticas do perfil">
          {items.map((item, index) => (
            <div key={item.key} className="flex items-center gap-8">
              <div className="flex flex-col items-start gap-1 group">
                {(item.key === 'followers' || item.key === 'following') ? (
                  <button
                    type="button"
                    onClick={() => setOpenKind(item.key)}
                    aria-haspopup="dialog"
                    aria-label={`${item.value} ${item.label}. Ver lista`}
                    className="flex items-baseline gap-1 text-foreground hover:text-brand transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded"
                  >
                    <span className="text-[22px] leading-[28px] font-bold">{item.value}</span>
                    <span className="text-[13px] leading-[18px] text-muted">{item.label}</span>
                  </button>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-[22px] leading-[28px] font-bold text-foreground">{item.value}</span>
                    <span className="text-[13px] leading-[18px] text-muted">{item.label}</span>
                  </div>
                )}
              </div>
              {index < items.length - 1 && (
                <div className="h-6 w-[1.5px] bg-border-strong/60 blur-[0.5px]" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>

      {openKind ? (
        <FollowListModal
          kind={openKind}
          username={username}
          isMe={isMe}
          onClose={handleClose}
          onCountChange={openKind === 'followers' ? handleFollowersChange : handleFollowingChange}
        />
      ) : null}
    </>
  );
}
