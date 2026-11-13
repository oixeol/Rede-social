'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Crown,
  Ghost,
  LogOut,
  MessageSquare,
  Moon,
  Circle,
  Settings,
  User,
  Users,
  BellOff,
} from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import { isFeatureEnabled } from '@/lib/feature-flags';
import {
  PRESENCE_COLOR,
  PRESENCE_DESCRIPTION,
  PRESENCE_LABEL,
  PRESENCE_ORDER,
} from '@/lib/presence';
import type { Presence } from '@/lib/types';

interface UserMenuProps {
  name: string;
  username: string;
  avatar: string | null;
  presence: Presence;
  onLogout?: () => void;
}

const PRESENCE_ICON: Record<Presence, React.ReactNode> = {
  available: <Circle className="size-4 text-[var(--orbit-online)]" aria-hidden="true" />,
  away: <Moon className="size-4 text-[var(--orbit-warning)]" aria-hidden="true" />,
  dnd: <BellOff className="size-4 text-[var(--orbit-danger)]" aria-hidden="true" />,
  invisible: <Ghost className="size-4 text-[var(--orbit-muted)]" aria-hidden="true" />,
};

/**
 * Avatar do próprio usuário (canto inferior esquerdo do rail).
 * Ao clicar abre um painel com a foto centralizada e as opções de conta,
 * incluindo a troca rápida de status de presença.
 */
export function UserMenu({
  name,
  username,
  avatar,
  presence: initialPresence,
  onLogout,
}: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [presence, setPresence] = useState<Presence>(initialPresence);
  const [pending, setPending] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setStatusOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      setStatusOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  async function handlePresenceChange(next: Presence) {
    if (next === presence || pending) return;
    setPending(true);
    try {
      await apiRequest('/api/me', { method: 'PATCH', body: { presence: next } });
      setPresence(next);
    } catch {
      /* Mantém o estado anterior: reflete a última presença persistida. */
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest('/api/logout', { method: 'POST' });
    } catch {
      // Sessão encerrada ou indisponível: redirecionamento continua.
    }
    setOpen(false);
    if (onLogout) {
      onLogout();
      return;
    }
    router.push('/entrar' as Route);
  }

  function navigate(href: Route) {
    setOpen(false);
    setStatusOpen(false);
    router.push(href);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Opções da conta"
        className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-surface-subtle"
      >
        <span className="relative">
          <Avatar src={avatar} alt={name} name={name} size="md" />
          <span
            aria-hidden="true"
            className={cn(
              'absolute -right-0.5 -bottom-0.5 block size-[13px] rounded-full border-2 border-[var(--orbit-background)]',
              PRESENCE_COLOR[presence],
              pending && 'opacity-60',
            )}
          />
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Opções da conta"
          className="absolute bottom-[calc(100%+0.75rem)] left-0 z-50 w-[280px] overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-float"
        >
          {/* Foto centralizada, sem banner de fundo. */}
          <div className="flex flex-col items-center gap-2 px-4 py-5">
            <span className="relative">
              <Avatar src={avatar} alt={name} name={name} size="xl" />
              <span
                aria-hidden="true"
                className={cn(
                  'absolute -right-1 -bottom-1 block size-5 rounded-full border-[3px] border-[var(--orbit-surface-raised)]',
                  PRESENCE_COLOR[presence],
                  pending && 'opacity-60',
                )}
              />
            </span>
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <p className="truncate text-xs text-muted">@{username}</p>
          </div>

          <div className="border-t border-border p-1.5">
            <MenuButton
              icon={<User className="size-4" />}
              label="Meu perfil"
              onClick={() => navigate(`/perfil/${encodeURIComponent(username)}` as Route)}
            />
            <MenuButton
              icon={<Settings className="size-4" />}
              label="Configurações"
              onClick={() => navigate('/configuracoes' as Route)}
            />
            <MenuButton
              icon={<Users className="size-4" />}
              label="Comunidades"
              onClick={() => navigate('/comunidades' as Route)}
            />
            {isFeatureEnabled('premium') ? (
              <MenuButton
                icon={<Crown className="size-4" />}
                label="Orbit Premium"
                onClick={() => navigate('/orbit-premium' as Route)}
              />
            ) : null}

            <div className="mt-1 border-t border-border pt-1">
              <MenuButton
                icon={PRESENCE_ICON[presence]}
                label={PRESENCE_LABEL[presence]}
                hint={statusOpen ? 'Fechar' : 'Mudar'}
                expanded={statusOpen}
                onClick={() => setStatusOpen((value) => !value)}
              />

              {statusOpen ? (
                <div className="mb-1 ml-7 space-y-0.5" role="group" aria-label="Status de presença">
                  {PRESENCE_ORDER.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={value === presence}
                      disabled={pending}
                      onClick={() => void handlePresenceChange(value)}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                        value === presence
                          ? 'bg-surface-subtle text-foreground'
                          : 'text-muted hover:bg-surface-subtle hover:text-foreground',
                      )}
                    >
                      <span aria-hidden="true" className="mt-0.5 shrink-0">
                        {PRESENCE_ICON[value]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold">{PRESENCE_LABEL[value]}</span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-muted">
                          {PRESENCE_DESCRIPTION[value]}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-1 border-t border-border pt-1">
              <MenuButton
                icon={<LogOut className="size-4" />}
                label="Sair"
                destructive
                onClick={() => void handleLogout()}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({
  icon,
  label,
  hint,
  expanded,
  destructive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  expanded?: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-expanded={expanded}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
        destructive
          ? 'text-danger hover:bg-danger-soft'
          : 'text-foreground hover:bg-surface-subtle',
      )}
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {hint ? (
        <span aria-hidden="true" className="shrink-0 text-[11px] text-muted">
          {hint}
        </span>
      ) : null}
    </button>
  );
}

interface TopbarActionsProps {
  unreadNotifications: number;
  unreadMessages: number;
}

/** Ações do topo: mensagens e notificações no canto superior direito. */
export function TopbarActions({ unreadNotifications, unreadMessages }: TopbarActionsProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1">
      <IconAction
        href="/mensagens"
        label="Mensagens"
        badge={unreadMessages}
        icon={<MessageSquare className="size-5" />}
        onClick={() => router.push('/mensagens' as Route)}
      />
      <IconAction
        href="/notificacoes"
        label="Notificações"
        badge={unreadNotifications}
        icon={<Bell className="size-5" />}
        onClick={() => router.push('/notificacoes' as Route)}
      />
    </div>
  );
}

function IconAction({
  href,
  label,
  badge,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  badge: number;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={badge > 0 ? `${label} (${badge})` : label}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
    >
      <span aria-hidden="true">{icon}</span>
      {badge > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 py-0.5 text-[10px] font-bold leading-4 text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  );
}
