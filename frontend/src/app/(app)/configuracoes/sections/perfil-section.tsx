'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import type { MeResponse } from '@/lib/types';

import {
  INPUT_CLASS,
  SettingsCard,
  SettingsField,
  SettingsHeading,
  SettingsStatus,
  useSaveAction,
} from '../settings-ui';

const GENDER_OPTIONS = [
  { value: '', label: 'Prefiro não informar' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'outro', label: 'Outro' },
  { value: 'agenero', label: 'Agênero' },
  { value: 'generofluido', label: 'Gênero-fluido' },
];

export function PerfilSection({
  me,
  onSaved,
}: {
  me: MeResponse;
  onSaved: () => void;
}) {
  const { user } = me;
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [gender, setGender] = useState(user.gender ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [externalLink, setExternalLink] = useState(user.externalLink ?? '');
  const { state, start, succeed, fail } = useSaveAction();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start();
    try {
      await apiRequest('/api/me', {
        method: 'PATCH',
        body: {
          name: name.trim(),
          bio: bio.trim(),
          gender: gender || null,
          email: email.trim() || null,
          externalLink: externalLink.trim() || null,
        },
      });
      succeed('Perfil atualizado com sucesso.');
      onSaved();
    } catch (error) {
      fail(error, 'Não foi possível salvar o perfil.');
    }
  }

  const saving = state.status === 'saving';

  return (
    <div>
      <SettingsHeading
        title="Perfil"
        description="Como você aparece para outras pessoas no Vibra."
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <SettingsCard label="Dados do perfil">
          <div className="space-y-4">
            <SettingsField id="config-nome" label="Nome">
              <input
                id="config-nome"
                name="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={INPUT_CLASS}
                maxLength={40}
                required
              />
            </SettingsField>

            <SettingsField id="config-bio" label="Bio">
              <textarea
                id="config-bio"
                name="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={4}
                maxLength={150}
                className={`${INPUT_CLASS} resize-y`}
                placeholder="Conte um pouco sobre você"
              />
            </SettingsField>

            <SettingsField id="config-genero" label="Gênero">
              <select
                id="config-genero"
                name="gender"
                value={gender}
                onChange={(event) => setGender(event.target.value)}
                className={INPUT_CLASS}
              >
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </SettingsField>

            <SettingsField
              id="config-email"
              label="E-mail"
              hint="Usado para avisos de segurança e recuperação de conta."
            >
              <input
                id="config-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={INPUT_CLASS}
                placeholder="voce@exemplo.com"
                autoComplete="email"
              />
            </SettingsField>

            <SettingsField
              id="config-link"
              label="Link externo"
              hint="Site, portfólio ou outro perfil. Precisa começar com http:// ou https://."
            >
              <input
                id="config-link"
                name="externalLink"
                type="url"
                value={externalLink}
                onChange={(event) => setExternalLink(event.target.value)}
                className={INPUT_CLASS}
                placeholder="https://exemplo.com"
                inputMode="url"
              />
            </SettingsField>

            <p className="text-xs text-muted">@{user.username} não pode ser alterado.</p>
          </div>
        </SettingsCard>

        <SettingsStatus state={state} />

        <Button type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar perfil'}
        </Button>
      </form>
    </div>
  );
}
