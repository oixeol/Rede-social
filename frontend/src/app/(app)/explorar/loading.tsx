import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1180px]" role="status" aria-live="polite" aria-busy="true">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-12 rounded bg-surface-subtle animate-pulse" />
          <div className="h-9 w-72 rounded bg-surface-subtle animate-pulse" />
        </div>
      </div>
      <section className="space-y-5">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-1" role="tablist" aria-label="Filtro do feed">
          <Skeleton className="min-h-11 w-24 rounded-pill" label="Aba" />
          <Skeleton className="min-h-11 w-28 rounded-pill" label="Aba" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <article key={i} className="post-card rounded-card border border-border bg-surface overflow-hidden animate-pulse">
            <div className="flex items-start gap-3 p-4">
              <Skeleton className="size-11 rounded-full" label="Avatar" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32 rounded" label="Nome" />
                <Skeleton className="h-3 w-24 rounded" label="Data" />
              </div>
            </div>
            <Skeleton className="aspect-video w-full" rounded="md" label="Mídia" />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-10 rounded-full" label="Reação" />
                <Skeleton className="size-10 rounded-full" label="Reação" />
                <Skeleton className="size-10 rounded-full" label="Reação" />
                <Skeleton className="size-10 rounded-full" label="Reação" />
              </div>
              <Skeleton className="h-4 w-24 rounded" label="Contador" />
              <Skeleton className="h-4 w-3/4 rounded" label="Legenda" />
              <Skeleton className="h-4 w-1/2 rounded" label="Legenda" />
            </div>
          </article>
        ))}
        <div className="flex justify-center py-4">
          <Skeleton className="h-10 w-36 rounded-pill" label="Carregar mais" />
        </div>
      </section>
    </div>
  );
}