import { Brand } from '@/components/ui/brand';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/80 backdrop-blur-sm px-4 lg:px-8">
        <Brand />
      </header>

      <main id="conteudo" className="flex-1 pt-16 px-4 lg:px-8 py-10 flex items-center justify-center">
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Carregando a página de entrada"
          className="w-full max-w-md"
        >
          <div className="text-center mb-8 space-y-3" aria-hidden="true">
            <Skeleton rounded="full" className="h-9 w-64 mx-auto" />
            <Skeleton className="h-4 w-72 mx-auto" />
          </div>
          <div className="space-y-4 p-6 rounded-card border border-border bg-surface" aria-hidden="true">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
