import { Skeleton } from '@/components/ui/skeleton';

export default function PostDetailLoading() {
  return (
    <article className="post-detail-skeleton max-w-2xl mx-auto animate-pulse space-y-4" aria-busy="true" aria-label="Carregando publicação">
      {/* Post header skeleton */}
      <div className="flex items-start gap-3 p-4">
        <Skeleton className="size-11 rounded-full" label="Avatar" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32 rounded" label="Nome do autor" />
          <Skeleton className="h-3 w-24 rounded" label="Data" />
        </div>
      </div>

      {/* Media skeleton */}
      <Skeleton className="aspect-video w-full rounded-md" label="Mídia da publicação" />

      {/* Post content skeleton */}
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

      {/* Comments section skeleton */}
      <section className="mt-6 space-y-4" aria-label="Comentários">
        <Skeleton className="h-5 w-36 rounded" label="Título comentários" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-9 rounded-full" label="Avatar" />
              <div className="flex-1 space-y-2">
                <div className="flex items-baseline gap-2">
                  <Skeleton className="h-4 w-24 rounded" label="Nome" />
                  <Skeleton className="h-3 w-20 rounded" label="Data" />
                </div>
                <Skeleton className="h-4 w-3/4 rounded" label="Texto do comentário" />
                <Skeleton className="h-4 w-1/2 rounded" label="Texto do comentário" />
              </div>
            </div>
          ))}
        </div>

        {/* Comment form skeleton */}
        <div className="flex items-start gap-3">
          <Skeleton className="size-9 rounded-full shrink-0" label="Avatar" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-10 w-full rounded-xl" label="Campo de comentário" />
            <div className="flex justify-end">
              <Skeleton className="h-9 w-24 rounded-full" label="Botão comentar" />
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}