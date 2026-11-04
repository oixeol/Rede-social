import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-border-strong bg-surface/60 px-5 py-10 text-center">
      <span aria-hidden="true" className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand">
        {icon}
      </span>
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
