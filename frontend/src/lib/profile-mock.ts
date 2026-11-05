/**
 * Dados mockados da tela de PERFIL do Vibra.
 *
 * Tipados em TypeScript e sem backend por enquanto. A estrutura espelha
 * exatamente o que aparece na referência: cabeçalho, estatísticas, abas,
 * grade 2x2 de publicações, destaques e sugestões.
 *
 * Perfis reais reentram no mesmo layout via `adaptProfileToMock`
 * (`src/app/(app)/perfil/[username]/perfil-view.tsx`).
 */

export type ProfileTabId = 'posts' | 'reels' | 'photos' | 'likes';

export interface ProfileTab {
  id: ProfileTabId;
  label: string;
}

export interface ProfileStats {
  posts: number;
  followers: number;
  following: number;
}

export interface ProfilePost {
  /** Identificador estável usado como chave React. */
  id: string;
  /** ID numérico da API. Ausente nos posts mockados. */
  apiId?: number;
  image: string;
  alt: string;
  /** Contagem de curtidas já formatada (ex.: "1.2k"). */
  likes: string;
  /** Contagem de comentários já formatada (ex.: "143"). */
  comments: string;
  /** Valor bruto das curtidas, usado para atualizar após curtir. */
  likesValue?: number;
  /** Valor bruto dos comentários. */
  commentsValue?: number;
  liked?: boolean;
  /** Publicação do próprio usuário — habilita "Apagar publicação". */
  mine?: boolean;
}

export interface ProfileHighlight {
  id: string;
  label: string;
  icon: 'crown' | 'gamepad' | 'music' | 'plane';
}

export interface ProfileSuggestion {
  id: string;
  username: string;
  name: string;
  avatar: string;
  alt: string;
  verified: boolean;
  reason: string;
}

export interface ProfileAbout {
  bio: string;
  location: string;
  joined: string;
  link: string;
}

export interface MockProfile {
  name: string;
  username: string;
  verified: boolean;
  online: boolean;
  /** Perfil do próprio usuário — troca "Editar perfil" por "Seguir". */
  isMe?: boolean;
  banner: string;
  bannerAlt: string;
  avatar: string;
  avatarAlt: string;
  stats: ProfileStats;
  tabs: ProfileTab[];
  posts: ProfilePost[];
  highlights: ProfileHighlight[];
  suggestions: ProfileSuggestion[];
  about: ProfileAbout;
}

export const PROFILE_TABS: ProfileTab[] = [
  { id: 'posts', label: 'Publicações' },
  { id: 'reels', label: 'Reels' },
  { id: 'photos', label: 'Fotos' },
  { id: 'likes', label: 'Curtidas' },
];

export const MOCK_PROFILE: MockProfile = {
  name: 'Vibra',
  username: 'vibra',
  verified: true,
  online: true,
  isMe: true,
  banner: '/images/banner.jpg',
  bannerAlt: 'Capa do perfil Vibra: personagem de capuz olhando uma cidade iluminada à noite',
  avatar: '/images/avatar.jpg',
  avatarAlt: 'Foto de perfil de Vibra',
  stats: {
    posts: 128,
    followers: 24,
    following: 3,
  },
  tabs: PROFILE_TABS,
  posts: [
    {
      id: 'post-1',
      image: '/images/post-1.jpg',
      alt: 'Lua cheia sobre um skyline noturno sob um céu quase preto',
      likes: '1.2k',
      comments: '143',
      likesValue: 1200,
      commentsValue: 143,
    },
    {
      id: 'post-2',
      image: '/images/post-2.jpg',
      alt: 'Cidade em preto e branco com silhueta de pessoa sentada de fone de ouvido',
      likes: '892',
      comments: '97',
      likesValue: 892,
      commentsValue: 97,
    },
    {
      id: 'post-3',
      image: '/images/post-3.jpg',
      alt: 'Cerejeira laranja em flor com pagode ao fundo',
      likes: '2.1k',
      comments: '217',
      likesValue: 2100,
      commentsValue: 217,
    },
    {
      id: 'post-4',
      image: '/images/post-4.jpg',
      alt: 'Ondas abstratas laranja-neon sobre fundo escuro',
      likes: '743',
      comments: '64',
      likesValue: 743,
      commentsValue: 64,
    },
  ],
  highlights: [
    { id: 'favoritos', label: 'Favoritos', icon: 'crown' },
    { id: 'jogos', label: 'Jogos', icon: 'gamepad' },
    { id: 'musicas', label: 'Músicas', icon: 'music' },
    { id: 'viagens', label: 'Viagens', icon: 'plane' },
  ],
  suggestions: [
    {
      id: 'lucasfps',
      username: 'lucasfps',
      name: 'lucasfps',
      avatar: '/images/avatar-lucasfps.jpg',
      alt: 'Foto de perfil de lucasfps',
      verified: true,
      reason: 'Segue você',
    },
    {
      id: 'ana_oliveira',
      username: 'ana_oliveira',
      name: 'ana_oliveira',
      avatar: '/images/avatar-ana.jpg',
      alt: 'Foto de perfil de ana_oliveira',
      verified: true,
      reason: 'Segue você',
    },
    {
      id: 'darkzera',
      username: 'darkzera',
      name: 'darkzera',
      avatar: '/images/avatar-darkzera.jpg',
      alt: 'Foto de perfil de darkzera',
      verified: true,
      reason: 'Segue você',
    },
  ],
  about: {
    bio: 'Seu cantinho visual. Compartilhe o que te inspira.',
    location: 'Brasil',
    joined: 'Entrou em 2026',
    link: 'vibra.app',
  },
};
