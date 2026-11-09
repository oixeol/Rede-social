'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Diamond, LogOut } from 'lucide-react';

import { VibraLogo } from '@/components/shell/vibra-logo';
import { Waves } from '@/components/ui/waves';
import type { NavigationItem } from '@/components/shell/navigation';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { Avatar } from '@/components/ui/avatar';
import { isSafeMediaSource } from '@/lib/media';

interface SidebarUser {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
}

interface AppSidebarProps {
  primaryNavigation: NavigationItem[];
  secondaryNavigation: NavigationItem[];
  currentPath: string;
  /** Sidebar expandida: empurra o conteúdo em vez de sobrepor. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  user: SidebarUser;
}

/**
 * Barra lateral em formato rail: ícones centralizados em 72px que expandem
 * para 248px ao passar o mouse ou ganhar foco por teclado.
 */
export function AppSidebar({
  primaryNavigation,
  secondaryNavigation,
  currentPath,
  expanded,
  onExpandedChange,
  user,
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

  function handleFocusCapture(event: React.FocusEvent<HTMLElement>) {
    onExpandedChange(true);
    void event;
  }

  function handleBlurCapture(event: React.FocusEvent<HTMLElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    onExpandedChange(false);
  }

  return (
    <aside
      className={cn(
        'group fixed inset-y-0 left-0 z-40 hidden overflow-hidden bg-background shadow-float transition-[width] duration-200 motion-reduce:transition-none md:block',
        expanded ? 'w-[248px]' : 'w-[72px]',
      )}
      aria-label="Navegação principal"
      onPointerEnter={() => onExpandedChange(true)}
      onPointerLeave={() => onExpandedChange(false)}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
    >
      <div className="flex h-full w-[248px] flex-col overflow-y-auto overflow-x-hidden">
        <div
          className={cn(
            'flex h-[72px] shrink-0 items-center',
            expanded ? 'px-3' : 'w-[72px] justify-center',
          )}
        >
          <Link
            href="/inicio"
            aria-label="Vibra — página inicial"
            className="flex min-h-11 items-center"
          >
            <VibraLogo compact />
          </Link>
          <span
            className={cn(
              'ml-1 max-w-0 overflow-hidden whitespace-nowrap text-[22px] font-bold tracking-[-0.02em] text-foreground opacity-0 transition-all duration-200',
              expanded && 'ml-2 max-w-[140px] opacity-100',
            )}
          >
            Vibra.
          </span>
        </div>

        <nav
          className={cn(
            'flex flex-1 flex-col justify-center',
            expanded ? 'px-2 pb-5' : 'px-0 pb-[68px]',
          )}
          aria-label="Menu principal"
        >
          <ul className="space-y-1" role="list">
            {primaryNavigation.map((item) => (
              <li key={item.id}>
                <SidebarLinkItem
                  item={item}
                  active={isNavigationItemActive(item, currentPath)}
                  expanded={expanded}
                />
              </li>
            ))}
          </ul>

          <ul className="space-y-1" role="list">
            {secondaryNavigation.map((item) => (
              <li key={item.id}>
                <SidebarLinkItem
                  item={item}
                  active={isNavigationItemActive(item, currentPath)}
                  expanded={expanded}
                  user={user}
                />
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => void handleLogout()}
                aria-label="Sair"
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-xl text-left text-sm font-medium text-muted transition-colors hover:bg-surface-subtle hover:text-foreground',
                  expanded ? 'w-full px-3' : 'w-[72px] justify-center px-0',
                )}
              >
                <span aria-hidden="true" className="shrink-0 text-white">
                  <LogOut className="size-5" />
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'whitespace-nowrap transition-all duration-200',
                    expanded ? 'max-w-[160px] opacity-100' : 'hidden',
                  )}
                >
                  Sair
                </span>
              </button>
            </li>
          </ul>
        </nav>

        {isFeatureEnabled('premium') ? (
          <div
            className={cn(
              'max-h-0 shrink-0 overflow-hidden px-3 opacity-0 transition-all duration-200',
              expanded && 'max-h-[220px] pb-5 opacity-100',
            )}
          >
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
  expanded,
  user,
}: {
  item: NavigationItem;
  active: boolean;
  expanded: boolean;
  user?: SidebarUser;
}) {
  const isPerfil = item.id === 'perfil';
  const showAvatar = isPerfil && user?.avatar && isSafeMediaSource(user.avatar);

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={cn(
        'group/item relative flex min-h-11 items-center rounded-xl text-left text-sm transition-colors',
        expanded ? 'w-full gap-3 px-3' : 'w-[72px] justify-center gap-0 px-0',
        active
          ? 'font-semibold text-foreground'
          : 'font-medium text-muted hover:bg-surface-subtle hover:text-foreground',
      )}
    >
      <span aria-hidden="true" className="relative shrink-0 text-white">
        {showAvatar ? (
          <Avatar
            src={user!.avatar}
            alt={user!.name}
            name={user!.name}
            size="sm"
            className="rounded-full"
          />
        ) : (
          item.icon
        )}
        {item.badge ? (
          <span
            className={cn(
              'absolute -top-1 -right-1 size-2 rounded-full bg-danger',
              expanded && 'hidden',
            )}
          />
        ) : null}
      </span>

      <span
        className={cn(
          'max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200',
          expanded && 'max-w-[160px] opacity-100',
        )}
      >
        {item.label}
      </span>

      {item.badge ? (
        <span
          aria-hidden="true"
          className={cn(
            'hidden min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-4 text-white',
            expanded && 'inline-flex',
          )}
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
