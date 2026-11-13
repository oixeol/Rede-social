'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, Bell, Menu, X, Mic, Headphones, Settings, LogOut } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { OrbitLogo } from '@/components/shell/orbit-logo';
import type { NavigationItem } from '@/components/shell/navigation';
import { getPrimaryNavigation, getMobileNavigation } from '@/components/shell/navigation';
import type { Presence } from '@/lib/types';
import { PremiumUpsellCard } from '@/components/profile/profile-side';
import { isFeatureEnabled } from '@/lib/feature-flags';

interface ShellUser {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
  presence: Presence;
  isPremium: boolean;
}

interface AppSidebarProps {
  me: {
    user: ShellUser;
    unreadNotifications: number;
    unreadMessages: number;
  };
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: () => void;
}

const PRESENCE_ICONS: Record<Presence, React.ReactNode> = {
  available: <span className="size-2 rounded-full bg-online" />,
  away: <span className="size-2 rounded-full bg-warning" />,
  dnd: <span className="size-2 rounded-full bg-danger" />,
  invisible: <span className="size-2 rounded-full bg-muted" />,
};

export function AppSidebar({
  me,
  isOpen,
  onClose,
  onNavigate,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const primaryNav = getPrimaryNavigation(me.unreadMessages, me.unreadNotifications);
  const mobileNav = getMobileNavigation({
    username: me.user.username,
    avatar: me.user.avatar,
    name: me.user.name,
  });

  const isActive = (item: NavigationItem) => {
    if (item.id === 'perfil') return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  function handleItemClick() {
    if (onNavigate) onNavigate();
    if (typeof window !== 'undefined' && window.innerWidth < 768) onClose();
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-dvh w-60 border-r border-border bg-background flex flex-col overflow-y-auto transition-transform duration-200 md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Navegação principal"
      >
        {/* Header: Logo + Close button (mobile) */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <Link
            href="/inicio"
            aria-label="Orbit — página inicial"
            className="shrink-0"
            onClick={handleItemClick}
          >
            <OrbitLogo />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden flex size-10 items-center justify-center rounded-xl text-muted hover:bg-surface-subtle hover:text-foreground"
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Navegação principal">
          {primaryNav.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isActive(item) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                isActive(item)
                  ? 'bg-brand-soft text-brand'
                  : 'text-muted hover:bg-surface-subtle hover:text-foreground',
              )}
              onClick={handleItemClick}
            >
              <span aria-hidden="true" className="size-5 shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Premium upsell card */}
        {isFeatureEnabled('premium') && !me.user.isPremium ? (
          <div className="shrink-0 px-3 pb-3">
            <PremiumUpsellCard isOwnProfile={true} compact />
          </div>
        ) : null}

        {/* Footer: User avatar + quick actions */}
        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/perfil/${encodeURIComponent(me.user.username)}`}
              onClick={() => onNavigate?.()}
              className="flex items-center justify-center size-9 rounded-lg hover:bg-surface-subtle transition-colors"
              aria-label={`Perfil de ${me.user.name}`}
            >
              <Avatar src={me.user.avatar} name={me.user.name} size="sm" alt={me.user.name} />
            </Link>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-subtle hover:text-foreground transition-colors"
              aria-label="Mutar microfone"
            >
              <Mic className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-subtle hover:text-foreground transition-colors"
              aria-label="Mutar fone"
            >
              <Headphones className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-subtle hover:text-foreground transition-colors"
              aria-label="Configurações"
            >
              <Settings className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => { if (onNavigate) onNavigate(); router.push('/entrar'); }}
              className="flex size-9 items-center justify-center rounded-lg text-danger hover:bg-surface-subtle transition-colors"
              aria-label="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}