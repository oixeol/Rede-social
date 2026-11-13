import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { serverApiRequest, ApiError } from '@/lib/server-api';
import { PostCard } from '@/components/posts/post-card';
import { ErrorState } from '@/components/ui/error-state';
import { CommentsSection } from './CommentsSection';

interface PostDetailResponse {
  post: {
    id: number;
    image: string;
    mediaType: 'image' | 'video';
    media: Array<{ url: string; mediaType: 'image' | 'video' }>;
    topic: string;
    caption: string;
    createdAt: number;
    user: {
      id: number;
      username: string;
      name: string;
      avatar: string | null;
      isPrivate: boolean;
      verified: boolean;
    };
    likes: number;
    comments: number;
    shares: number;
    reposts: number;
    saves: number;
    liked: boolean;
    reposted: boolean;
    saved: boolean;
    authorFollowing: boolean;
  };
  comments: Array<{
    id: number;
    text: string;
    createdAt: number;
    user: {
      id: number;
      username: string;
      name: string;
      avatar: string | null;
    };
  }>;
  canDelete: boolean;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const postId = Number(id);

  if (!Number.isInteger(postId) || postId <= 0) {
    return { title: 'Publicação não encontrada' };
  }

  try {
    const response = await serverApiRequest<PostDetailResponse>(`/api/posts/${postId}`);
    const post = response.post;
    return {
      title: post.caption.slice(0, 100) || 'Publicação no Orbit',
      description: post.caption.slice(0, 160),
      openGraph: {
        title: post.caption.slice(0, 100) || 'Publicação no Orbit',
        description: post.caption.slice(0, 160),
        images: post.media[0]?.url ? [post.media[0].url] : [],
        type: 'article',
        publishedTime: new Date(post.createdAt).toISOString(),
        authors: [post.user.name],
      },
    };
  } catch {
    return { title: 'Publicação' };
  }
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params;
  const postId = Number(id);

  if (!Number.isInteger(postId) || postId <= 0) {
    notFound();
  }

  let response: PostDetailResponse;

  try {
    response = await serverApiRequest<PostDetailResponse>(`/api/posts/${postId}`);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        notFound();
      }
      if (error.status === 403) {
        return <PrivatePostNotice />;
      }
    }
    throw error;
  }

  return (
    <article className="post-detail max-w-2xl mx-auto">
      <PostCard post={response.post} />
      <CommentsSection initialComments={response.comments} postId={postId} />
    </article>
  );
}

/** Conteúdo privado: o usuário está autenticado, mas não pode ver a publicação. */
function PrivatePostNotice() {
  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <ErrorState
        title="Conteúdo restrito"
        description="Este perfil é privado. Envie uma solicitação para seguir e ver o conteúdo."
      />
    </div>
  );
}