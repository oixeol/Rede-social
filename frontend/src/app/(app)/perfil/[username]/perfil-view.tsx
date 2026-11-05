'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  AboutCard,
  HighlightsCard,
  SuggestionsCard,
} from '@/components/profile/profile-side';
import {
  ProfileActions,
  ProfileBanner,
  ProfileContent,
  ProfileIdentity,
  ProfileStats,
  VerifiedBadge,
} from '@/components/profile/profile-center';
import type { MockProfile, ProfileHighlight } from '@/lib/profile-mock';
import { MOCK_PROFILE } from '@/lib/profile-mock';
import type { Post, ProfileResponse, SuggestionUser } from '@/lib/types';
import { apiRequest } from '@/lib/api';

/**
 * Tela de PERFIL — layout 3 colunas (referência Vibra).
 *
 * Coluna central: banner, avatar, identidade, ações, stats, abas, grade.
 * Coluna direita: Sobre mim, Destaques, Sugestões para você.
 *
 * Dados mockados tipados (sem backend por enquanto) para o perfil de
 * demonstração "vibra". Perfis reais reentram no mesmo layout via
 * `adaptProfileToMock`.
 */

export interface ProfileScreenProps {
  profile: MockProfile;
}

export function ProfileScreen({ profile }: ProfileScreenProps) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_355px]">
      <section className="min-w-0" aria-label="Perfil">
        <ProfileBanner profile={profile} />

        <div className="relative -mt-[52px] flex items-end gap-5 px-1">
          <ProfileIdentity profile={profile} />

          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="flex items-center gap-1.5 text-[28px] leading-tight font-bold tracking-[-0.02em] text-foreground">
                  <span className="truncate">{profile.name}</span>
                  {profile.verified ? <VerifiedBadge className="size-5 shrink-0" /> : null}
                </h1>
                <p className="mt-0.5 text-sm text-muted">@{profile.username}</p>
              </div>

              <ProfileActions profile={profile} />
            </div>

            <p className="mt-3 text-[13px] leading-5 text-foreground">{profile.about.bio}</p>
          </div>
        </div>

        <div className="mt-5 px-1">
          <ProfileStats profile={profile} />
        </div>

        <div className="mt-6">
          <ProfileContent profile={profile} />
        </div>
      </section>

      <aside className="space-y-4" aria-label="Informações do perfil">
        <AboutCard profile={profile} />
        <HighlightsCard profile={profile} />
        <SuggestionsCard profile={profile} />
      </aside>
    </div>
  );
}

/** Resolve a imagem exibida na grade: mídia, campo `image` ou placeholder. */
function resolvePostImage(post: Post): string {
  const mediaUrl = post.media?.find((media) => media.url)?.url;
  if (mediaUrl) return mediaUrl;
  if (post.image) return post.image;
  return '/images/post-1.jpg';
}

/**
 * Converte os dados da API em um perfil no formato da referência.
 * Usado quando o perfil real não é o perfil de demonstração "vibra".
 */
export function adaptProfileToMock(
  input: {
    name: string;
    username: string;
    bio: string;
    avatar: string | null;
    banner: string | null;
    verified: boolean;
    isMe: boolean;
    stats: { posts: number; followers: number; following: number };
    posts: Array<{
      id: number;
      image: string;
      caption: string;
      likes: number;
      comments: number;
      liked: boolean;
      mine: boolean;
    }>;
    suggestions: Array<{
      id: number;
      username: string;
      name: string;
      avatar: string | null;
    }>;
    highlights: ProfileHighlight[];
  },
  about: MockProfile['about'],
): MockProfile {
  return {
    name: input.name,
    username: input.username,
    verified: input.verified,
    online: false,
    isMe: input.isMe,
    banner: input.banner ?? MOCK_PROFILE.banner,
    bannerAlt: `Capa de ${input.name}`,
    avatar: input.avatar ?? MOCK_PROFILE.avatar,
    avatarAlt: `Foto de perfil de ${input.name}`,
    stats: input.stats,
    tabs: MOCK_PROFILE.tabs,
    posts: input.posts.map((post) => ({
      id: String(post.id),
      apiId: post.id,
      image: post.image,
      alt: post.caption || `Publicação de ${input.name}`,
      likes: String(post.likes),
      comments: String(post.comments),
      likesValue: post.likes,
      commentsValue: post.comments,
      liked: post.liked,
      mine: post.mine,
    })),
    highlights: input.highlights,
    suggestions: input.suggestions.map((suggestion) => ({
      id: String(suggestion.id),
      username: suggestion.username,
      name: suggestion.name,
      avatar: suggestion.avatar ?? MOCK_PROFILE.avatar,
      alt: `Foto de perfil de ${suggestion.name}`,
      verified: false,
      reason: 'Segue você',
    })),
    about,
  };
}

/**
 * Monta o modelo da tela a partir da resposta da API.
 * Sugestões são carregadas no cliente; a estrutura da tela é sempre a
 * mesma da referência.
 */
export function useProfileScreen(profile: ProfileResponse): MockProfile {
  const [suggestions, setSuggestions] = useState<SuggestionUser[]>([]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    apiRequest<{ users: SuggestionUser[] }>('/api/suggestions', { signal: controller.signal })
      .then((response) => {
        if (cancelled) return;
        setSuggestions(response.users.filter((user) => user.id !== profile.user.id).slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [profile.user.id]);

  return useMemo(
    () =>
      adaptProfileToMock(
        {
          name: profile.user.name,
          username: profile.user.username,
          bio: profile.user.bio || MOCK_PROFILE.about.bio,
          avatar: profile.user.avatar,
          banner: profile.user.banner,
          verified: profile.stats.verified === 1,
          isMe: profile.isMe,
          stats: {
            posts: profile.stats.posts,
            followers: profile.stats.followers,
            following: profile.stats.following,
          },
          posts: profile.posts.map((post) => ({
            id: post.id,
            image: resolvePostImage(post),
            caption: post.caption,
            likes: post.likes,
            comments: post.comments,
            liked: post.liked,
            mine: profile.isMe,
          })),
          suggestions: suggestions.map((user) => ({
            id: user.id,
            username: user.username,
            name: user.name,
            avatar: user.avatar,
          })),
          highlights: MOCK_PROFILE.highlights,
        },
        {
          bio: profile.user.bio || MOCK_PROFILE.about.bio,
          location: 'Brasil',
          joined: profile.user.createdAt
            ? `Entrou em ${new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
                new Date(profile.user.createdAt),
              )}`
            : MOCK_PROFILE.about.joined,
          link: MOCK_PROFILE.about.link,
        },
      ),
    [profile, suggestions],
  );
}

/**
 * Wrapper client: recebe a resposta da API e monta a tela de perfil.
 */
export function PerfilView({ profile }: { profile: ProfileResponse }) {
  const model = useProfileScreen(profile);
  return <ProfileScreen profile={model} />;
}
