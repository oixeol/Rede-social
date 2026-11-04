'use client';

import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { Send, LoaderCircle } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { apiRequest, ApiError } from '@/lib/api';
import type { Comment, UserBrief } from '@/lib/types';

interface CommentsSectionProps {
  initialComments: Comment[];
  postId: number;
}

export function CommentsSection({ initialComments, postId }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newCommentText, setNewCommentText] = useState('');
  const [pendingComment, setPendingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  async function submitComment() {
    const text = newCommentText.trim();
    if (!text || pendingComment) return;

    setPendingComment(true);
    setError(null);
    try {
      const res = await apiRequest<{
        comment: Comment;
        comments: number;
      }>(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: { text },
      });
      setComments((prev) => [...prev, res.comment]);
      setNewCommentText('');
      commentInputRef.current?.blur();
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401) {
        setError('Não foi possível enviar o comentário. Tente novamente.');
      }
    } finally {
      setPendingComment(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitComment();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitComment();
    }
  }

  return (
    <section className="comments-section mt-6 space-y-4" aria-label="Comentários">
      <h2 className="text-lg font-semibold text-foreground">
        {comments.length} {comments.length === 1 ? 'comentário' : 'comentários'}
      </h2>

      {comments.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-strong bg-surface/60 px-5 py-8 text-center text-sm text-muted">
          Seja o primeiro a comentar.
        </p>
      ) : (
        <ul className="comments-list space-y-4" role="list" aria-label="Lista de comentários">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="comment-form flex items-start gap-3">
        <Avatar src={null} alt="Seu perfil" name="Você" size="sm" />
        <div className="min-w-0 flex-1">
          <label htmlFor="comment-input" className="sr-only">
            Escreva um comentário
          </label>
          <textarea
            ref={commentInputRef}
            id="comment-input"
            value={newCommentText}
            onChange={(event) => setNewCommentText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva um comentário…"
            rows={1}
            maxLength={500}
            disabled={pendingComment}
            className="comment-input w-full min-h-[44px] resize-none rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="mt-2 flex items-center justify-end gap-3">
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!newCommentText.trim() || pendingComment}
              leadingIcon={pendingComment ? <LoaderCircle className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              aria-busy={pendingComment}
            >
              {pendingComment ? 'Enviando…' : 'Comentar'}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

interface CommentItemProps {
  comment: Comment & { user: UserBrief };
}

function CommentItem({ comment }: CommentItemProps) {
  return (
    <li className="comment-item flex gap-3">
      <article className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <strong className="text-foreground">{comment.user.username}</strong>
          <time
            className="text-xs text-muted"
            dateTime={new Date(comment.createdAt).toISOString()}
          >
            {new Date(comment.createdAt).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </time>
        </header>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{comment.text}</p>
      </article>
    </li>
  );
}
