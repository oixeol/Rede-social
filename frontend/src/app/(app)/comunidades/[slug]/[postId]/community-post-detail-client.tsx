'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { Loader2, Heart, Repeat, Share2, MoreHorizontal, Flag, Trash2, Edit, Bookmark, ArrowLeft } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { apiRequest } from '@/lib/api';
import { formatRelativeTime, formatCount } from '@/lib/messages';
import type { CommunityPost } from '@/lib/types';
import { CommunityPostCard } from '@/components/communities/community-post-card';

interface CommunityPostDetailClientProps {
  initialMe: { id: number; username: string; name: string; avatar: string | null } | null;
  initialPost: CommunityPost;
  communitySlug: string;
}

export function CommunityPostDetailClient({ initialMe, initialPost, communitySlug }: CommunityPostDetailClientProps) {
  const [post, setPost] = useState<CommunityPost>(initialPost);
  const [replies, setReplies] = useState<CommunityPost[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyMedia, setReplyMedia] = useState<File[]>([]);
  const [submittingReply, setSubmittingReply] = useState(false);

  const me = initialMe;
  const isAuthor = me && post.userId === me.id;

  const handleLike = async () => {
    const newLiked = !post.liked;
    setPost((p) => ({ ...p, liked: newLiked, likesCount: newLiked ? p.likesCount + 1 : p.likesCount - 1 }));
    try {
      if (newLiked) {
        await apiRequest(`/api/community-posts/${post.id}/like`, { method: 'POST' });
      } else {
        await apiRequest(`/api/community-posts/${post.id}/like`, { method: 'DELETE' });
      }
    } catch {
      setPost((p) => ({ ...p, liked: !newLiked, likesCount: !newLiked ? p.likesCount + 1 : p.likesCount - 1 }));
    }
  };

  const handleRepost = async () => {
    const newReposted = !post.reposted;
    setPost((p) => ({ ...p, reposted: newReposted, repostsCount: newReposted ? p.repostsCount + 1 : p.repostsCount - 1 }));
    try {
      if (newReposted) {
        await apiRequest(`/api/community-posts/${post.id}/repost`, { method: 'POST' });
      } else {
        await apiRequest(`/api/community-posts/${post.id}/repost`, { method: 'DELETE' });
      }
    } catch {
      setPost((p) => ({ ...p, reposted: !newReposted, repostsCount: !newReposted ? p.repostsCount + 1 : p.repostsCount - 1 }));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este post?')) return;
    try {
      await apiRequest(`/api/community-posts/${post.id}`, { method: 'DELETE' });
      window.location.href = `/comunidades/${encodeURIComponent(communitySlug)}` as Route;
    } catch {
      alert('Erro ao excluir post');
    }
  };

  const menuItems: DropdownMenuItem[] = [
    ...(isAuthor
      ? [
          { id: 'edit', label: 'Editar', icon: <Edit className="size-4" />, onSelect: () => {} },
          { id: 'delete', label: 'Excluir', icon: <Trash2 className="size-4" />, destructive: true, onSelect: handleDelete },
        ]
      : [
          { id: 'report', label: 'Denunciar', icon: <Flag className="size-4" />, destructive: true, onSelect: () => {} },
          { id: 'bookmark', label: 'Salvar', icon: <Bookmark className="size-4" />, onSelect: () => {} },
        ]),
  ];

  const loadReplies = async () => {
    setLoadingReplies(true);
    try {
      const res = await apiRequest<{ post: CommunityPost; replies: CommunityPost[] }>(
        `/api/communities/${encodeURIComponent(communitySlug)}/posts/${post.id}`
      );
      setPost(res.post);
      setReplies(res.replies);
    } catch {
      // Replies already loaded from server component
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text && replyMedia.length === 0) return;
    if (!me) return;

    const formData = new FormData();
    formData.append('text', text);
    formData.append('replyToId', String(post.id));
    replyMedia.forEach((file) => formData.append('media', file));

    setSubmittingReply(true);
    try {
      const res = await apiRequest<{ post: CommunityPost }>(
        `/api/communities/${encodeURIComponent(communitySlug)}/posts`,
        { method: 'POST', body: formData }
      );
      setReplies((prev) => [...prev, res.post]);
      setReplyText('');
      setReplyMedia([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao responder');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleReplyMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + replyMedia.length > 4) {
      alert('Máximo 4 arquivos');
      return;
    }
    setReplyMedia((prev) => [...prev, ...files]);
  };

  const removeReplyMedia = (idx: number) => {
    setReplyMedia((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Back link */}
      <Link href={`/comunidades/${encodeURIComponent(communitySlug)}` as Route} className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4 inline-flex">
        <ArrowLeft className="size-4" />
        Voltar à comunidade
      </Link>

      {/* Main Post */}
      <CommunityPostCard
        post={post}
        currentUserId={me?.id || 0}
        onPostChange={setPost}
        showCommunity={false}
      />

      {/* Replies */}
      <div className="border-t border-border mt-4">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">Respostas</h2>
        </div>

        {/* Reply Composer */}
        {me && (
          <form onSubmit={handleReplySubmit} className="border-b border-border p-4 bg-background">
            <div className="flex gap-3">
              <Avatar src={me.avatar} alt={me.name} name={me.name} size="sm" />
              <div className="flex-1 min-w-0">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Responder a @${post.user.username}...`}
                  className="w-full min-h-[80px] resize-none rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                  maxLength={280}
                  rows={3}
                />
                {replyMedia.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
                    {replyMedia.map((file, idx) => (
                      <div key={idx} className="relative shrink-0 size-20 rounded-xl overflow-hidden">
                        {file.type.startsWith('video/') ? (
                          <video src={URL.createObjectURL(file)} muted playsInline className="size-full object-cover" />
                        ) : (
                          <Image src={URL.createObjectURL(file)} alt="" fill sizes="80px" className="object-cover" unoptimized />
                        )}
                        <button
                          type="button"
                          onClick={() => removeReplyMedia(idx)}
                          className="absolute top-1 right-1 size-5 rounded-full bg-black/50 text-white flex items-center justify-center"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                  multiple
                  onChange={handleReplyMediaChange}
                  className="hidden"
                  id={`reply-media-${post.id}`}
                />
                <label
                  htmlFor={`reply-media-${post.id}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground cursor-pointer"
                >
                  <Plus className="size-4" />
                  Anexar
                </label>
                <div className="mt-3 flex justify-end">
                  <Button type="submit" disabled={!replyText.trim() && replyMedia.length === 0 || submittingReply}>
                    {submittingReply ? 'Enviando...' : 'Responder'}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Replies List */}
        <div className="divide-y divide-border">
          {loadingReplies ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-8 animate-spin text-brand" />
            </div>
          ) : replies.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted">
              Nenhuma resposta ainda. Seja o primeiro a responder!
            </div>
          ) : (
            replies.map((reply) => (
              <CommunityPostCard
                key={reply.id}
                post={reply}
                currentUserId={me?.id || 0}
                onPostChange={(updated) => setReplies((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
                showCommunity={false}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

import { Plus, X } from 'lucide-react';