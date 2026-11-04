import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl" role="status" aria-live="polite" aria-busy="true">
      <div className="mb-6 space-y-2">
        <div className="h-3 w-24 rounded bg-surface-subtle animate-pulse" />
        <div className="h-9 w-64 rounded bg-surface-subtle animate-pulse" />
      </div>
      <div className="mb-10 space-y-4 rounded-card border border-border bg-surface p-4 sm:p-5">
        <Skeleton className="h-5 w-32 rounded" label="Título" />
        <Skeleton className="h-10 w-full rounded-xl" label="Campo" />
        <Skeleton className="h-24 w-full rounded-xl" label="Campo" />
        <Skeleton className="h-10 w-32 rounded-pill" label="Botão" />
      </div>
      <div className="space-y-4 rounded-card border border-border bg-surface p-4 sm:p-5">
        <Skeleton className="h-5 w-40 rounded" label="Título" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" label="Paleta" />
          ))}
        </div>
      </div>
    </div>
  );
}