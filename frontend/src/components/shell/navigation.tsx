import type { Route } from 'next';
import {
  Home,
  Compass,
  MessageSquare,
  Bell,
  Users,
  User,
  Settings,
  Search,
  Sun,
  MoonStar,
} from 'lucide-react';
import { isFeatureEnabled, type FeatureName } from '@/lib/feature-flags';

export interface NavigationItem {
  id: string;
  label: string;
  href: Route;
  icon: React.ReactNode;
  /** Feature flag name; when false, item is hidden. */
  feature?: FeatureName;
  /** Badge count prop resolved at render time. */
  badge?: number;
}

/** Navegação primária (sempre visível no desktop / icon rail no tablet). */
export function getPrimaryNavigation(
  me: { username: string; avatar: string | null; name: string },
  unreadMessages: number,
  unreadNotifications: number,
): NavigationItem[] {
  const items: NavigationItem[] = [
    { id: 'inicio', label: 'Início', href: '/inicio', icon: <Home className="size-5" /> },
    { id: 'explorar', label: 'Explorar', href: '/explorar', icon: <Compass className="size-5" /> },
    {
      id: 'mensagens',
      label: 'Mensagens',
      href: '/mensagens',
      icon: <MessageSquare className="size-5" />,
      badge: unreadMessages,
    },
  ];

  if (isFeatureEnabled('notifications')) {
    items.push({
      id: 'notificacoes',
      label: 'Notificações',
      href: '/notificacoes',
      icon: <Bell className="size-5" />,
      badge: unreadNotifications,
    });
  }

  if (isFeatureEnabled('communities')) {
    items.push({
      id: 'comunidades',
      label: 'Comunidades',
      href: '/comunidades',
      icon: <Users className="size-5" />,
    });
  }

  return items;
}

/** Navegação secundária (perfil, configurações, etc.). */
export function getSecondaryNavigation(
  me: { username: string },
): NavigationItem[] {
  return [
    {
      id: 'perfil',
      label: 'Perfil',
      href: `/perfil/${encodeURIComponent(me.username)}` as Route,
      icon: <User className="size-5" />,
    },
    { id: 'configuracoes', label: 'Configurações', href: '/configuracoes', icon: <Settings className="size-5" /> },
  ];
}

/** Navegação mobile (bottom bar). Máximo 5 itens visíveis. */
export function getMobileNavigation(
  me: { username: string; avatar: string | null; name: string },
): NavigationItem[] {
  const items: NavigationItem[] = [
    { id: 'inicio', label: 'Início', href: '/inicio', icon: <Home className="size-5" /> },
    { id: 'explorar', label: 'Explorar', href: '/explorar', icon: <Compass className="size-5" /> },
    { id: 'mensagens', label: 'Mensagens', href: '/mensagens', icon: <MessageSquare className="size-5" /> },
    { id: 'perfil', label: 'Perfil', href: `/perfil/${encodeURIComponent(me.username)}` as Route, icon: <User className="size-5" /> },
  ];

  if (isFeatureEnabled('communities')) {
    items.push({
      id: 'comunidades',
      label: 'Comunidades',
      href: '/comunidades',
      icon: <Users className="size-5" />,
    });
  }

  return items;
}

/** Ícones de ações no topbar (busca, tema, notificações, avatar). */
export const topbarActionIcons = {
  search: <Search className="size-5" />,
  sun: <Sun className="size-5" />,
  moon: <MoonStar className="size-5" />,
} as const;