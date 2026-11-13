'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Image as ImageIcon, LoaderCircle, MapPin, Send, Smile, Video as VideoIcon, X } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { apiRequest, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Post } from '@/lib/types';

interface ComposerMedia {
  dataUrl: string;
  type: 'image' | 'video';
}

interface ComposerProps {
  user: {
    name: string;
    avatar: string | null;
  };
}

const MAX_TEXT_LENGTH = 2200;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

export function Composer({ user }: ComposerProps) {
  const [text, setText] = useState('');
  const [media, setMedia] = useState<ComposerMedia | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const focusComposer = useCallback(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleOpenComposer() {
      focusComposer();
    }

    window.addEventListener('vibra:open-composer', handleOpenComposer);
    return () => window.removeEventListener('vibra:open-composer', handleOpenComposer);
  }, [focusComposer]);

  function reset() {
    setText('');
    setMedia(null);
    setMessage(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (!media) {
      setError('Adicione uma foto ou vídeo antes de publicar.');
      return;
    }

    const caption = text.trim();

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const body: { caption: string; image?: string; video?: string } = {
        caption: caption.slice(0, MAX_TEXT_LENGTH),
      };

      if (media?.type === 'image') body.image = media.dataUrl;
      if (media?.type === 'video') body.video = media.dataUrl;

      const response = await apiRequest<{ post: Post }>('/api/posts', {
        method: 'POST',
        body,
      });

      reset();
      setMessage('Publicação publicada.');
      // Atualização otimista do feed: o FeedContent escuta este evento.
      window.dispatchEvent(
        new CustomEvent<Post>('vibra:post-published', { detail: response.post }),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Não foi possível publicar. Tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const isVideoFile = file.type.startsWith('video/');
    const maxBytes = isVideoFile ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

    if (!file.type.startsWith('image/') && !isVideoFile) {
      setError('Formato não suportado. Envie uma imagem ou um vídeo.');
      return;
    }

    if (file.size > maxBytes) {
      setError(
        isVideoFile
          ? 'O vídeo excede o limite de 25 MB.'
          : 'A imagem excede o limite de 8 MB.',
      );
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setError('Não foi possível ler o arquivo selecionado.');
    reader.onload = () => {
      setMedia({
        dataUrl: String(reader.result),
        type: isVideoFile ? 'video' : 'image',
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function removeMedia() {
    setMedia(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const canSubmit = Boolean(media) && !submitting;

  return (
    <div
      ref={containerRef}
      className="rounded-card border border-border bg-surface shadow-card"
      aria-label="Criar publicação"
    >
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex gap-3">
          <Avatar src={user.avatar} alt={user.name} name={user.name} size="md" />

          <div className="min-w-0 flex-1">
            <label htmlFor="compositor-legenda" className="sr-only">
              Conteúdo da publicação
            </label>
            <textarea
              ref={textareaRef}
              id="compositor-legenda"
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT_LENGTH))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={focused ? 4 : 2}
              maxLength={MAX_TEXT_LENGTH}
              placeholder="O que você está sentindo hoje?"
              className="w-full resize-none rounded-2xl border border-transparent bg-surface-subtle px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted focus:border-brand focus:bg-surface focus:outline-none focus:shadow-[0_0_0_3px_rgb(from_var(--vibra-brand-fill)_14%,transparent)]"
            />

            {media ? (
              <div className="relative mt-3 overflow-hidden rounded-2xl border border-border">
                {media.type === 'video' ? (
                  <video
                    src={media.dataUrl}
                    muted
                    playsInline
                    controls
                    className="max-h-[420px] w-full bg-background object-contain"
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={media.dataUrl}
                    alt="Pré-visualização da mídia selecionada"
                    className="max-h-[420px] w-full bg-surface-subtle object-contain"
                  />
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={removeMedia}
                  className="absolute top-2 right-2 bg-surface-raised/95 shadow-float"
                  leadingIcon={<X className="size-3.5" />}
                >
                  Remover
                </Button>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                onChange={handleFileChange}
                className="sr-only"
                id="compositor-midia"
              />
              <label
                htmlFor="compositor-midia"
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft"
              >
                <ImageIcon className="size-4" aria-hidden="true" />
                Foto
              </label>
              <label
                htmlFor="compositor-midia"
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft"
              >
                <VideoIcon className="size-4" aria-hidden="true" />
                Vídeo
              </label>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-xs font-semibold text-muted">
                <MapPin className="size-4" aria-hidden="true" />
                Local
              </span>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-xs font-semibold text-muted">
                <Smile className="size-4" aria-hidden="true" />
                Sentimento
              </span>

              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-muted" aria-live="polite">
                  {text.length}/{MAX_TEXT_LENGTH}
                </span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit}
                  leadingIcon={submitting ? <LoaderCircle className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                >
                  {submitting ? 'Publicando…' : 'Publicar'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-3 rounded-xl border border-danger/20 bg-danger-soft/45 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {message && !error ? (
          <p role="status" className="mt-3 rounded-xl border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
