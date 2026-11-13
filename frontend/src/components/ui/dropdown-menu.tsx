'use client';

import { MoreHorizontal } from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/cn';

export interface DropdownMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  badge?: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect?: () => void;
}

export interface DropdownMenuProps {
  items: DropdownMenuItem[];
  label?: string;
  trigger?: ReactNode;
  align?: 'start' | 'end';
  className?: string;
  /** Classes extras aplicadas ao painel flutuante do menu. */
  menuClassName?: string;
  /** Classes extras aplicadas ao botão gatilho. */
  triggerClassName?: string;
  /** Desabilita o menu completamente. */
  disabled?: boolean;
  /** Executado quando o menu é aberto; útil para carregar dados sob demanda. */
  onOpen?: () => void;
}

export function DropdownMenu({
  items,
  label = 'Mais opções',
  trigger,
  align = 'end',
  className,
  menuClassName,
  triggerClassName,
  disabled = false,
  onOpen,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusFirstItemOnOpenRef = useRef(false);
  const menuId = useId();

  const enabledItems = useCallback((): HTMLButtonElement[] => {
    return Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
  }, []);

  const focusItem = useCallback((direction: 1 | -1) => {
    const items = enabledItems();
    if (!items.length) return;
    const current = items.findIndex((item) => item === document.activeElement);
    const nextIndex = (current + direction + items.length) % items.length;
    items[nextIndex]?.focus();
  }, [enabledItems]);

  const focusFirstItem = useCallback(() => {
    enabledItems()[0]?.focus();
  }, [enabledItems]);

  useEffect(() => {
    if (!open) return;

    if (focusFirstItemOnOpenRef.current) {
      focusFirstItemOnOpenRef.current = false;
      focusFirstItem();
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, focusFirstItem]);

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((value) => {
            if (!value) onOpen?.();
            return !value;
          });
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (open) {
              focusFirstItem();
              return;
            }
            focusFirstItemOnOpenRef.current = true;
            setOpen(true);
          }
        }}
        disabled={disabled}
        aria-disabled={disabled}
        className={cn(
          'inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-subtle hover:text-foreground',
          disabled && 'cursor-not-allowed opacity-50',
          triggerClassName,
        )}
      >
        {trigger ?? <MoreHorizontal aria-hidden="true" className="size-5" />}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              focusItem(1);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              focusItem(-1);
            }
          }}
          className={cn(
            'absolute top-[calc(100%+0.4rem)] z-50 min-w-64 overflow-hidden rounded-2xl border border-border bg-surface-raised p-1.5 shadow-float',
            align === 'end' ? 'right-0' : 'left-0',
            menuClassName,
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                item.onSelect?.();
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55',
                item.destructive
                  ? 'text-danger hover:bg-danger-soft'
                  : 'text-foreground hover:bg-surface-subtle',
              )}
            >
              {item.icon ? (
                <span aria-hidden="true" className="mt-0.5 inline-flex shrink-0">{item.icon}</span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                  {item.label}
                  {item.badge ? (
                    <span className="rounded-pill bg-surface-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                {item.description ? (
                  <span className="mt-0.5 block text-xs leading-5 text-muted">{item.description}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
