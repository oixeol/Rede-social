'use client';

import { type ReactNode, useId, useRef } from 'react';

import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  children?: ReactNode;
  className?: string;
}

export function Tabs({ items, value, onValueChange, label, children, className }: TabsProps) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  function focusTab(index: number) {
    const next = items[index];
    if (!next) return;
    onValueChange(next.id);
    listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${baseId}-${next.id}`)}`)?.focus();
  }

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        className="flex items-center gap-1 overflow-x-auto border-b border-border"
      >
        {items.map((item, index) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              id={`${baseId}-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onValueChange(item.id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  focusTab((index + 1) % items.length);
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  focusTab((index - 1 + items.length) % items.length);
                } else if (event.key === 'Home') {
                  event.preventDefault();
                  focusTab(0);
                } else if (event.key === 'End') {
                  event.preventDefault();
                  focusTab(items.length - 1);
                }
              }}
              className={cn(
                'relative min-h-11 shrink-0 px-4 text-sm font-semibold text-muted transition-colors hover:text-foreground',
                selected && 'text-foreground',
              )}
            >
              {item.label}
              {typeof item.count === 'number' ? (
                <span className="ml-1.5 text-xs font-normal text-subtle">{item.count}</span>
              ) : null}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-transparent',
                  selected && 'bg-brand-fill',
                )}
              />
            </button>
          );
        })}
      </div>

      {children ? (
        <div
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-${value}`}
          tabIndex={0}
          className="pt-5 outline-none"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
