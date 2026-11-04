'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { Bell, BellOff, MessageSquare, User } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';
import type { NotificationsResponse } from '@/lib/types';

interface NotificacoesViewProps {
  data: NotificationsResponse;
}

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(timestamp));
}

/**
 * Os links gravados pela API usam parâmetros da versão anterior do app
 * (/?profile=..., /?conversation=..., /?post=...). Traduzimos apenas os
 * alvos que existem nesta versão; qualquer outro link vira um item sem
 * navegação em vez de levar o usuário para uma página inexistente.
 */
function resolveNotificationHref(link: string | null | undefined): string | null {
  if (!link) return null;

  try {
    const search = new URL(link, 'http://localhost').searchParams;
    const profile = search.get('profile');
    if (profile) return `/perfil/${encodeURIComponent(profile)}`;
    if (search.has('conversation')) return '/mensagens';
    const postId = search.get('post');
    if (postId) return `/publicacoes/${postId}`;
  } catch {
    return null;
  }

  // Link direto para /publicacoes/[id] já no formato novo
  if (link.startsWith('/publicacoes/')) return link;

  return null;
}

function iconForKind(kind: string) {
  switch (kind) {
    case 'follow':
      return <User className="size-4" />;
    case 'message':
    case 'story_reply':
      return <MessageSquare className="size-4" />;
    default:
      return <Bell className="size-4" />;
  }
}

export function NotificacoesView({ data }: NotificacoesViewProps) {
  const { notifications, unread } = data;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">Notificações</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl">
            O que há de novo
          </h1>
        </div>
        {unread > 0 ? (
          <Pill tone="brand">
            {unread} não lida{unread > 1 ? 's' : ''}
          </Pill>
        ) : null}
      </header>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<BellOff className="size-5" />}
          title="Nenhuma notificação por aqui"
          description="Quando algo relevante acontecer na sua conta, você verá um aviso nesta lista."
        />
      ) : (
        <ul className="space-y-3" role="list">
          {notifications.map((notification) => {
            const href = resolveNotificationHref(notification.link);
            const icon = (
              <span
                aria-hidden="true"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft/50 text-brand"
              >
                {iconForKind(notification.kind)}
              </span>
            );
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-foreground">{notification.text}</span>
                  <time
                    dateTime={new Date(notification.createdAt).toISOString()}
                    className="mt-1 block text-xs font-medium text-subtle"
                  >
                    {relativeTime(notification.createdAt)}
                  </time>
                </span>
                {!notification.read ? (
                  <>
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand" />
                    <span className="sr-only">Não lida</span>
                  </>
                ) : null}
              </>
            );
            const baseClasses =
              'flex min-w-0 items-start gap-3 rounded-card border border-border bg-surface p-4';

            return (
              <li key={notification.id}>
                {href ? (
                  <Link
                    href={href as Route}
                    className={`${baseClasses} transition-colors hover:border-brand/30 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${!notification.read ? 'bg-brand-soft/30' : ''}`}
                  >
                    {icon}
                    {body}
                  </Link>
                ) : (
                  <div
                    className={`${baseClasses} ${!notification.read ? 'bg-brand-soft/30' : ''}`}
                  >
                    {icon}
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}