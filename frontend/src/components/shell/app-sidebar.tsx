'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Compass,
  Crown,
  Diamond,
  Home,
  MessageSquare,
  MoreHorizontal,
  Settings,
  SquarePlus,
  User,
} from 'lucide-react';

import { VibraLogo } from '@/components/shell/vibra-logo';
import { Waves } from '@/components/ui/waves';
import { cn } from '@/lib/cn';

/**
 * Sidebar do Vibra (visual da referência).
 *
 * Ordem fixa da referência:
 * Início · Explorar · Mensagens (badge) · Notificações (badge) · Criar publicação
 * ─ divisor ─
 * Perfil · Configurações · Mais
 * ─ rodapé ─
 * Card "Vibra Premium"
 *
 * Estados visuais da referência:
 * - item ativo: pill laranja translúcida com borda laranja, texto/ícone claros;
 * - Perfil: fundo cinza-escuro e texto bold (destaque permanente);
 * - badges: círculo laranja com número.
 */

export interface AppSidebarProps {
  username: string;
  unreadMessages: number;
  unreadNotifications: number;
}

interface SidebarLink {
  id: string;
  label: string;
  href: Route;
  icon: React.ReactNode;
  badge?: number;
}

export function AppSidebar({ username, unreadMessages, unreadNotifications }: AppSidebarProps) {
  const router = useRouter();

  const mainLinks: SidebarLink[] = [
    { id: 'inicio', label: 'Início', href: '/inicio', icon: <Home className="size-5" /> },
    { id: 'explorar', label: 'Explorar', href: '/explorar', icon: <Compass className="size-5" /> },
    {
      id: 'mensagens',
      label: 'Mensagens',
      href: '/mensagens',
      icon: <MessageSquare className="size-5" />,
      badge: unreadMessages,
    },
    {
      id: 'notificacoes',
      label: 'Notificações',
      href: '/notificacoes',
      icon: <Bell className="size-5" />,
      badge: unreadNotifications,
    },
  ];

  const secondaryLinks: SidebarLink[] = [
    {
      id: 'perfil',
      label: 'Perfil',
      href: `/perfil/${encodeURIComponent(username)}` as Route,
      icon: <User className="size-5" />,
    },
    {
      id: 'configuracoes',
      label: 'Configurações',
      href: '/configuracoes',
      icon: <Settings className="size-5" />,
    },
  ];

  /*
   * Estados da referência (fixos, sem lógica de rota):
   * - "Início" carrega o pill ativo (fundo laranja translúcido, borda
   *   laranja, texto/ícone claros);
   * - "Perfil" carrega o destaque cinza-escuro com texto bold.
   */
  const activeId = 'inicio';

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[245px] flex-col border-r border-border bg-surface xl:flex"
      aria-label="Navegação principal"
    >
      <div className="flex h-[72px] shrink-0 items-center px-6">
        <Link href="/inicio" aria-label="Vibra — página inicial">
          <VibraLogo />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-4" aria-label="Menu principal">
        <ul className="space-y-1" role="list">
          {mainLinks.map((item) => (
            <li key={item.id}>
              <SidebarLinkItem item={item} active={activeId === item.id} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('vibra:open-composer'))}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
            >
              <span aria-hidden="true" className="shrink-0">
                <SquarePlus className="size-5" />
              </span>
              <span>Criar publicação</span>
            </button>
          </li>
        </ul>

        <div aria-hidden="true" className="my-4 h-px w-full bg-border" />

        <ul className="space-y-1" role="list">
          {secondaryLinks.map((item) => (
            <li key={item.id}>
              <SidebarLinkItem
                item={item}
                active={false}
                highlighted={item.id === 'perfil'}
              />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => router.push('/comunidades' as Route)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
            >
              <span aria-hidden="true" className="shrink-0">
                <MoreHorizontal className="size-5" />
              </span>
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      <div className="shrink-0 px-4 pb-5">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-raised p-4">
          <Waves className="-right-6 -bottom-4 h-[110px] w-[230px]" opacity={0.5} />

          <div className="relative flex items-center gap-2">
            <Diamond aria-hidden="true" className="size-[18px] text-[var(--vibra-premium-to)]" />
            <span className="text-sm font-bold text-foreground">Vibra Premium</span>
          </div>

          <p className="relative mt-2 max-w-[190px] text-xs leading-5 text-muted">
            Desbloqueie recursos exclusivos da plataforma.
          </p>

          <button
            type="button"
            className="relative mt-3 inline-flex w-full items-center justify-center gap-2 rounded-pill bg-[linear-gradient(135deg,var(--vibra-premium-from),var(--vibra-premium-to))] px-4 py-2.5 text-xs font-bold text-on-brand transition-[filter] hover:brightness-110"
          >
            <Crown aria-hidden="true" className="size-3.5" />
            Assinar agora
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarLinkItem({
  item,
  active,
  highlighted = false,
}: {
  item: SidebarLink;
  active: boolean;
  highlighted?: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
        active
          ? 'border border-[var(--vibra-nav-active-border)] bg-[var(--vibra-nav-active-bg)] font-semibold text-[var(--vibra-nav-active-text)]'
          : highlighted
            ? 'bg-surface-subtle font-bold text-foreground hover:bg-surface-subtle'
            : 'font-medium text-muted hover:bg-surface-subtle hover:text-foreground',
      )}
    >
      <span aria-hidden="true" className="shrink-0">
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span
          aria-hidden="true"
          className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold leading-4 text-on-brand"
        >
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      ) : null}
    </Link>
  );
}
