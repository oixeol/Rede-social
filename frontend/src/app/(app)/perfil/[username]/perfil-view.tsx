'use client';

import { useState } from 'react';
import {
  ProfileActions,
  ProfileBanner,
  ProfileContent,
  ProfileIdentity,
  ProfileStats,
  VerifiedBadge,
} from '@/components/profile/profile-center';
import {
  AboutCard,
  HighlightsCard,
  SuggestionsCard,
} from '@/components/profile/profile-side';
import { isFeatureEnabled } from '@/lib/feature-flags';
import type { ProfileViewModel } from '@/lib/profile-view-model';

/**
 * Tela de PERFIL — layout de três colunas.
 *
 * Coluna central: banner, avatar, identidade, ações, estatísticas, abas e grade.
 * Coluna direita: sobre, destaques e sugestões. Some abaixo de 1280 px.
 */
export interface ProfileScreenProps {
  profile: ProfileViewModel;
}

export function ProfileScreen({ profile }: ProfileScreenProps) {
  const [followers, setFollowers] = useState(profile.stats.followers);

  const handleFollowerChange = (delta: number) => {
    setFollowers((prev) => prev + delta);
  };

  return (
    <div
      className="grid min-w-0 items-start gap-[22px] xl:grid-cols-[minmax(0,872px)_354px]"
      aria-label="Perfil"
    >
      <section className="min-w-0" aria-label="Conteúdo do perfil">
        <ProfileBanner profile={profile} />

        <div className="relative -mt-[55px] grid grid-cols-[166px_minmax(0,1fr)] items-start gap-x-4 gap-y-3 sm:gap-x-5 lg:-mt-[70px] lg:grid-cols-[196px_minmax(0,1fr)_auto]">
          <div className="col-start-1 row-start-1 lg:ml-[30px] lg:row-span-3">
            <ProfileIdentity profile={profile} />
          </div>

          <div className="col-start-2 row-start-1 min-w-0 pt-[75px] lg:col-start-2 lg:pt-[100px]">
            <h1 className="flex min-w-0 items-center gap-1.5 text-[24px] leading-tight font-bold tracking-[-0.01em] text-foreground">
              <span className="min-w-0 truncate">{profile.name}</span>
              {profile.verified ? <VerifiedBadge className="size-[18px] shrink-0" /> : null}
            </h1>
            <p className="mt-1 truncate text-[13px] text-muted">@{profile.username}</p>
          </div>

          <div className="col-span-2 col-start-1 row-start-2 flex min-w-0 flex-wrap justify-end gap-2 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:flex-nowrap lg:pt-[100px]">
            <ProfileActions profile={profile} onFollowerChange={handleFollowerChange} />
          </div>

          <div className="col-span-2 col-start-1 row-start-3 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-2">
            {profile.bio ? (
              <p className="text-[13px] leading-5 text-foreground">{profile.bio}</p>
            ) : null}
          </div>

          <div className="col-span-2 col-start-1 row-start-4 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-3">
            <ProfileStats profile={profile} followersOverride={followers} />
          </div>
        </div>

        <div className="mt-4">
          <ProfileContent profile={profile} />
        </div>
      </section>

      <aside
        className="hidden min-w-0 space-y-4 xl:sticky xl:top-20 xl:block"
        aria-label="Informações do perfil"
      >
        <AboutCard profile={profile} />

        {isFeatureEnabled('highlights') ? <HighlightsCard profile={profile} /> : null}

        {isFeatureEnabled('suggestions') ? <SuggestionsCard profile={profile} /> : null}
      </aside>
    </div>
  );
}

export function PerfilView({ profile }: ProfileScreenProps) {
  return <ProfileScreen profile={profile} />;
}
