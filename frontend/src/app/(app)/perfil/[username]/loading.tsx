import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1291px]" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando perfil…</span>

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_355px]">
        <section className="min-w-0" aria-label="Carregando conteúdo do perfil">
          {/* Capa do perfil */}
          <Skeleton
            className="h-48 w-full rounded-[26px] sm:h-60 xl:h-[250px]"
            label="Capa do perfil"
          />

          {/* Avatar + informações */}
          <div className="relative z-10 -mt-12 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 px-4 sm:-mt-16 sm:px-6">
            <Skeleton
              className="size-28 rounded-full border-4 border-surface"
              label="Foto de perfil"
            />

            <div className="min-w-0 space-y-4 pt-12 sm:pt-16">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-7 w-64 rounded" label="Nome" />
                  <Skeleton className="h-5 w-32 rounded" label="Usuário" />
                </div>
                <Skeleton className="h-10 w-36 rounded-pill" label="Botão de ação" />
              </div>

              <Skeleton className="h-5 w-full max-w-xl rounded" label="Bio" />
              <Skeleton className="h-6 w-48 rounded" label="Bio contínua" />

              <nav className="flex flex-wrap gap-6" aria-label="Carregando estatísticas do perfil">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-5 w-24 rounded"
                    label="Estatística"
                  />
                ))}
              </nav>
            </div>
          </div>

          {/* Abas */}
          <div className="mt-8 px-4 sm:px-6" aria-label="Carregando abas do perfil">
            <div className="flex gap-1 border-b border-border pb-0.5">
              {['Publicações', 'Reels', 'Fotos', 'Curtidas'].map((label) => (
                <Skeleton
                  key={label}
                  className="h-8 w-28 rounded-pill"
                  label={label}
                />
              ))}
            </div>

            {/* Grade de publicações */}
            <div
              className="mt-6 grid grid-cols-2 gap-3 sm:gap-4"
              role="list"
              aria-label="Carregando publicações"
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} role="listitem">
                  <Skeleton
                    className="aspect-square w-full rounded-xl"
                    label="Publicação"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Informações laterais */}
        <aside
          className="hidden space-y-4 xl:sticky xl:top-20 xl:block"
          aria-label="Carregando informações do perfil"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-44 rounded-2xl"
              label="Cartão lateral"
            />
          ))}
        </aside>
      </div>
    </div>
  );
}