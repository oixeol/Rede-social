'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Menu } from 'lucide-react';

import { AppSidebar } from '@/components/shell/app-sidebar';
import { getMobileNavigation, getPrimaryNavigation } from '@/components/shell/navigation';
import type { Presence, ThemePalette } from '@/lib/types';

interface ShellUser {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
  presence: Presence;
  isPremium: boolean;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const primaryNav = getPrimaryNavigation(me.unreadMessages, me.unreadNotifications);
  const mobileNav = getMobileNavigation({
    username: me.user.username,
    avatar: me.user.avatar,
    name: me.user.name,
  });

  const isMessagesRoute = pathname === '/mensagens';

  return (
    <div className="min-h-screen bg-background" data-palette={dataPalette}>
      {/* Sidebar: vertical navigation on the left */}
      <AppSidebar
        me={{
          user: { ...me.user, isPremium: me.user.isPremium },
          unreadNotifications: me.unreadNotifications,
          unreadMessages: me.unreadMessages,
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={() => setSidebarOpen(false)}
      />

      {/* Content area */}
      <main
        id="conteudo"
        className={cn(
          isMessagesRoute
            ? 'h-dvh w-full overflow-hidden pb-16 md:pb-0 bg-surface md:pl-60'
            : 'mx-auto w-full pb-24 md:pb-10 md:pl-60',
          !isMessagesRoute &&
            (pathname.startsWith('/perfil/')
              ? 'max-w-[1288px] px-5'
              : 'max-w-[1291px] px-4 sm:px-6 xl:px-6'),
        )}
      >
        {children}
      </main>

      {/* Mobile menu toggle button (fixed bottom right on mobile) */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed right-4 bottom-4 z-40 md:hidden flex size-12 items-center justify-center rounded-2xl border border-border bg-surface shadow-lg"
        aria-label="Abrir menu"
        aria-expanded={sidebarOpen}
      >
        <Menu className="size-6 text-foreground" />
      </button>
    </div>
  );
}