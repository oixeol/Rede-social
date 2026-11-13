'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { ContentPreferences } from '@/lib/types';

import { SettingsCard, SettingsHeading, SettingsStatus, useSaveAction } from '../settings-ui';

const CONTENT_ITEMS: {
  key: keyof ContentPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: 'autoplayReels',
    label: 'Reproduzir instantes automaticamente',
    description: 'Inicia a reprodução dos instantes ao entrar no feed.',
  },
  {
    key: 'showReplies',
    label: 'Mostrar respostas de comentários',
    description: 'Exibe as respostas de comentários dentro da publicação.',
  },
  {
    key: 'sensitiveMedia',
    label: 'Ocultar mídia sensível por padrão',
    description: 'Conteúdo marcado como sensível precisa ser tocado para aparecer.',
  },
];

export function PreferenciasSection({
  preferences,
  onSave,
}: {
  preferences: ContentPreferences;
  onSave: (values: Record<string, boolean>) => Promise<void>;
}) {
  const { state, start, succeed, fail } = useSaveAction();
  const [values, setValues] = useState<Record<string, boolean>>({
    autoplayReels: preferences.autoplayReels ?? true,
    showReplies: preferences.showReplies ?? true,
    sensitiveMedia: preferences.sensitiveMedia ?? false,
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start();
    try {
      await onSave(values);
      succeed('Preferências atualizadas.');
    } catch (error) {
      fail(error, 'Não foi possível salvar as preferências.');
    }
  }

  return (
    <div>
      <SettingsHeading
        title="Preferências"
        description="Ajuste como o conteúdo aparece no seu feed e nas publicações."
      />

      <form onSubmit={handleSubmit}>
        <SettingsCard label="Preferências de conteúdo">
          <div className="divide-y divide-border">
            {CONTENT_ITEMS.map((item) => (
              <Switch
                key={item.key}
                checked={values[item.key] ?? false}
                onCheckedChange={(checked) =>
                  setValues((current) => ({ ...current, [item.key]: checked }))
                }
                label={item.label}
                description={item.description}
                disabled={state.status === 'saving'}
              />
            ))}
          </div>
        </SettingsCard>

        <SettingsStatus state={state} />

        <Button type="submit" className="mt-4" disabled={state.status === 'saving'}>
          {state.status === 'saving' ? 'Salvando…' : 'Salvar preferências'}
        </Button>
      </form>
    </div>
  );
}
