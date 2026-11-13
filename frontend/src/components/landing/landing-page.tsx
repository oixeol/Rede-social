import Link from 'next/link';
import { Home, Compass, MessageSquare, Bell, Users, Settings, ChevronDown } from 'lucide-react';

import { OrbitLogo } from '@/components/shell/orbit-logo';

const NAV_LINKS = [
  { href: '#inicio', label: 'Início' },
  { href: '#comunidade', label: 'Comunidades' },
  { href: '#explorar', label: 'Explorar' },
  { href: '#recursos', label: 'Recursos' },
  { href: '#sobre', label: 'Sobre' },
] as const;

const MOCK_NAV = [
  { icon: Home, label: 'Início', active: true },
  { icon: Compass, label: 'Explorar', active: false },
  { icon: MessageSquare, label: 'Mensagens', active: false },
  { icon: Bell, label: 'Conexões', active: false },
  { icon: Users, label: 'Comunidades', active: false },
  { icon: Settings, label: 'Ajustes', active: false },
] as const;

const TRENDS = [
  { label: 'EM ALTA', value: '#NovasConexões' },
  { label: 'COMUNIDADE', value: 'Gamers BR' },
  { label: 'PARA VOCÊ', value: 'Design & Criatividade' },
] as const;

export function LandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      <header className="relative z-20 flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Orbit — página inicial" className="shrink-0">
            <OrbitLogo size="lg" />
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Navegação principal">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted transition-colors hover:text-foreground px-3 py-2 rounded-md"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <Link
          href="/entrar"
          className="btn btn-primary hidden sm:inline-flex h-10 px-4"
        >
          Entrar
        </Link>
      </header>

      <main
        id="conteudo"
        className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1200px] grid-cols-1 items-center gap-12 px-4 sm:px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <div className="max-w-xl">
          <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-brand">
            <span aria-hidden="true" className="h-0.5 w-5 bg-brand" />
            Sua conexão começa aqui
          </p>

          <h1 className="mb-6 max-w-[540px] text-[clamp(40px,5vw,64px)] font-bold uppercase leading-[1.05] tracking-[-0.03em] text-foreground">
            Gente que
            <br />
            combina.
            <br />
            <span className="text-brand">Ideias que</span>
            <br />
            vibram.
          </h1>

          <p className="mb-8 max-w-[420px] text-base leading-relaxed text-muted">
            Um espaço para compartilhar o que você pensa, descobrir novos interesses e encontrar pessoas
            que têm tudo a ver com você. Do seu jeito, no seu ritmo.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/entrar"
              className="btn btn-primary h-11 px-6"
            >
              Entrar no Orbit
            </Link>
            <a
              href="#comunidade"
              className="btn btn-secondary h-11 px-6"
            >
              Ver a comunidade
              <ChevronDown className="size-4" aria-hidden="true" />
            </a>
          </div>

          <p id="sobre" className="mt-6 text-sm text-subtle">
            Conexões reais. Conversas sem roteiro. Um novo jeito de socializar.
          </p>
        </div>

        <div
          id="comunidade"
          aria-label="Prévia ilustrativa da interface do Orbit"
          className="relative flex min-h-[420px] items-center justify-center"
        >
          <div className="relative w-full max-w-[640px]">
            <div className="card overflow-hidden">
              <div className="flex h-11 items-center gap-2 border-b border-border px-3 text-xs text-muted">
                <span className="size-2 rounded-full bg-brand" />
                <span className="size-2 rounded-full bg-muted/30" />
                <span className="size-2 rounded-full bg-muted/30" />
                <span className="ml-2">orbit.social / comunidade</span>
              </div>

              <div className="grid h-[360px] grid-cols-[72px_1fr_0] gap-3 p-3 sm:grid-cols-[120px_1fr_100px]">
                <aside className="border-r border-border px-1 py-2 sm:px-2">
                  <div className="mb-3 text-sm font-bold sm:mb-4 sm:text-base">
                    orbit<span className="text-brand">.</span>
                  </div>
                  {MOCK_NAV.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={`w-full flex items-center gap-2 rounded-md px-2 py-2 text-xs sm:px-3 sm:py-2 sm:text-sm transition-colors ${
                        item.active
                          ? 'bg-brand-soft text-foreground border border-brand/30'
                          : 'text-muted hover:bg-surface-subtle hover:text-foreground'
                      }`}
                    >
                      <item.icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </aside>

                <section className="px-2 py-1 overflow-y-auto">
                  <div className="mb-3 text-sm font-bold sm:mb-4">Seu universo</div>
                  <div className="mb-3 rounded-md border border-border bg-surface-subtle/50 p-2 text-xs text-muted sm:mb-3 sm:p-3 sm:text-sm">
                    O que está passando pela sua cabeça?
                  </div>

                  <article className="flex gap-3 border-b border-border px-1 py-3 sm:py-4">
                    <div className="size-10 shrink-0 rounded-full bg-brand-soft" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="truncate text-sm text-foreground">marina.lima</strong>
                        <span className="shrink-0 text-xs text-subtle">· 12 min</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">
                        Finalmente encontrei uma galera que curte os mesmos jogos que eu.
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                        <span>♡ 128</span>
                        <span>◌ 24 comentários</span>
                        <span>↗</span>
                      </div>
                    </div>
                  </article>

                  <article className="flex gap-3 border-b border-border px-1 py-3 sm:py-4">
                    <div className="size-10 shrink-0 rounded-full bg-muted/10" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="truncate text-sm text-foreground">caio.dev</strong>
                        <span className="shrink-0 text-xs text-subtle">· 35 min</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">
                        Qual foi a última música que ficou presa na sua cabeça?
                      </p>
                      <div className="mt-2 flex h-24 min-w-[120px] items-center justify-center gap-4 rounded-lg bg-surface-subtle border border-border text-lg text-muted sm:h-32">
                        <span aria-hidden="true">♪</span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                        <span>♡ 86</span>
                        <span>◌ 19 comentários</span>
                        <span>↗</span>
                      </div>
                    </div>
                  </article>
                </section>

                <aside className="hidden border-l border-border py-2 pl-3 lg:block">
                  {TRENDS.map((trend) => (
                    <div key={trend.label} className="mb-4 text-xs text-subtle">
                      {trend.label}
                      <span className="mt-1 block text-sm text-foreground">{trend.value}</span>
                    </div>
                  ))}
                </aside>
              </div>
            </div>

            <div className="absolute -right-2 top-4 z-10 card px-3 py-2.5 shadow-popover sm:-right-4 sm:top-10 sm:px-4 sm:py-3 lg:-right-6">
              <strong className="flex items-center gap-1.5 text-sm sm:text-base">
                <span className="size-5 text-brand" aria-hidden="true">●</span>
                Novas conexões
              </strong>
              <p className="text-xs text-muted">Pessoas com seus interesses</p>
            </div>

            <div className="absolute -left-2 bottom-4 z-10 card px-3 py-2.5 shadow-popover sm:-left-4 sm:bottom-8 sm:px-4 sm:py-3 lg:-left-6">
              <strong className="text-sm sm:text-base">+ 2,4 mil</strong>
              <p className="text-xs text-muted">conversas acontecendo agora</p>
            </div>
          </div>
        </div>
      </main>

      <section
        id="recursos"
        className="relative z-10 mx-auto -mt-10 flex max-w-[1000px] flex-wrap justify-center gap-10 px-4 pb-16 text-sm text-muted sm:justify-start sm:gap-6"
      >
        <div className="min-w-[200px]">
          <strong className="mb-1 block text-lg text-foreground">Seu espaço</strong>
          Perfil com a sua identidade
        </div>
        <div className="min-w-[200px]">
          <strong className="mb-1 block text-lg text-foreground">Seus interesses</strong>
          Descubra novas comunidades
        </div>
        <div className="min-w-[200px]">
          <strong className="mb-1 block text-lg text-foreground">Suas conexões</strong>
          Converse com quem combina
        </div>
      </section>
    </div>
  );
}
