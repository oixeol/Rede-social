'use client';

import { Composer } from '@/components/posts/composer';
import { FeedContent } from '@/components/posts/feed-content';
import type { Post, UserBrief } from '@/lib/types';

interface InicioClientProps {
  initialForYouPosts: Post[];
  initialForYouCursor: number | null;
  initialFollowingPosts: Post[];
  initialFollowingCursor: number | null;
  meUser: UserBrief | null;
}

export function InicioClient({
  initialForYouPosts,
  initialForYouCursor,
  initialFollowingPosts,
  initialFollowingCursor,
  meUser,
}: InicioClientProps) {
  return (
    <div className="space-y-5">
      {meUser ? <Composer user={meUser} /> : null}

      <FeedContent
        forYouPosts={initialForYouPosts}
        forYouCursor={initialForYouCursor}
        followingPosts={initialFollowingPosts}
        followingCursor={initialFollowingCursor}
      />
    </div>
  );
}
