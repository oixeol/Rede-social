'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Heart, Home, MessageSquare, Settings, User, Users } from 'lucide-react';

import { AppSidebar } from '@/components/shell/app-sidebar';
import { AppTopbar } from '@/components/shell/app-topbar';
import { cn } from '@/lib/cn';
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

  const profileHref = `/perfil/${encodeURIComponent(me.user.username)}` as Route;

  const mobileNavigation = [
    { id: 'inicio', label: 'Início', href: '/inicio' as Route, icon: <Home className="size-5" /> },
    { id: 'explorar', label: 'Explorar', href: '/explorar' as Route, icon: <Compass className="size-5" /> },
    { id: 'mensagens', label: 'Mensagens', href: '/mensagens' as Route, icon: <MessageSquare className="size-5" /> },
    { id: 'comunidades', label: 'Comunidades', href: '/comunidades' as Route, icon: <Users className="size-5" /> },
    { id: 'favoritos', label: 'Favoritos', href: '/favoritos' as Route, icon: <Heart className="size-5" /> },
    { id: 'perfil', label: 'Perfil', href: profileHref, icon: <User className="size-5" /> },
    { id: 'configuracoes', label: 'Configurações', href: '/configuracoes' as Route, icon: <Settings className="size-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background" data-palette={dataPalette}>
      <AppSidebar
        username={me.user.username}
        unreadMessages={me.unreadMessages}
        unreadNotifications={me.unreadNotifications}
      />

      <div className="min-w-0 xl:pl-[245px]">
        <AppTopbar me={me} />

        <main
          id="conteudo"
          className="mx-auto w-full max-w-[1291px] px-4 pt-5 pb-24 sm:px-6 md:pb-10 xl:px-6"
        >
          {children}
        </main>
      </div>

      <nav
        className="fixed right-0 bottom-0 left-0 z-40 flex h-16 items-center justify-around border-t border-border bg-surface/95 px-1 backdrop-blur-md md:hidden"
        aria-label="Navegação inferior"
      >
        {mobileNavigation.slice(0, 5).map((item) => {
          const isActive = pathname.startsWith(item.href.split('/').slice(0, 2).join('/'));
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
