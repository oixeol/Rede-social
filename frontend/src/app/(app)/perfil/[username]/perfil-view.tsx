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
  PremiumUpsellCard,
  SuggestionsCard,
} from '@/components/profile/profile-side';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { Crown } from 'lucide-react';
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
      className="grid min-w-0 items-start gap-[24px] xl:grid-cols-[minmax(0,872px)_354px]"
      aria-label="Perfil"
    >
      <section className="min-w-0" aria-label="Conteúdo do perfil">
        <ProfileBanner profile={profile} />

        <div className="relative -mt-[52px]">
          <div className="lg:ml-[24px]">
            <ProfileIdentity profile={profile} />
          </div>

          <div className="mt-4 lg:ml-[24px] lg:mt-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="flex min-w-0 items-center gap-2 text-[26px] leading-tight font-bold tracking-[-0.01em] text-foreground">
                  <span className="min-w-0 truncate">{profile.name}</span>
                  {profile.verified ? <VerifiedBadge className="size-[20px] shrink-0" /> : null}
                  {profile.isPremium ? (
                    <span className="relative inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand via-brand-hover to-brand px-3 py-0.5 text-[11px] font-bold text-on-brand">
                      <Crown className="size-3.5" aria-hidden="true" />
                      Premium
                    </span>
                  ) : null}
                </h1>
                <p className="mt-1 truncate text-[14px] text-muted">@{profile.username}</p>
              </div>

              <ProfileActions profile={profile} onFollowerChange={handleFollowerChange} />
            </div>

            {profile.bio ? (
              <p className="mt-4 text-[14px] leading-6 text-foreground">{profile.bio}</p>
            ) : null}

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

        <div className="mt-6">
          <ProfileContent profile={profile} />
        </div>
      </section>

      <aside
        className="hidden min-w-0 space-y-4 xl:sticky xl:top-24 xl:block"
        aria-label="Informações do perfil"
      >
        {isFeatureEnabled('premium') && !profile.isPremium ? (
          <PremiumUpsellCard isOwnProfile={profile.isMe} />
        ) : null}

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
