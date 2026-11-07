'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Diamond, LogOut } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { VibraLogo } from '@/components/shell/vibra-logo';
import { Waves } from '@/components/ui/waves';
import type { NavigationItem } from '@/components/shell/navigation';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import { isFeatureEnabled } from '@/lib/feature-flags';

interface SidebarUser {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
}

interface AppSidebarProps {
  primaryNavigation: NavigationItem[];
  secondaryNavigation: NavigationItem[];
  user: SidebarUser;
  currentPath: string;
}

export function AppSidebar({
  primaryNavigation,
  secondaryNavigation,
  user,
  currentPath,
}: AppSidebarProps) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await apiRequest('/api/logout', { method: 'POST' });
    } catch {
      // Sessão já encerrada ou indisponível. Redirecionamento continua.
    }
    router.push('/entrar' as Route);
  }

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[72px] border-r border-border bg-surface md:block xl:w-[248px]"
      aria-label="Navegação principal"
    >
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex h-[72px] shrink-0 items-center px-3 xl:px-4">
          <Link
            href="/inicio"
            aria-label="Vibra — página inicial"
            className="flex min-h-11 items-center xl:px-1"
          >
            <VibraLogo compact className="xl:hidden" />
            <VibraLogo className="hidden xl:inline-flex" />
          </Link>
        </div>

        <nav className="flex-1 px-2 pb-5 xl:px-4" aria-label="Menu principal">
          <ul className="space-y-1" role="list">
            {primaryNavigation.map((item) => (
              <li key={item.id}>
                <SidebarLinkItem
                  item={item}
                  active={isNavigationItemActive(item, currentPath)}
                />
              </li>
            ))}
          </ul>

          <div aria-hidden="true" className="my-4 h-px w-full bg-border" />

          <ul className="space-y-1" role="list">
            {secondaryNavigation.map((item) => (
              <li key={item.id}>
                <SidebarLinkItem
                  item={item}
                  active={isNavigationItemActive(item, currentPath)}
                  user={user}
                />
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-muted transition-colors hover:bg-surface-subtle hover:text-foreground',
                  'justify-center xl:justify-start',
                )}
              >
                <span aria-hidden="true" className="shrink-0">
                  <LogOut className="size-5" />
                </span>
                <span className="hidden min-w-0 flex-1 truncate xl:inline">Sair</span>
                <span className="sr-only xl:hidden">Sair</span>
              </button>
            </li>
          </ul>
        </nav>

        {isFeatureEnabled('premium') ? (
          <div className="hidden shrink-0 px-3 pb-5 xl:block">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-raised p-4">
              <Waves className="-right-6 -bottom-4 h-[110px] w-[230px]" opacity={0.5} />

              <div className="relative flex items-center gap-2">
                <Diamond aria-hidden="true" className="size-[18px] text-[var(--vibra-premium-to)]" />
                <span className="text-sm font-bold text-foreground">Vibra Premium</span>
              </div>

              <p className="relative mt-2 max-w-[190px] text-xs leading-5 text-muted">
                Recursos exclusivos em breve.
              </p>

              <button
                type="button"
                disabled
                className="relative mt-3 inline-flex min-h-10 w-full cursor-not-allowed items-center justify-center rounded-pill border border-border bg-surface-subtle px-4 text-xs font-bold text-muted"
              >
                Em breve
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function SidebarLinkItem({
  item,
  active,
  user,
}: {
  item: NavigationItem;
  active: boolean;
  user?: SidebarUser;
}) {
  const isProfile = item.id === 'perfil';

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={cn(
        'group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors',
        'justify-center xl:justify-start',
        active
          ? 'border border-[var(--vibra-nav-active-border)] bg-[var(--vibra-nav-active-bg)] font-semibold text-[var(--vibra-nav-active-text)]'
          : 'font-medium text-muted hover:bg-surface-subtle hover:text-foreground',
      )}
    >
      {isProfile && user ? (
        <Avatar
          src={user.avatar}
          alt={`Foto de perfil de ${user.name}`}
          name={user.name}
          size="sm"
          className="shrink-0"
          eager
        />
      ) : (
        <span aria-hidden="true" className="relative shrink-0">
          {item.icon}
          {item.badge ? (
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-danger xl:hidden" />
          ) : null}
        </span>
      )}

      <span className="hidden min-w-0 flex-1 truncate xl:inline">{item.label}</span>

      {item.badge ? (
        <span
          aria-hidden="true"
          className="hidden min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold leading-4 text-on-brand xl:inline-flex"
        >
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
  if (item.id === 'perfil') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
