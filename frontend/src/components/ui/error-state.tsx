import { CircleAlert, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  pending?: boolean;
}

export function ErrorState({
  title = 'Não foi possível carregar',
  description = 'Tente novamente em alguns instantes.',
  onRetry,
  pending = false,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-card border border-danger/20 bg-danger-soft/45 px-5 py-9 text-center">
      <span aria-hidden="true" className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-danger-soft text-danger">
        <CircleAlert className="size-5" />
      </span>
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      {onRetry ? (
        <Button
          className="mt-5"
          variant="secondary"
          size="sm"
          leadingIcon={<RefreshCw className="size-3.5" />}
          onClick={onRetry}
          disabled={pending}
        >
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
