import { Skeleton } from '@/components/ui/skeleton';

export function InicioSkeleton() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,620px)_minmax(300px,340px)] xl:justify-center">
      <section aria-label="Publicações" className="min-w-0 space-y-4">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-2" role="tablist" aria-label="Filtro do feed">
          <Skeleton className="h-10 w-20 rounded-pill" label="Aba" />
          <Skeleton className="h-10 w-24 rounded-pill" label="Aba" />
          <Skeleton className="h-10 w-24 rounded-pill" label="Aba" />
        </div>
        <div className="h-[calc(100dvh-132px)] min-h-[620px]">
          <div className="flex min-h-[calc(100dvh-132px)] items-center justify-center">
            <div
              className="aspect-[9/16] max-w-full overflow-hidden bg-surface-subtle/20"
              style={{ width: 'min(100%, calc((100dvh - 196px) * 9 / 16))' }}
            >
              <Skeleton className="size-full rounded-none" label="Publicação" />
            </div>
          </div>
        </div>
      </section>

      <aside className="hidden space-y-5 xl:block" aria-label="Descoberta no Vibra">
        <div className="rounded-card border border-brand/20 bg-surface p-5 space-y-3">
          <Skeleton className="h-5 w-28 rounded" label="Premium" />
          <Skeleton className="h-6 w-48 rounded" label="Título" />
          <Skeleton className="h-12 w-full rounded" label="Texto" />
          <Skeleton className="h-9 w-32 rounded-pill" label="Botão" />
        </div>
        <div className="rounded-card border border-border bg-surface p-4 space-y-4">
          <Skeleton className="h-6 w-28 rounded" label="Título" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" label="Avatar" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24 rounded" label="Nome" />
                <Skeleton className="h-3 w-16 rounded" label="Usuário" />
              </div>
              <Skeleton className="h-8 w-20 rounded-pill" label="Botão" />
            </div>
          ))}
        </div>
        <div className="rounded-card border border-border bg-surface p-4 space-y-3">
          <Skeleton className="h-6 w-32 rounded" label="Título" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full rounded-pill" label="Assunto" />
          ))}
        </div>
      </aside>
    </div>
  );
}
