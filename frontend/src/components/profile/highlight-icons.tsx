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

import type { ProfileHighlightIcon } from '@/lib/types';

/** Rótulo acessível de cada ícone disponível para destaques. */
export const HIGHLIGHT_ICON_LABELS: Record<ProfileHighlightIcon, string> = {
  crown: 'Coroa',
  gamepad: 'Controle',
  music: 'Música',
  plane: 'Avião',
  trophy: 'Troféu',
  dumbbell: 'Haltere',
  camera: 'Câmera',
  palette: 'Paleta',
  coffee: 'X Café',
  sparkles: 'Brilhos',
};

/** Ícone de cada destaque, escolhido pelo usuário. */
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

/** Ordem estável do seletor de ícones. */
export const HIGHLIGHT_ICON_OPTIONS = Object.keys(HIGHLIGHT_ICONS) as ProfileHighlightIcon[];

export function HighlightIcon({ icon }: { icon: ProfileHighlightIcon }) {
  return HIGHLIGHT_ICONS[icon] ?? HIGHLIGHT_ICONS.sparkles;
}
