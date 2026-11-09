'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { apiRequest } from '@/lib/api';
import type { MeResponse, MessagePolicy, PrivacyPreferences } from '@/lib/types';

import {
  INPUT_CLASS,
  SettingsCard,
  SettingsHeading,
  SettingsRow,
  SettingsStatus,
  useSaveAction,
} from '../settings-ui';

const MESSAGE_POLICIES: { value: MessagePolicy; label: string; description: string }[] = [
  { value: 'everyone', label: 'Todo mundo', description: 'Qualquer pessoa pode enviar mensagem.' },
  { value: 'connections', label: 'Conexões', description: 'Só quem você aceitou pode enviar mensagem.' },
  { value: 'nobody', label: 'Ninguém', description: 'Você não recebe mensagens de outras pessoas.' },
];

export function PrivacidadeSection({
  me,
  preferences,
  onSave,
  onSaved,
}: {
  me: MeResponse;
  preferences: PrivacyPreferences;
  onSave: (values: Record<string, boolean>) => Promise<void>;
  onSaved: () => void;
}) {
  const { state, start, succeed, fail } = useSaveAction();
  const [isPrivate, setIsPrivate] = useState(me.user.isPrivate);
  const [messagePolicy, setMessagePolicy] = useState<MessagePolicy>(me.user.messagePolicy);
  const [values, setValues] = useState<Record<string, boolean>>({
    showActivityStatus: preferences.showActivityStatus ?? true,
    discoverableBySearch: preferences.discoverableBySearch ?? true,
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start();
    try {
      await apiRequest('/api/me', {
        method: 'PATCH',
        body: { isPrivate, messagePolicy },
      });
      await onSave(values);
      succeed('Preferências de privacidade atualizadas.');
      onSaved();
    } catch (error) {
      fail(error, 'Não foi possível salvar as preferências.');
    }
  }

  return (
    <div>
      <SettingsHeading
        title="Privacidade"
        description="Controle quem vê seu perfil e como você recebe mensagens."
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <SettingsCard label="Perfil e mensagens">
          <SettingsRow
            title="Perfil privado"
            description="Só quem você aprova consegue ver suas publicações e destaques."
            control={
              <Switch
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
                label="Perfil privado"
                hideLabel
                disabled={state.status === 'saving'}
              />
            }
          />

          <div className="border-b border-border py-3 last:border-b-0">
            <label htmlFor="config-politica" className="mb-2 block text-sm font-medium text-foreground">
              Quem pode enviar mensagens
            </label>
            <select
              id="config-politica"
              name="messagePolicy"
              value={messagePolicy}
              onChange={(event) => setMessagePolicy(event.target.value as MessagePolicy)}
              className={INPUT_CLASS}
              disabled={state.status === 'saving'}
            >
              {MESSAGE_POLICIES.map((policy) => (
                <option key={policy.value} value={policy.value}>
                  {policy.label} — {policy.description}
                </option>
              ))}
            </select>
          </div>

          <Switch
            checked={values.showActivityStatus ?? true}
            onCheckedChange={(checked) =>
              setValues((current) => ({ ...current, showActivityStatus: checked }))
            }
            label="Mostrar status de atividade"
            description="Permite que outras pessoas vejam quando você acessou o Vibra."
            disabled={state.status === 'saving'}
          />

          <Switch
            checked={values.discoverableBySearch ?? true}
            onCheckedChange={(checked) =>
              setValues((current) => ({ ...current, discoverableBySearch: checked }))
            }
            label="Aparecer nas buscas"
            description="Permite que seu perfil seja encontrado pela busca de pessoas."
            disabled={state.status === 'saving'}
          />
        </SettingsCard>

        <SettingsStatus state={state} />

        <Button type="submit" disabled={state.status === 'saving'}>
          {state.status === 'saving' ? 'Salvando…' : 'Salvar privacidade'}
        </Button>
      </form>
    </div>
  );
}
