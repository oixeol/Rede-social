'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Compass,
  Heart,
  Home,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Settings,
  User,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { Brand } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/ui/icon-button';
import { SearchField } from '@/components/ui/search-field';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/cn';
import { apiRequest } from '@/lib/api';
import type { SearchResponse } from '@/lib/types';

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
  dataPalette: string;
}

interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const BASE_NAVIGATION: NavigationItem[] = [
  { id: 'inicio', label: 'Início', href: '/inicio', icon: <Home className="size-5" /> },
  { id: 'explorar', label: 'Explorar', href: '/explorar', icon: <Compass className="size-5" /> },
  { id: 'mensagens', label: 'Mensagens', href: '/mensagens', icon: <MessageSquare className="size-5" /> },
  { id: 'notificacoes', label: 'Notificações', href: '/notificacoes', icon: <Bell className="size-5" /> },
  { id: 'comunidades', label: 'Comunidades', href: '/comunidades', icon: <Users className="size-5" /> },
  { id: 'favoritos', label: 'Favoritos', href: '/favoritos', icon: <Heart className="size-5" /> },
  { id: 'configuracoes', label: 'Configurações', href: '/configuracoes', icon: <Settings className="size-5" /> },
];

function asRoute(href: string): Route {
  return href as Route;
}

function TopbarSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse['users']>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // early return without synchronous state updates – initial values are already empty/false
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await apiRequest<SearchResponse>(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        setResults(response.users);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  function goToProfile(username: string) {
    setOpen(false);
    setQuery('');
    router.push(asRoute(`/perfil/${encodeURIComponent(username)}`));
  }

  return (
    <div ref={containerRef} className="relative hidden w-full max-w-md lg:block">
      <SearchField
        value={query}
        onValueChange={(value) => {
          setQuery(value);
          setOpen(true);
        }}
        onSubmit={() => {
          if (results[0]) goToProfile(results[0].username);
        }}
        placeholder="Buscar no Vibra…"
        label="Buscar no Vibra"
        aria-expanded={open}
        aria-controls="busca-resultados"
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
      />

      {open && query.trim().length >= 2 ? (
        <div
          id="busca-resultados"
          role="listbox"
          aria-label="Resultados da busca"
          className="absolute top-[calc(100%+0.5rem)] left-0 z-50 w-full overflow-hidden rounded-2xl border border-border bg-surface-raised p-1.5 shadow-float"
        >
          {loading ? (
            <p className="px-3 py-4 text-center text-sm text-muted" role="status">
              Buscando…
            </p>
          ) : results.length ? (
            results.slice(0, 6).map((user) => (
              <button
                key={user.id}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => goToProfile(user.username)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-subtle"
              >
                <Avatar src={user.avatar} alt={user.name} name={user.name} size="sm" />
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-foreground">{user.name}</strong>
                  <span className="block truncate text-xs text-muted">@{user.username}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-sm text-muted">Nenhuma pessoa encontrada.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NotificationMenu({ unread }: { unread: number }) {
  const router = useRouter();
  const [items, setItems] = useState<DropdownMenuItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function loadNotifications() {
    if (loaded) return;

    try {
      const response = await apiRequest<{
        notifications: Array<{ id: number; text: string; link: string; read: boolean }>;
      }>('/api/notifications');
      setItems(
        response.notifications.slice(0, 6).map((notification) => ({
          id: String(notification.id),
          label: notification.text,
          icon: <Bell className="size-4" />,
          onSelect: () => router.push(asRoute(notification.link || '/notificacoes')),
        })),
      );
    } catch {
      setItems([
        {
          id: 'error',
          label: 'Não foi possível carregar as notificações.',
          disabled: true,
        },
      ]);
    } finally {
      setLoaded(true);
    }
  }

  const menuItems = items.length
    ? [
        ...items,
        {
          id: 'all',
          label: 'Ver todas as notificações',
          icon: <Bell className="size-4" />,
          onSelect: () => router.push(asRoute('/notificacoes')),
        },
      ]
    : [
        {
          id: 'empty',
          label: 'Nenhuma notificação por aqui.',
          disabled: true,
        },
        {
          id: 'all',
          label: 'Ver todas as notificações',
          icon: <Bell className="size-4" />,
          onSelect: () => router.push(asRoute('/notificacoes')),
        },
      ];

  return (
    <DropdownMenu
      label="Notificações"
      items={menuItems}
      trigger={
        <span className="relative inline-flex">
          <Bell aria-hidden="true" className="size-5" />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-2 -right-2 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-4 text-on-brand"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </span>
      }
      onOpen={loadNotifications}
    />
  );
}

export default function AppShell({ children, me, dataPalette }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navigation = [
    ...BASE_NAVIGATION.slice(0, 6),
    {
      id: 'perfil',
      label: 'Perfil',
      href: `/perfil/${encodeURIComponent(me.user.username)}`,
      icon: <User className="size-5" />,
    },
    BASE_NAVIGATION[6],
  ];

  const activeId = navigation.find((item) => pathname.startsWith(item.href.split('/').slice(0, 2).join('/')) )?.id;

  const userMenuItems: DropdownMenuItem[] = [
    {
      id: 'profile',
      label: 'Meu perfil',
      icon: <User className="size-4" />,
      onSelect: () => router.push(asRoute(`/perfil/${encodeURIComponent(me.user.username)}`)),
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: <Settings className="size-4" />,
      onSelect: () => router.push(asRoute('/configuracoes')),
    },
    {
      id: 'logout',
      label: 'Sair',
      description: 'Encerrar a sessão atual',
      icon: <LogOut className="size-4" />,
      destructive: true,
      onSelect: async () => {
        try {
          await apiRequest<{ ok: boolean }>('/api/logout', { method: 'POST' });
        } finally {
          router.replace(asRoute('/entrar'));
          router.refresh();
        }
      },
    },
  ];

  return (
    <div className="min-h-screen bg-background" data-palette={dataPalette}>
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col border-r border-border bg-surface md:flex xl:w-64"
        aria-label="Navegação principal"
      >
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4 xl:px-5">
          <Brand compact className="justify-center xl:justify-start" />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4 xl:px-3" aria-label="Menu principal">
          <ul className="space-y-1" role="list">
            {navigation.map((item) => {
              const isActive = activeId === item.id;
              return (
                <li key={item.id}>
                  <Link
                    href={asRoute(item.href)}
                    aria-current={isActive ? 'page' : undefined}
                    title={item.label}
                    className={cn(
                      'flex min-h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors xl:justify-start',
                      isActive
                        ? 'bg-brand-soft text-brand'
                        : 'text-muted hover:bg-surface-subtle hover:text-foreground',
                    )}
                  >
                    <span aria-hidden="true" className="shrink-0">
                      {item.icon}
                    </span>
                    <span className="hidden xl:inline">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 md:pl-20 xl:pl-64">
        <header className="fixed top-0 right-0 left-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-md md:left-20 md:px-6 xl:left-64 xl:px-8">
          <div className="min-w-0 flex-1 md:hidden">
            <Brand />
          </div>

          <TopbarSearch />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <IconButton
              label="Buscar"
              icon={<Search className="size-5" />}
              className="lg:hidden"
              onClick={() => router.push(asRoute('/explorar'))}
            />

            <ThemeToggle />

            <NotificationMenu unread={me.unreadNotifications} />

            {me.unreadMessages > 0 ? (
              <Link
                href={asRoute('/mensagens')}
                aria-label={`Mensagens${me.unreadMessages > 0 ? `, ${me.unreadMessages} não lidas` : ''}`}
                className="relative inline-flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
              >
                <MessageSquare aria-hidden="true" className="size-5" />
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-4 text-on-brand"
                >
                  {me.unreadMessages > 9 ? '9+' : me.unreadMessages}
                </span>
              </Link>
            ) : null}

            <DropdownMenu
              label={`Menu de ${me.user.name}`}
              items={userMenuItems}
              align="end"
              trigger={
                <Avatar
                  src={me.user.avatar}
                  alt={me.user.name}
                  name={me.user.name}
                  size="sm"
                  verified={me.stats.verified === 1}
                />
              }
            />

            {pathname.startsWith('/inicio') ? (
              <Button
                size="sm"
                leadingIcon={<Plus className="size-3.5" />}
                className="hidden sm:inline-flex"
                onClick={() => window.dispatchEvent(new Event('vibra:open-composer'))}
              >
                Publicar
              </Button>
            ) : null}
          </div>
        </header>

        <main id="conteudo" className="min-h-screen px-4 pt-20 pb-24 sm:px-6 md:pb-10 xl:px-8">
          {children}
        </main>
      </div>

      <nav
        className="fixed right-0 bottom-0 left-0 z-40 flex h-16 items-center justify-around border-t border-border bg-surface/95 px-1 backdrop-blur-md md:hidden"
        aria-label="Navegação inferior"
      >
        {[navigation[0], navigation[1], navigation[2], navigation[3], navigation[6]].map((item) => {
          const isActive = activeId === item.id;
          return (
            <Link
              key={item.id}
              href={asRoute(item.href)}
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
