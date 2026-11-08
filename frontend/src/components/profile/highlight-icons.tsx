import {
  Camera,
  Coffee,
  Crown,
  Dumbbell,
  Gamepad2,
  Music,
  Palette,
  Plane,
  Sparkles,
  Trophy,
} from 'lucide-react';

import type { ProfileHighlightIcon } from '@/lib/profile-view-model';

/** Ícone de cada destaque, derivado do interesse de origem. */
export const HIGHLIGHT_ICONS: Record<ProfileHighlightIcon, React.ReactNode> = {
  crown: <Crown className="size-[18px]" />,
  gamepad: <Gamepad2 className="size-[18px]" />,
  music: <Music className="size-[18px]" />,
  plane: <Plane className="size-[18px]" />,
  trophy: <Trophy className="size-[18px]" />,
  dumbbell: <Dumbbell className="size-[18px]" />,
  camera: <Camera className="size-[18px]" />,
  palette: <Palette className="size-[18px]" />,
  coffee: <Coffee className="size-[18px]" />,
  sparkles: <Sparkles className="size-[18px]" />,
};

export function HighlightIcon({ icon }: { icon: ProfileHighlightIcon }) {
  return HIGHLIGHT_ICONS[icon];
}
