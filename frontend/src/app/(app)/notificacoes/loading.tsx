import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl" role="status" aria-live="polite" aria-busy="true">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-surface-subtle animate-pulse" />
          <div className="h-9 w-48 rounded bg-surface-subtle animate-pulse" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-start gap-3 rounded-card border border-border bg-surface p-4">
            <Skeleton className="size-9 rounded-xl" label="Ícone" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full max-w-lg rounded" label="Notificação" />
              <Skeleton className="h-3 w-20 rounded" label="Data" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}