'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/cn';

import { AppSidebar } from '@/components/shell/app-sidebar';
import { AppTopbar } from '@/components/shell/app-topbar';
import {
  getPrimaryNavigation,
  getSecondaryNavigation,
  getMobileNavigation,
} from '@/components/shell/navigation';
import type { ThemePalette } from '@/lib/types';

interface ShellUser {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
}

interface AppShellProps {
  children: React.ReactNode;
  me: {
    user: ShellUser;
    stats: { verified: 0 | 1 };
    unreadNotifications: number;
    unreadMessages: number;
  };
  dataPalette: ThemePalette;
}

export default function AppShell({ children, me, dataPalette }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  /* Configurações usa o layout de duas colunas e dispensa a navbar. */
  const hideTopbar = pathname === '/configuracoes';

  const primaryNav = getPrimaryNavigation(
    { username: me.user.username, avatar: me.user.avatar, name: me.user.name },
    me.unreadMessages,
    me.unreadNotifications,
  );
  const secondaryNav = getSecondaryNavigation({ username: me.user.username });
  const mobileNav = getMobileNavigation({
    username: me.user.username,
    avatar: me.user.avatar,
    name: me.user.name,
  });

  return (
    <div className="min-h-screen bg-background" data-palette={dataPalette}>
      {/* Sidebar fixo desktop; icon rail tablet */}
      <AppSidebar
        primaryNavigation={primaryNav}
        secondaryNavigation={secondaryNav}
        currentPath={pathname}
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
        user={me.user}
      />

      {/* Topbar responsiva */}
      {hideTopbar ? null : <AppTopbar currentPath={pathname} sidebarExpanded={sidebarExpanded} />}

      {/* Área de conteúdo */}
      <div
        className={cn(
          'min-w-0 transition-[padding] duration-200 motion-reduce:transition-none',
          sidebarExpanded ? 'md:pl-[248px]' : 'md:pl-[72px]',
        )}
      >
        <main
          id="conteudo"
          className={cn(
            'mx-auto w-full pb-24 md:pb-10',
            pathname.startsWith('/perfil/')
              ? 'max-w-[1288px] px-5 pt-4'
              : 'max-w-[1291px] px-4 pt-5 sm:px-6 xl:px-6',
          )}
        >
          {children}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav
        className={cn(
          'fixed right-0 bottom-0 left-0 z-40 flex h-16 items-center justify-around border-t border-border bg-surface/95 px-1 backdrop-blur-md md:hidden',
        )}
        aria-label="Navegação inferior"
      >
        {mobileNav.slice(0, 5).map((item) => {
          const isActive = isNavigationItemActive(item, pathname);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors',
                isActive ? 'text-brand' : 'text-muted',
              )}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span className="max-w-16 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Verifica se item de navegação corresponde à rota atual. */
function isNavigationItemActive(item: { id: string; href: Route }, pathname: string): boolean {
  if (item.id === 'perfil') {
    // Perfil só ativo quando é o próprio perfil
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}