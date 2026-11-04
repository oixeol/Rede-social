import { Skeleton } from '@/components/ui/skeleton';

export function InicioSkeleton() {
  return (
    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,700px)_minmax(280px,320px)] xl:justify-center">
      <section aria-label="Publicações" className="min-w-0 space-y-5">
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

      <aside className="hidden xl:block w-full max-w-xs sticky top-20 space-y-5" aria-label="Painel lateral">
        <div className="rounded-card border border-border bg-surface p-4 space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28 rounded" label="Título" />
            <Skeleton className="h-4 w-16 rounded-pill" label="Link" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" label="Avatar" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24 rounded" label="Nome" />
                <Skeleton className="h-3 w-20 rounded" label="User" />
              </div>
              <Skeleton className="h-8 w-20 rounded-pill" label="Botão" />
            </div>
          ))}
        </div>
        <div className="rounded-card border border-border bg-surface p-4 space-y-4 animate-pulse">
          <Skeleton className="h-6 w-32 rounded" label="Título" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-pill" label="Assunto" />
          ))}
        </div>
        <div className="rounded-card border border-border bg-surface p-4 space-y-3 animate-pulse">
          <Skeleton className="h-6 w-24 rounded" label="Título" />
          <Skeleton className="h-12 w-full rounded" label="Texto" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-24 rounded-pill" label="Link" />
            <Skeleton className="h-5 w-20 rounded-pill" label="Link" />
            <Skeleton className="h-5 w-28 rounded-pill" label="Link" />
          </div>
        </div>
      </aside>
    </div>
  );
}