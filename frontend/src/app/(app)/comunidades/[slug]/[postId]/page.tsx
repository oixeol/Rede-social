import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMe, serverApiRequest } from '@/lib/server-api';
import type { CommunityPost, SelfUser } from '@/lib/types';

import { CommunityPostDetailClient } from './community-post-detail-client';

interface Props {
  params: Promise<{ slug: string; postId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, postId } = await params;
  return {
    title: 'Post da Comunidade',
    description: 'Visualizando post da comunidade no Orbit.',
  };
}

export default async function CommunityPostDetailPage({ params }: Props) {
  const { slug, postId } = await params;
  const numericPostId = parseInt(postId, 10);
  if (isNaN(numericPostId)) notFound();

  const [meResult, postResult] = await Promise.allSettled([
    getMe(),
    serverApiRequest<{ post: CommunityPost }>(`/api/communities/${encodeURIComponent(slug)}/posts/${postId}`),
  ]);

  const me = meResult.status === 'fulfilled' ? meResult.value : null;
  const post = postResult.status === 'fulfilled' ? postResult.value.post : null;

  if (!post) notFound();

  return (
    <CommunityPostDetailClient
      initialMe={me?.user || null}
      initialPost={post}
      communitySlug={slug}
    />
  );
}