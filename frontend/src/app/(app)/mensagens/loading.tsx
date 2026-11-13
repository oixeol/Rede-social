import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface md:flex-row"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Space Rail (left) */}
      <aside className="flex min-h-0 flex-col overflow-hidden border-border bg-surface-raised md:w-[72px] md:shrink-0 md:border-r" aria-hidden="true">
        <div className="shrink-0 border-b border-border p-3">
          <Skeleton className="size-11 rounded-xl" label="Conversas diretas" />
          <Skeleton className="mt-2 size-11 rounded-xl" label="Criar espaço" />
        </div>
        <nav className="flex-1 overflow-y-auto p-2" aria-hidden="true">
          <ul className="space-y-1" role="list">
            {Array.from({ length: 4 }).map((_, index) => (
              <li key={index}>
                <Skeleton className="w-full size-11 rounded-xl" label="Espaço" />
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Navigation Pane (middle) */}
      <aside className="flex min-h-0 flex-col overflow-hidden border-border bg-surface md:w-[320px] md:shrink-0 md:border-r" aria-hidden="true">
        <div className="shrink-0 border-b border-border p-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-20" label="Título" />
            <Skeleton className="h-5 w-32" label="Canais" />
          </div>
          <Skeleton className="mt-4 h-10 w-full rounded-lg" label="Busca" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="w-full size-11 rounded-xl mb-2" label="Canal" />
          ))}
        </div>
      </aside>

      {/* Main Conversation Pane */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background" aria-hidden="true">
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-5 py-3">
          <Skeleton className="size-11 rounded-[34%]" label="Avatar" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" label="Nome" />
            <Skeleton className="h-3 w-20" label="Status" />
          </div>
        </div>
        <div className="flex flex-1 items-end justify-center p-6">
          <div className="w-full max-w-3xl space-y-4">
            <Skeleton className="ml-auto h-16 w-2/5 rounded-2xl" label="Mensagem" />
            <Skeleton className="h-16 w-2/5 rounded-2xl" label="Mensagem" />
            <Skeleton className="ml-auto h-16 w-1/3 rounded-2xl" label="Mensagem" />
          </div>
        </div>
        <div className="shrink-0 border-t border-border bg-surface p-4">
          <Skeleton className="h-12 w-full rounded-2xl" label="Campo de mensagem" />
        </div>
      </section>
    </div>
  );
}