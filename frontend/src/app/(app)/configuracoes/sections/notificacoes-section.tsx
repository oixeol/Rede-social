'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { NotificationPreferences } from '@/lib/types';

import { SettingsCard, SettingsHeading, SettingsStatus, useSaveAction } from '../settings-ui';

const NOTIFICATION_ITEMS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: 'likes',
    label: 'Curtidas',
    description: 'Avisar quando alguém curtir uma publicação sua.',
  },
  {
    key: 'comments',
    label: 'Comentários',
    description: 'Avisar quando alguém comentar em uma publicação sua.',
  },
  {
    key: 'follows',
    label: 'Novos seguidores',
    description: 'Avisar quando alguém começar a seguir você.',
  },
  {
    key: 'mentions',
    label: 'Menções',
    description: 'Avisar quando alguém mencionar você em um post ou história.',
  },
  {
    key: 'messages',
    label: 'Mensagens',
    description: 'Avisar quando você receber uma nova mensagem.',
  },
];

export function NotificacoesSection({
  preferences,
  onSave,
}: {
  preferences: NotificationPreferences;
  onSave: (values: Record<string, boolean>) => Promise<void>;
}) {
  const { state, start, succeed, fail } = useSaveAction();
  const [values, setValues] = useState<Record<string, boolean>>({
    likes: preferences.likes ?? true,
    comments: preferences.comments ?? true,
    follows: preferences.follows ?? true,
    mentions: preferences.mentions ?? true,
    messages: preferences.messages ?? true,
  });

  function toggle(key: string, checked: boolean) {
    setValues((current) => ({ ...current, [key]: checked }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start();
    try {
      await onSave(values);
      succeed('Preferências de notificação atualizadas.');
    } catch (error) {
      fail(error, 'Não foi possível salvar as preferências.');
    }
  }

  return (
    <div>
      <SettingsHeading
        title="Notificações"
        description="Escolha quais eventos geram aviso dentro do Vibra."
      />

      <form onSubmit={handleSubmit}>
        <SettingsCard label="Preferências de notificação">
          <div className="divide-y divide-border">
            {NOTIFICATION_ITEMS.map((item) => (
              <Switch
                key={item.key}
                checked={values[item.key] ?? true}
                onCheckedChange={(checked) => toggle(item.key, checked)}
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
