'use client';

import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';

import { apiRequest } from '@/lib/api';

import { SettingsCard, SettingsHeading } from '../settings-ui';

interface AppConfigResponse {
  app: {
    name: string;
    slug: string;
    tagline: string;
    version: string;
  };
}

export function SobreSection() {
  const [config, setConfig] = useState<AppConfigResponse['app'] | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<AppConfigResponse>('/api/config')
      .then((response) => {
        if (active) setConfig(response.app);
      })
      .catch(() => {
        if (active) setConfig(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <SettingsHeading title="Sobre" description="Informações sobre o Orbit e sua conta." />

      <div className="space-y-4">
        <SettingsCard label="Sobre o Orbit">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"
            >
              <Info className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{config?.name ?? 'Vibra'}</p>
              <p className="mt-0.5 text-sm leading-6 text-muted">
                {config?.tagline ?? 'Conexões que fazem sentido.'}
              </p>
              <p className="mt-2 text-xs text-muted">Versão {config?.version ?? '—'}</p>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard label="Termos e privacidade">
          <ul role="list" className="space-y-2 text-sm leading-6 text-muted">
            <li>Seu conteúdo permanece sob seu controle: perfil privado está disponível na aba Privacidade.</li>
            <li>Você pode encerrar sessões e trocar a senha a qualquer momento na aba Segurança.</li>
            <li>Preferências salvas valem para este dispositivo e para sua conta no Orbit.</li>
          </ul>
        </SettingsCard>
      </div>
    </div>
  );
}
