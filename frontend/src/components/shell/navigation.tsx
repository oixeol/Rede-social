import type { Route } from 'next';
import { Home, Compass, MessageSquare, Bell, Users, User, Bookmark, Settings, Crown } from 'lucide-react';
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

/**
 * Navegação primária do rail lateral.
 * Mensagens e notificações ficam aqui, com contador de não lidas.
 */
export function getPrimaryNavigation(
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

  // Always visible links
  items.push(
    { id: 'favoritos', label: 'Favoritos', href: '/favoritos', icon: <Bookmark className="size-5" /> },
    { id: 'configuracoes', label: 'Configurações', href: '/configuracoes', icon: <Settings className="size-5" /> },
  );

  if (isFeatureEnabled('premium')) {
    items.push({
      id: 'vibra-premium',
      label: 'Vibra Premium',
      href: '/vibra-premium',
      icon: <Crown className="size-5" />,
    });
  }

  return items;
}

/** Navegação mobile (bottom bar). Máximo 5 itens visíveis. */
export function getMobileNavigation(
  me: { username: string; avatar: string | null; name: string },
): NavigationItem[] {
  const items: NavigationItem[] = [
    { id: 'inicio', label: 'Início', href: '/inicio', icon: <Home className="size-5" /> },
    { id: 'explorar', label: 'Explorar', href: '/explorar', icon: <Compass className="size-5" /> },
    { id: 'mensagens', label: 'Mensagens', href: '/mensagens', icon: <MessageSquare className="size-5" /> },
    {
      id: 'perfil',
      label: 'Perfil',
      href: `/perfil/${encodeURIComponent(me.username)}` as Route,
      icon: <User className="size-5" />,
    },
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
