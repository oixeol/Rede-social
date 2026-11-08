import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1291px]" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando perfil…</span>

      <div className="grid min-w-0 items-start gap-[22px] xl:grid-cols-[minmax(0,872px)_354px]">
        {/* Coluna central */}
        <section className="min-w-0" aria-label="Carregando conteúdo do perfil">
          {/* Banner */}
          <Skeleton
            className="h-[207px] w-full rounded-[22px] border border-border"
            label="Capa do perfil"
          />

          {/* Avatar + identidade */}
          <div className="relative -mt-[43px] flex items-start gap-5">
            <Skeleton
              className="size-[150px] shrink-0 rounded-full border-[3px] border-brand"
              label="Foto de perfil"
            />

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <Skeleton className="h-6 w-56 rounded" label="Nome" />
                  <Skeleton className="h-4 w-32 rounded" label="Usuário" />
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Skeleton className="h-11 w-28 rounded-lg" label="Botão de ação" />
                  <Skeleton className="h-11 w-32 rounded-lg" label="Compartilhar" />
                  <Skeleton className="size-11 rounded-lg" label="Mais opções" />
                </div>
              </div>

              <Skeleton className="mt-2 h-5 w-full max-w-xl rounded" label="Bio" />

              <div className="mt-3">
                <nav className="flex flex-wrap items-center gap-x-8 gap-y-1" aria-label="Carregando estatísticas do perfil">
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
          </div>

          {/* Abas */}
          <div className="mt-4" aria-label="Carregando abas do perfil">
            <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
              {['Publicações', 'Instantes', 'Fotos', 'Curtidas'].map((label) => (
                <Skeleton
                  key={label}
                  className="h-11 flex-1 rounded-lg"
                  label={label}
                />
              ))}
            </div>

            {/* Grade de publicações (2 colunas desktop) */}
            <div
              className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4"
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

        {/* Coluna direita (escondida <1280) */}
        <aside className="hidden min-w-0 space-y-4 xl:block" aria-label="Carregando informações laterais">
          {/* Sobre mim */}
          <Skeleton className="h-40 w-full rounded-2xl border border-border" label="Sobre mim" />
          {/* Destaques */}
          <Skeleton className="h-36 w-full rounded-2xl border border-border" label="Destaques" />
          {/* Sugestões */}
          <Skeleton className="h-48 w-full rounded-2xl border border-border" label="Sugestões para você" />
        </aside>
      </div>
    </div>
  );
}