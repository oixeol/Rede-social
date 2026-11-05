'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Palette, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { apiRequest } from '@/lib/api';
import type { MeResponse, ThemePalette } from '@/lib/types';

interface ConfiguracoesViewProps {
  me: MeResponse;
}

const PALETTE_OPTIONS: { value: ThemePalette; label: string; color: string }[] = [
  { value: 'orange', label: 'Laranja', color: '#FF6A00' },
  { value: 'black', label: 'Preto', color: '#101010' },
  { value: 'white', label: 'Branco', color: '#FFFFFF' },
];

export function ConfiguracoesView({ me }: ConfiguracoesViewProps) {
  const router = useRouter();
  const { user, canCustomizeTheme, themePalette } = me;

  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<ThemePalette>(themePalette);
  const [paletteStatus, setPaletteStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [paletteMessage, setPaletteMessage] = useState<string | null>(null);

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileStatus('saving');
    setProfileMessage(null);
    try {
      await apiRequest('/api/me', {
        method: 'PATCH',
        body: { name: name.trim(), bio: bio.trim() },
      });
      setProfileStatus('success');
      setProfileMessage('Perfil atualizado com sucesso.');
      router.refresh();
    } catch (err) {
      setProfileStatus('error');
      setProfileMessage(err instanceof Error ? err.message : 'Não foi possível salvar o perfil.');
    }
  }

  async function handlePaletteChange(palette: ThemePalette) {
    setPaletteStatus('saving');
    setPaletteMessage(null);
    try {
      await apiRequest('/api/me/theme-palette', {
        method: 'PATCH',
        body: { palette },
      });
      setSelectedPalette(palette);
      setPaletteStatus('success');
      setPaletteMessage('Paleta atualizada com sucesso.');
      router.refresh();
    } catch (err) {
      setPaletteStatus('error');
      setPaletteMessage(err instanceof Error ? err.message : 'Não foi possível alterar a paleta.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">Configurações</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl">
          Configurações da conta
        </h1>
      </header>

      {/* Perfil */}
      <section aria-labelledby="perfil-heading" className="mb-10">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="perfil-heading" className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
            <User className="size-5" aria-hidden="true" />
            Perfil
          </h2>
          {profileStatus === 'success' && profileMessage ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-success" role="status" aria-live="polite">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              {profileMessage}
            </p>
          ) : null}
        </header>

        <form onSubmit={handleProfileSubmit} className="space-y-4 rounded-card border border-border bg-surface p-4 sm:p-5">
          <div>
            <label htmlFor="nome" className="mb-1 block text-sm font-medium text-foreground">
              Nome
            </label>
            <input
              id="nome"
              name="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-brand focus:outline-none focus:shadow-[0_0_0_3px_rgb(from_var(--vibra-brand-fill)_14%,transparent)]"
              placeholder="Como você quer ser chamado"
              maxLength={40}
              required
            />
            <p className="mt-1 text-xs text-muted">@{user.username} não pode ser alterado.</p>
          </div>

          <div>
            <label htmlFor="bio" className="mb-1 block text-sm font-medium text-foreground">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              maxLength={150}
              className="w-full resize-y rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-brand focus:outline-none focus:shadow-[0_0_0_3px_rgb(from_var(--vibra-brand-fill)_14%,transparent)]"
              placeholder="Conte um pouco sobre você"
            />
            <p className="mt-1 text-right text-xs text-muted">{bio.length}/150</p>
          </div>

          {profileStatus === 'error' && profileMessage ? (
            <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft/45 px-3 py-2 text-sm text-danger">
              {profileMessage}
            </p>
          ) : null}

          <Button type="submit" disabled={profileStatus === 'saving'}>
            {profileStatus === 'saving' ? 'Salvando…' : 'Salvar perfil'}
          </Button>
        </form>
      </section>

      {/* Paleta de tema */}
      <section aria-labelledby="paleta-heading" className="mb-10">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="paleta-heading" className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
            <Palette className="size-5" aria-hidden="true" />
            Paleta de tema
          </h2>
          {paletteStatus === 'success' && paletteMessage ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-success" role="status" aria-live="polite">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              {paletteMessage}
            </p>
          ) : null}
        </header>

        {canCustomizeTheme ? (
          <fieldset
            className="space-y-4 rounded-card border border-border bg-surface p-4 sm:p-5"
            disabled={paletteStatus === 'saving'}
          >
            <legend className="text-sm leading-6 text-muted">
              Escolha a paleta de cores da interface. A alteração é aplicada imediatamente.
            </legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PALETTE_OPTIONS.map((option) => {
                const selected = selectedPalette === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                      selected
                        ? 'border-brand bg-brand-soft'
                        : 'border-border bg-surface-subtle hover:border-brand/40 hover:bg-brand-soft/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="theme-palette"
                      value={option.value}
                      checked={selected}
                      onChange={() => handlePaletteChange(option.value)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="size-9 rounded-full border border-border"
                      style={{ backgroundColor: option.color }}
                    />
                    <span className="text-xs font-semibold text-foreground">{option.label}</span>
                    {selected ? (
                      <span className="text-[10px] font-bold tracking-wide text-brand uppercase">Ativa</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
            {paletteStatus === 'error' && paletteMessage ? (
              <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft/45 px-3 py-2 text-sm text-danger">
                {paletteMessage}
              </p>
            ) : null}
          </fieldset>
        ) : (
          <EmptyState
            icon={<Palette className="size-5" />}
            title="Personalização de tema para assinantes"
            description="A troca de paleta de cores faz parte do plano de assinatura. Enquanto sua assinatura não estiver ativa, a interface usa a paleta padrão."
          />
        )}
      </section>
    </div>
  );
}