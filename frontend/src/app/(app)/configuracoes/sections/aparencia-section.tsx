'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palette } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { MeResponse, ThemePalette } from '@/lib/types';

import { SettingsCard, SettingsHeading, SettingsStatus, useSaveAction } from '../settings-ui';

const PALETTE_OPTIONS: { value: ThemePalette; label: string; color: string }[] = [
  { value: 'orange', label: 'Laranja', color: '#FF6A00' },
  { value: 'black', label: 'Preto', color: '#0D0D0D' },
  { value: 'white', label: 'Branco', color: '#FFFFFF' },
];

export function AparenciaSection({ me, onSaved }: { me: MeResponse; onSaved: () => void }) {
  const router = useRouter();
  const { canCustomizeTheme, themePalette } = me;
  const { state, start, succeed, fail } = useSaveAction();
  const [selectedPalette, setSelectedPalette] = useState<ThemePalette>(themePalette);

  async function handlePaletteChange(palette: ThemePalette) {
    start();
    try {
      await apiRequest('/api/me/theme-palette', {
        method: 'PATCH',
        body: { palette },
      });
      setSelectedPalette(palette);
      succeed('Paleta atualizada com sucesso.');
      onSaved();
      router.refresh();
    } catch (error) {
      fail(error, 'Não foi possível alterar a paleta.');
    }
  }

  return (
    <div>
      <SettingsHeading
        title="Aparência"
        description="Ajuste o tema e as cores da interface do Vibra."
      />

      <div className="space-y-4">
        <SettingsCard label="Tema do sistema">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Modo claro ou escuro</p>
              <p className="mt-0.5 text-xs leading-5 text-muted">
                Alterna entre a interface clara e escura, independente da paleta escolhida.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </SettingsCard>

        <SettingsCard label="Paleta de cores">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Paleta de cores</h3>
          <p className="mb-3 text-xs leading-5 text-muted">
            Escolha a cor principal da interface. A alteração é aplicada imediatamente.
          </p>

          {canCustomizeTheme ? (
            <fieldset className="space-y-4" disabled={state.status === 'saving'}>
              <legend className="sr-only">Paletas disponíveis</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PALETTE_OPTIONS.map((option) => {
                  const selected = selectedPalette === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand',
                        selected
                          ? 'border-brand bg-brand-soft'
                          : 'border-border bg-surface-subtle hover:border-brand/40 hover:bg-brand-soft/30',
                      )}
                    >
                      <input
                        type="radio"
                        name="theme-palette"
                        value={option.value}
                        checked={selected}
                        onChange={() => void handlePaletteChange(option.value)}
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
            </fieldset>
          ) : (
            <EmptyState
              icon={<Palette className="size-5" />}
              title="Personalização de tema para assinantes"
              description="A troca de paleta de cores faz parte do plano de assinatura. Enquanto sua assinatura não estiver ativa, a interface usa a paleta padrão."
            />
          )}

          <SettingsStatus state={state} />
        </SettingsCard>
      </div>
    </div>
  );
}
