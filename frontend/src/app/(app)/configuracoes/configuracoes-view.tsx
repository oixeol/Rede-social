'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Info,
  Lock,
  Palette,
  Shield,
  SlidersHorizontal,
  User,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import type { MeResponse, UserPreferences } from '@/lib/types';

import { AparenciaSection } from './sections/aparencia-section';
import { NotificacoesSection } from './sections/notificacoes-section';
import { PerfilSection } from './sections/perfil-section';
import { PreferenciasSection } from './sections/preferencias-section';
import { PrivacidadeSection } from './sections/privacidade-section';
import { SegurancaSection } from './sections/seguranca-section';
import { SobreSection } from './sections/sobre-section';

interface ConfiguracoesViewProps {
  me: MeResponse;
}

type SectionId =
  | 'perfil'
  | 'notificacoes'
  | 'privacidade'
  | 'seguranca'
  | 'aparencia'
  | 'preferencias'
  | 'sobre';

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: 'perfil', label: 'Perfil', icon: <User className="size-4" /> },
  { id: 'notificacoes', label: 'Notificações', icon: <Bell className="size-4" /> },
  { id: 'privacidade', label: 'Privacidade', icon: <Shield className="size-4" /> },
  { id: 'seguranca', label: 'Segurança', icon: <Lock className="size-4" /> },
  { id: 'aparencia', label: 'Aparência', icon: <Palette className="size-4" /> },
  { id: 'preferencias', label: 'Preferências', icon: <SlidersHorizontal className="size-4" /> },
  { id: 'sobre', label: 'Sobre', icon: <Info className="size-4" /> },
];

export function ConfiguracoesView({ me }: ConfiguracoesViewProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SectionId>('perfil');
  const [preferences, setPreferences] = useState<UserPreferences>(me.user.preferences ?? {});

  /** Salva um bloco de preferências e mantém o estado local em sincronia. */
  const savePreferences = useCallback(
    async (group: keyof UserPreferences, values: Record<string, boolean>) => {
      const response = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { [group]: values } }),
        credentials: 'same-origin',
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Não foi possível salvar as preferências.');
      }

      setPreferences((current) => ({
        ...current,
        [group]: { ...(current[group] ?? {}), ...values },
      }));
    },
    [],
  );

  const content = useMemo(() => {
    switch (activeSection) {
      case 'perfil':
        return <PerfilSection me={me} onSaved={() => router.refresh()} />;
      case 'notificacoes':
        return (
          <NotificacoesSection
            preferences={preferences.notifications ?? {}}
            onSave={(values) => savePreferences('notifications', values)}
          />
        );
      case 'privacidade':
        return (
          <PrivacidadeSection
            me={me}
            preferences={preferences.privacy ?? {}}
            onSave={(values) => savePreferences('privacy', values)}
            onSaved={() => router.refresh()}
          />
        );
      case 'seguranca':
        return <SegurancaSection />;
      case 'aparencia':
        return <AparenciaSection me={me} onSaved={() => router.refresh()} />;
      case 'preferencias':
        return (
          <PreferenciasSection
            preferences={preferences.content ?? {}}
            onSave={(values) => savePreferences('content', values)}
          />
        );
      case 'sobre':
        return <SobreSection />;
    }
  }, [activeSection, me, preferences, router, savePreferences]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">Configurações</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl">
          Configurações da conta
        </h1>
      </header>

      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
        {/* Navegação das seções */}
        <nav aria-label="Seções das configurações" className="md:sticky md:top-6">
          <ul
            role="list"
            className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-1 md:overflow-visible md:pb-0"
          >
            {SECTIONS.map((section) => {
              const isActive = section.id === activeSection;
              return (
                <li key={section.id} className="shrink-0 md:shrink">
                  <button
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                      isActive
                        ? 'bg-brand-soft text-brand'
                        : 'text-muted hover:bg-surface-subtle hover:text-foreground',
                    )}
                  >
                    <span aria-hidden="true" className="shrink-0">
                      {section.icon}
                    </span>
                    {section.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Painel de conteúdo */}
        <div className="min-w-0">{content}</div>
      </div>
    </div>
  );
}
