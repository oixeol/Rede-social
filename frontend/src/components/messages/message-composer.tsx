'use client';

import { useRef, useState, useCallback } from 'react';
import { FileText, Loader2, Paperclip, Send, Smile, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/cn';
import {
  classifyMessageAttachment,
  fileToDataUrl,
  validateMessageAttachment,
  type MessageAttachmentKind,
} from '@/lib/message-attachments';
import type { MessageAttachmentInput } from '@/lib/types';

const MAX_MESSAGE_LENGTH = 2000;
const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😭', '😡', '👍', '👏', '🔥', '🎉', '❤️', '💯', '🙏', '✨'];
const ALL_ATTACHMENTS_ACCEPT =
  '.png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.rtf,.txt,.csv,image/png,image/jpeg,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf,text/rtf,text/plain,text/csv';

interface ComposerAttachment {
  id: string;
  file: File;
  kind: MessageAttachmentKind;
  sizeBytes: number;
  previewUrl: string | null;
}

interface MessageComposerProps {
  username?: string;
  disabled?: boolean;
  disabledReason?: string | null;
  sending?: boolean;
  onSend: (text: string, media: MessageAttachmentInput[]) => Promise<boolean>;
  // Controlled mode props (optional - if provided, component becomes controlled)
  text?: string;
  setText?: (text: string) => void;
  attachments?: ComposerAttachment[];
  setAttachments?: (attachments: ComposerAttachment[]) => void;
  attachmentError?: string | null;
  preparing?: boolean;
  emojiOpen?: boolean;
  setEmojiOpen?: (open: boolean) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  insertEmoji?: (emoji: string) => void;
  openFilePicker?: () => void;
  removeAttachment?: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Compositor compacto. Enter envia; anexos podem enviados sem texto. */
export function MessageComposer({
  username,
  disabled = false,
  disabledReason = null,
  sending = false,
  onSend,
  // Controlled props
  text: controlledText,
  setText,
  attachments: controlledAttachments,
  setAttachments,
  attachmentError: controlledAttachmentError,
  preparing: controlledPreparing,
  emojiOpen: controlledEmojiOpen,
  setEmojiOpen,
  inputRef,
  fileInputRef,
  onKeyDown,
  insertEmoji: customInsertEmoji,
  openFilePicker: customOpenFilePicker,
  removeAttachment: customRemoveAttachment,
}: MessageComposerProps) {
  const isControlled = setText !== undefined && setAttachments !== undefined;

  const [uncontrolledText, setUncontrolledText] = useState('');
  const [uncontrolledAttachments, setUncontrolledAttachments] = useState<ComposerAttachment[]>([]);
  const [uncontrolledAttachmentError, setUncontrolledAttachmentError] = useState<string | null>(null);
  const [uncontrolledPreparing, setUncontrolledPreparing] = useState(false);
  const [uncontrolledEmojiOpen, setUncontrolledEmojiOpen] = useState(false);
  const uncontrolledInputRef = useRef<HTMLTextAreaElement>(null);
  const uncontrolledFileInputRef = useRef<HTMLInputElement>(null);

  const text = isControlled ? (controlledText ?? '') : uncontrolledText;
  const attachments = isControlled ? (controlledAttachments ?? []) : uncontrolledAttachments;
  const attachmentError = isControlled ? controlledAttachmentError : uncontrolledAttachmentError;
  const preparing = isControlled ? (controlledPreparing ?? false) : uncontrolledPreparing;
  const emojiOpen = isControlled ? (controlledEmojiOpen ?? false) : uncontrolledEmojiOpen;
  const currentInputRef = inputRef ?? uncontrolledInputRef;
  const currentFileInputRef = fileInputRef ?? uncontrolledFileInputRef;

  const setTextValue = isControlled ? setText! : setUncontrolledText;
  const setAttachmentsValue = isControlled ? setAttachments! : setUncontrolledAttachments;
  const setAttachmentErrorValue = isControlled
    ? (v: string | null) => { /* parent manages controlledAttachmentError */ }
    : setUncontrolledAttachmentError;
  const setPreparingValue = isControlled
    ? (v: boolean) => { /* parent manages controlledPreparing */ }
    : setUncontrolledPreparing;
  const setEmojiOpenValue = isControlled ? setEmojiOpen! : setUncontrolledEmojiOpen;

  const removeAttachmentValue = customRemoveAttachment ??
    (isControlled
      ? ((id: string) => setAttachmentsValue(attachments.filter((a: ComposerAttachment) => a.id !== id)))
      : ((id: string) => setUncontrolledAttachments((prev: ComposerAttachment[]) => prev.filter((a: ComposerAttachment) => a.id !== id)))
    );

  const busy = sending || preparing;
  const canSend = (text.trim().length > 0 || attachments.length > 0) && !disabled && !busy;
  const placeholder = disabled
    ? 'Mensagens indisponíveis'
    : `Conversar em ${username ? `@${username}` : 'outra pessoa'}`;

  const handleInsertEmoji = useCallback((emoji: string) => {
    if (customInsertEmoji) {
      customInsertEmoji(emoji);
      return;
    }
    const input = currentInputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
    setTextValue(next.slice(0, MAX_MESSAGE_LENGTH));
    setEmojiOpenValue(false);
    requestAnimationFrame(() => {
      input?.focus();
      const position = Math.min(start + emoji.length, MAX_MESSAGE_LENGTH);
      input?.setSelectionRange(position, position);
    });
  }, [customInsertEmoji, currentInputRef, text, setTextValue, setEmojiOpenValue]);

  const handleOpenFilePicker = useCallback(() => {
    if (customOpenFilePicker) {
      customOpenFilePicker();
      return;
    }
    const input = currentFileInputRef.current;
    if (!input || disabled || busy) return;
    input.accept = ALL_ATTACHMENTS_ACCEPT;
    input.click();
  }, [customOpenFilePicker, currentFileInputRef, disabled, busy]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setPreparingValue(true);
    setAttachmentErrorValue(null);

    const nextAttachments = [...attachments];
    let error: string | null = null;

    for (const file of files) {
      const validationError = validateMessageAttachment(
        file,
        nextAttachments.map((attachment) => ({ sizeBytes: attachment.sizeBytes })),
      );
      if (validationError) {
        error = validationError;
        continue;
      }

      const kind = classifyMessageAttachment(file);
      if (!kind) {
        error = 'Formato não suportado. Use PNG, JPG, WEBP, PDF, DOC, DOCX, RTF, TXT ou CSV.';
        continue;
      }

      try {
        const previewUrl = kind === 'image' ? await fileToDataUrl(file) : null;
        const attachment: ComposerAttachment = {
          id: crypto.randomUUID(),
          file,
          kind,
          sizeBytes: file.size,
          previewUrl,
        };
        nextAttachments.push(attachment);
      } catch {
        error = 'Não foi possível ler um dos anexos.';
      }
    }

    setAttachmentsValue(nextAttachments);
    setAttachmentErrorValue(error);
    setPreparingValue(false);
  }, [attachments, setAttachmentsValue, setAttachmentErrorValue, setPreparingValue]);

  const handleRemoveAttachment = useCallback((id: string) => {
    if (customRemoveAttachment) {
      customRemoveAttachment(id);
      return;
    }
    removeAttachmentValue(id);
    setAttachmentErrorValue(null);
  }, [customRemoveAttachment, removeAttachmentValue]);

  const submit = useCallback(async () => {
    if (!canSend) return;
    const value = text.trim();

    try {
      const media = await Promise.all(
        attachments.map(async (attachment): Promise<MessageAttachmentInput> => ({
          dataUrl: attachment.previewUrl ?? (await fileToDataUrl(attachment.file)),
          fileName: attachment.file.name,
        })),
      );
      const sent = await onSend(value, media);
      if (!sent) return;
      setTextValue('');
      setAttachmentsValue([]);
      setAttachmentErrorValue(null);
      currentInputRef.current?.focus();
    } catch {
      setAttachmentErrorValue('Não foi possível enviar os anexos.');
    }
  }, [canSend, text, attachments, onSend, setTextValue, setAttachmentsValue, setAttachmentErrorValue, currentInputRef]);

  return (
    <div className="shrink-0 border-t border-border bg-surface px-3 py-3 sm:px-5 sm:py-4">
      {disabled ? (
        <p className="mx-auto mb-2 max-w-3xl rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-center text-xs text-warning">
          {disabledReason || 'Você não pode enviar mensagens nesta conversa.'}
        </p>
      ) : null}

      {attachments.length > 0 ? (
        <div
          className="mx-auto mb-2 flex max-w-3xl gap-2 overflow-x-auto pb-1"
          aria-label="Anexos selecionados"
        >
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex min-w-0 max-w-[220px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 pr-2"
            >
              {attachment.kind === 'image' && attachment.previewUrl ? (
                <span
                  className="size-10 shrink-0 rounded-lg bg-cover bg-center"
                  style={{ backgroundImage: `url("${attachment.previewUrl}")` }}
                  role="img"
                  aria-label={`Prévia de ${attachment.file.name}`}
                />
              ) : (
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/8 text-muted">
                  <FileText className="size-4" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">
                  {attachment.file.name}
                </span>
                <span className="block text-[10px] text-muted">
                  {formatBytes(attachment.sizeBytes)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(attachment.id)}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                aria-label={`Remover ${attachment.file.name}`}
                title="Remover anexo"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {attachmentError ? (
        <p
          className="mx-auto mb-2 max-w-3xl text-center text-xs text-danger"
          role="alert"
          aria-live="polite"
        >
          {attachmentError}
        </p>
      ) : null}

      <div className="relative mx-auto flex max-w-3xl items-end gap-1.5 rounded-2xl border border-border bg-surface-subtle px-1.5 py-1.5 focus-within:border-brand">
        {emojiOpen ? (
          <div
            className="absolute bottom-[calc(100%+0.5rem)] left-0 z-30 grid w-[248px] grid-cols-8 gap-1 rounded-2xl border border-border bg-surface-raised p-2 shadow-float"
            role="dialog"
            aria-label="Escolher emoji"
          >
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleInsertEmoji(emoji)}
                className="inline-flex size-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                aria-label={`Inserir ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        <input
          ref={currentFileInputRef}
          type="file"
          multiple
          accept={ALL_ATTACHMENTS_ACCEPT}
          className="sr-only"
          disabled={disabled || busy}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            void handleFiles(files);
          }}
        />

        <IconButton
          label="Adicionar anexo"
          icon={<Paperclip className="size-5" />}
          onClick={handleOpenFilePicker}
          disabled={disabled || busy}
          title="Adicionar anexo"
          className="size-9 text-muted"
        />

        <label htmlFor="mensagem-texto" className="sr-only">
          Mensagem
        </label>
        <textarea
          ref={currentInputRef}
          id="mensagem-texto"
          value={text}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setTextValue(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={(event) => {
            if (onKeyDown) onKeyDown(event);
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
          className="min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
          style={{ minHeight: '40px', maxHeight: '160px' }}
        />

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            label="Inserir emoji"
            icon={<Smile className="size-5" />}
            onClick={() => setEmojiOpenValue(!emojiOpen)}
            disabled={disabled}
            className="size-9 text-muted"
          />
        </div>

        <Button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Enviar mensagem"
          title="Enviar mensagem"
          className={cn('size-9 shrink-0 rounded-xl p-0', !canSend && 'opacity-45')}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}