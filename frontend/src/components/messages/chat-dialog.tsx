'use client';

import { useEffect, useRef, useCallback, useId } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { createPortal } from 'react-dom';

interface ChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** true para fechar ao clicar no backdrop. */
  closeOnBackdrop?: boolean;
}

export function ChatDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  closeOnBackdrop = true,
}: ChatDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCloseRef.current();
      return;
    }

    if (event.key !== 'Tab' || !dialogRef.current) return;

    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousActive = document.activeElement as HTMLElement | null;
    triggerRef.current = previousActive;

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // foca primeiro elemento autofoco ou primeiro focusable
    const focusTarget = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusTarget?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousActive?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const dialog = (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/70 transition-opacity"
        aria-hidden="true"
        onClick={closeOnBackdrop ? () => onCloseRef.current() : undefined}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-float relative z-10',
          className,
        )}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Fechar"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        {description ? (
          <p id={descriptionId} className="px-4 py-3 text-sm text-muted border-b border-border">
            {description}
          </p>
        ) : null}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(dialog, document.body);
}