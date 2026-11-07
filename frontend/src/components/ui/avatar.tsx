import { BadgeCheck } from 'lucide-react';
import Image from 'next/image';

import { cn } from '@/lib/cn';
import { isSafeMediaSource } from '@/lib/media';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  src?: string | null;
  alt: string;
  name?: string;
  size?: AvatarSize;
  online?: boolean;
  verified?: boolean;
  ring?: boolean;
  className?: string;
  /** Carrega a imagem imediatamente (use em avatares acima da dobra). */
  eager?: boolean;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'size-7 text-[10px]',
  sm: 'size-9 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-16 text-lg',
  xl: 'size-28 text-2xl',
};

const imageSizes: Record<AvatarSize, number> = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 64,
  xl: 112,
};

const statusClasses: Record<AvatarSize, string> = {
  xs: 'size-2 border',
  sm: 'size-2.5 border-2',
  md: 'size-3 border-2',
  lg: 'size-3.5 border-2',
  xl: 'size-5 border-[3px]',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

export function Avatar({
  src,
  alt,
  name,
  size = 'md',
  online = false,
  verified = false,
  ring = false,
  className,
  eager = false,
}: AvatarProps) {
  const safeSrc = src && isSafeMediaSource(src) ? src : null;
  const fallback = name ? initials(name) : alt.slice(0, 2).toUpperCase();

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'relative inline-flex overflow-hidden rounded-[34%] bg-gradient-to-br from-brand-fill to-accent font-bold text-on-brand',
          sizeClasses[size],
          ring && 'ring-2 ring-brand ring-offset-2 ring-offset-surface',
        )}
      >
        {safeSrc ? (
          <Image
            src={safeSrc}
            alt={alt}
            width={imageSizes[size]}
            height={imageSizes[size]}
            className="size-full object-cover"
            loading={eager ? 'eager' : 'lazy'}
            unoptimized
          />
        ) : (
          <span aria-hidden="true" className="m-auto">{fallback}</span>
        )}
      </span>

      {online ? (
        <span
          aria-label="Online"
          aria-live="polite"
          role="status"
          className={cn(
            'absolute right-0 bottom-0 rounded-full border-surface bg-success',
            statusClasses[size],
          )}
        />
      ) : null}

      {verified ? (
        <span
          role="img"
          aria-label="Perfil verificado"
          title="Perfil verificado"
          className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full bg-surface text-accent"
        >
          <BadgeCheck aria-hidden="true" className="size-full fill-accent text-surface" strokeWidth={2.4} />
        </span>
      ) : null}
    </span>
  );
}
