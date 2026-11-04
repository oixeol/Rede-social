import { InicioSkeleton } from './loading-skeleton';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1180px]" role="status" aria-live="polite" aria-busy="true">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-12 rounded bg-surface-subtle animate-pulse" />
          <div className="h-9 w-72 rounded bg-surface-subtle animate-pulse" />
        </div>
      </div>
      <InicioSkeleton />
    </div>
  );
}