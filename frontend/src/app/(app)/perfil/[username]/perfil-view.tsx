'use client';

import { useState } from 'react';
import {
  ProfileActions,
  ProfileBanner,
  ProfileContent,
  ProfileIdentity,
  VerifiedBadge,
} from '@/components/profile/profile-center';
import { ProfileStats } from '@/components/profile/profile-stats';
import {
  AboutCard,
  BadgesCard,
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
  const [following, setFollowing] = useState(profile.stats.following);

  const handleFollowerChange = (delta: number) => {
    setFollowers((prev) => prev + delta);
  };

  const handleFollowingChange = (delta: number) => {
    setFollowing((prev) => prev + delta);
  };

  return (
    <div
      className="grid min-w-0 items-start gap-[22px] xl:grid-cols-[minmax(0,872px)_354px]"
      aria-label="Perfil"
    >
      <section className="min-w-0" aria-label="Conteúdo do perfil">
        <ProfileBanner profile={profile} />

        <div className="relative -mt-[48px] grid grid-cols-1 items-start gap-y-3 sm:-mt-[65px] sm:grid-cols-[196px_minmax(0,1fr)] sm:gap-x-[30px] sm:gap-y-0">
          <div className="col-start-1 row-start-1 sm:row-span-4 lg:ml-[21px]">
            <ProfileIdentity profile={profile} />
          </div>

          <div className="col-start-1 row-start-2 flex min-w-0 flex-col items-start gap-3 sm:col-start-2 sm:row-start-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pt-[91px]">
            <div className="min-w-0">
              <h1 className="flex min-w-0 items-center gap-1.5 text-[24px] leading-tight font-bold tracking-[-0.01em] text-foreground">
                <span className="min-w-0 truncate">{profile.name}</span>
                {profile.verified ? <VerifiedBadge className="size-[18px] shrink-0" /> : null}
              </h1>
              <p className="mt-0.5 truncate text-[13px] text-muted">@{profile.username}</p>
            </div>

            <ProfileActions profile={profile} onFollowerChange={handleFollowerChange} />
          </div>

          <div className="col-start-1 row-start-3 min-w-0 sm:col-start-2 sm:row-start-2 sm:mt-3">
            {profile.bio ? (
              <p className="text-[13px] leading-5 text-foreground">{profile.bio}</p>
            ) : null}
          </div>

          <div className="col-start-1 row-start-4 min-w-0 sm:col-start-2 sm:row-start-3 sm:mt-3">
            <ProfileStats
              posts={profile.stats.posts}
              followers={followers}
              following={following}
              username={profile.username}
              isMe={profile.isMe}
              onFollowersChange={handleFollowerChange}
              onFollowingChange={handleFollowingChange}
            />
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

        <BadgesCard badges={profile.badges} />

        {isFeatureEnabled('highlights') ? <HighlightsCard profile={profile} /> : null}

        {isFeatureEnabled('suggestions') ? <SuggestionsCard profile={profile} /> : null}
      </aside>
    </div>
  );
}

export function PerfilView({ profile }: ProfileScreenProps) {
  return <ProfileScreen profile={profile} />;
}
