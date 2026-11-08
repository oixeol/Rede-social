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
      <dl className="flex flex-wrap items-stretch" aria-label="Estatísticas do perfil">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={cn(
              'flex min-w-0 flex-col-reverse items-start',
              index > 0 && 'border-l border-border pl-6',
              index < items.length - 1 && 'pr-6',
            )}
          >
            <dt className="text-[13px] leading-[18px] text-muted">{item.label}</dt>
            <dd className="text-[20px] leading-[26px] font-bold text-foreground">
              {item.key === 'posts' ? (
                item.value
              ) : (
                <button
                  ref={item.key === 'followers' ? triggerRef : undefined}
                  type="button"
                  onClick={() => setOpenKind(item.key)}
                  aria-haspopup="dialog"
                  aria-label={`${item.value} ${item.label}. Ver lista`}
                  className="rounded-md text-[20px] leading-[26px] font-bold text-foreground transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {item.value}
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>

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
