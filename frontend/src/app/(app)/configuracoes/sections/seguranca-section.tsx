'use client';

import { useCallback, useEffect, useState } from 'react';
import { Laptop, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { apiRequest } from '@/lib/api';
import type { SessionsResponse } from '@/lib/types';

import {
  INPUT_CLASS,
  SettingsCard,
  SettingsField,
  SettingsHeading,
  SettingsStatus,
  useSaveAction,
} from '../settings-ui';

function formatDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString('pt-BR');
  }
}

export function SegurancaSection() {
  const [sessions, setSessions] = useState<SessionsResponse['sessions']>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { state, start, succeed, fail } = useSaveAction();

  const fetchSessions = useCallback(async () => {
    const response = await apiRequest<SessionsResponse>('/api/sessions');
    return response.sessions;
  }, []);

  useEffect(() => {
    let active = true;
    void fetchSessions().then(
      (loaded) => {
        if (!active) return;
        setSessions(loaded);
        setLoadError(false);
        setLoading(false);
      },
      () => {
        if (!active) return;
        setLoadError(true);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [fetchSessions]);

  function handleRetry() {
    setLoading(true);
    setLoadError(false);
    void fetchSessions().then(
      (loaded) => {
        setSessions(loaded);
        setLoading(false);
      },
      () => {
        setLoadError(true);
        setLoading(false);
      },
    );
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    try {
      await apiRequest(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSessions((current) => current.filter((session) => session.id !== id));
    } catch (error) {
      fail(error, 'Não foi possível encerrar a sessão.');
    } finally {
      setRevokingId(null);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      fail(new Error('A confirmação não bate com a nova senha.'), 'Não foi possível trocar a senha.');
      return;
    }
    start();
    try {
      await apiRequest('/api/me/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      succeed('Senha alterada. As outras sessões foram encerradas.');
    } catch (error) {
      fail(error, 'Não foi possível trocar a senha.');
    }
  }

  return (
    <div>
      <SettingsHeading
        title="Segurança"
        description="Troque sua senha e gerencie os dispositivos conectados à sua conta."
      />

      <div className="space-y-4">
        <SettingsCard label="Sessões ativas">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Dispositivos conectados</h3>

          {loading ? (
            <p className="py-4 text-sm text-muted" role="status" aria-live="polite">
              Carregando sessões…
            </p>
          ) : loadError ? (
            <ErrorState
              title="Não foi possível carregar as sessões"
              description="Tente novamente em alguns instantes."
              onRetry={handleRetry}
            />
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={<Laptop className="size-5" />}
              title="Nenhuma sessão ativa"
              description="Quando você entrar em outro dispositivo, a sessão aparece aqui."
            />
          ) : (
            <ul role="list" className="divide-y divide-border">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {session.device}
                      {session.current ? (
                        <span className="ml-2 rounded-pill bg-brand-soft px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand uppercase">
                          Esta sessão
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">Conectado em {formatDate(session.createdAt)}</p>
                  </div>
                  {session.current ? null : (
                    <Button
                      variant="secondary"
                      size="sm"
                      leadingIcon={<LogOut className="size-4" />}
                      disabled={revokingId === session.id}
                      onClick={() => void handleRevoke(session.id)}
                    >
                      {revokingId === session.id ? 'Encerrando…' : 'Encerrar'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SettingsCard>

        <form onSubmit={handlePasswordSubmit}>
          <SettingsCard label="Trocar senha">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Trocar senha</h3>
            <div className="space-y-4">
              <SettingsField id="config-senha-atual" label="Senha atual">
                <input
                  id="config-senha-atual"
                  name="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className={INPUT_CLASS}
                  autoComplete="current-password"
                  required
                />
              </SettingsField>

              <SettingsField id="config-senha-nova" label="Nova senha" hint="Mínimo de 6 caracteres.">
                <input
                  id="config-senha-nova"
                  name="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className={INPUT_CLASS}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </SettingsField>

              <SettingsField id="config-senha-confirm" label="Confirmar nova senha">
                <input
                  id="config-senha-confirm"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={INPUT_CLASS}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </SettingsField>
            </div>

            <SettingsStatus state={state} />

            <Button type="submit" className="mt-4" disabled={state.status === 'saving'}>
              {state.status === 'saving' ? 'Alterando…' : 'Alterar senha'}
            </Button>
          </SettingsCard>
        </form>
      </div>
    </div>
  );
}
