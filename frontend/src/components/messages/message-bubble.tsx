'use client';

import Image from 'next/image';
import { BadgeCheck, CheckCheck, Download, FileText } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { isSafeMediaSource } from '@/lib/media';
import { formatClockTime } from '@/lib/messages';
import type { Message, MessageMedia } from '@/lib/types';

interface MessageBubbleProps {
  message: Message;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageAttachment({ attachment }: { attachment: MessageMedia }) {
  const safeSource = isSafeMediaSource(attachment.url) ? attachment.url : null;
  if (!safeSource) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
        <FileText className="size-4 shrink-0" aria-hidden="true" />
        Anexo indisponível
      </div>
    );
  }

  if (attachment.mediaType === 'image') {
    return (
      <div className="mt-2 max-w-md overflow-hidden rounded-xl border border-border bg-surface-subtle">
        <Image
          src={safeSource}
          alt={attachment.fileName || 'Imagem enviada na mensagem'}
          width={768}
          height={576}
          sizes="(min-width: 768px) 384px, 100vw"
          className="h-auto max-h-96 w-full object-contain"
          unoptimized
        />
      </div>
    );
  }

  return (
    <a
      href={safeSource}
      download={attachment.fileName || undefined}
      className="mt-2 flex max-w-md items-center gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-2.5 transition-colors hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <FileText className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-foreground">
          {attachment.fileName || 'Documento'}
        </span>
        <span className="block truncate text-[10px] text-muted">
          {formatFileSize(attachment.sizeBytes) || attachment.mimeType || 'Documento'}
        </span>
      </span>
      <Download className="size-4 shrink-0 text-muted" aria-hidden="true" />
    </a>
  );
}

/** Mensagem compacta estilo Orbit: avatar + cabeçalho do remetente + corpo em linha própria. */
export function MessageBubble({ message }: MessageBubbleProps) {
  const sharedMedia = message.sharedPost?.media?.[0]?.url;
  const safeSharedMedia = isSafeMediaSource(sharedMedia) ? sharedMedia : null;
  const isVideo = message.sharedPost?.media?.[0]?.mediaType === 'video';
  const hasBody = Boolean(message.body.trim());
  const attachments = message.media ?? [];
  const sender = message.sender;
  const isMine = message.mine;

  return (
    <article className="flex gap-3">
      <div className="min-w-0 flex-1">
        {/* Avatar + Cabeçalho */}
        <div className="flex items-center gap-2">
          <Avatar src={sender.avatar} alt={sender.name} name={sender.name} size="sm" />
          <div className="flex min-w-0 items-center gap-2">
            <strong className="truncate text-sm text-foreground">{sender.name}</strong>
            {sender.verified ? (
              <BadgeCheck className="size-3.5 shrink-0 text-brand" aria-label="Perfil verificado" />
            ) : null}
            <time
              className="shrink-0 text-[10px] text-subtle"
              dateTime={new Date(message.createdAt).toISOString()}
            >
              {formatClockTime(message.createdAt)}
            </time>
          </div>
        </div>

        {/* Corpo */}
        {hasBody ? (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
            {message.body}
          </p>
        ) : null}

        {/* Anexos reais */}
        {attachments.length > 0 ? (
          <div className="space-y-2">
            {attachments.map((attachment, index) => (
              <MessageAttachment key={`${attachment.url}-${index}`} attachment={attachment} />
            ))}
          </div>
        ) : null}

        {/* Publicação compartilhada */}
        {message.sharedPost ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-surface-subtle">
            {safeSharedMedia ? (
              isVideo ? (
                <video
                  src={safeSharedMedia}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  style={{ aspectRatio: '468 / 585' }}
                  className="w-full bg-surface-subtle object-cover"
                  aria-label="Vídeo compartilhado na conversa"
                />
              ) : (
                <Image
                  src={safeSharedMedia}
                  alt={message.sharedPost.caption || 'Foto compartilhada na conversa'}
                  width={468}
                  height={585}
                  style={{ aspectRatio: '468 / 585' }}
                  className="w-full bg-surface-subtle object-cover"
                  unoptimized
                />
              )
            ) : (
              <span
                style={{ aspectRatio: '468 / 585' }}
                className="flex w-full items-center justify-center text-xs text-muted"
              >
                Publicação sem imagem
              </span>
            )}
            <div className="flex items-start gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold">Publicação compartilhada</p>
                {message.sharedPost.caption ? (
                  <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{message.sharedPost.caption}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Check enviado para mensagens próprias */}
      {isMine ? (
        <div className="flex shrink-0 items-end">
          <CheckCheck className="size-3.5 text-subtle" aria-label="Mensagem enviada" />
        </div>
      ) : null}
    </article>
  );
}
