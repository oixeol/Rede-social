import type { Route } from 'next';
import Link from 'next/link';

/**
 * Landing page do Vibra.
 *
 * Réplica em React da página de apresentação estática (`docs/landing/index.html`),
 * mantendo o visual escuro, o mock da interface e as mesmas seções.
 * A única saída é o CTA "Entrar", que leva ao login e daí para o app.
 */

const NAV_LINKS = [
  { href: '#inicio', label: 'Início' },
  { href: '#comunidade', label: 'Comunidades' },
  { href: '#explorar', label: 'Explorar' },
  { href: '#recursos', label: 'Recursos⌄' },
  { href: '#sobre', label: 'Sobre' },
] as const;

const MOCK_NAV = [
  { icon: '⌂', label: 'Início', active: true },
  { icon: '⌕', label: 'Explorar', active: false },
  { icon: '✉', label: 'Mensagens', active: false },
  { icon: '♡', label: 'Conexões', active: false },
  { icon: '▦', label: 'Comunidades', active: false },
  { icon: '⚙', label: 'Ajustes', active: false },
] as const;

const TRENDS = [
  { label: 'EM ALTA', value: '#NovasConexões' },
  { label: 'COMUNIDADE', value: 'Gamers BR' },
  { label: 'PARA VOCÊ', value: 'Design & Criatividade' },
] as const;

export function LandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#090909] text-[#fffaf6]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-[190px] top-[90px] size-[680px] rounded-full bg-[radial-gradient(circle,rgba(255,105,26,.22),rgba(255,105,26,.04)_48%,transparent_70%)] blur-[10px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ff9a60_1px,transparent_1px),radial-gradient(#ffffff_1px,transparent_1px)] bg-[length:83px_83px,137px_137px] bg-[position:0_0,37px_21px] opacity-20" />
      </div>

      <header className="relative z-20 flex h-[86px] items-center justify-between border-b border-white/6 px-[clamp(22px,5vw,82px)]">
        <div className="flex items-center gap-[11px] text-[25px] font-extrabold tracking-[-1.2px]">
          <span
            aria-hidden="true"
            className="grid size-[35px] place-items-center rounded-[12px] bg-[linear-gradient(145deg,#ff9a50,#f04a0a)] text-[21px] font-black text-[#1a0d07] shadow-[0_5px_22px_#ff681a55]"
          >
            v.
          </span>
          vibra
        </div>

        <nav aria-label="Navegação principal" className="hidden items-center gap-[clamp(15px,2.2vw,35px)] lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-semibold text-[#e8ded8] transition-colors hover:text-[#ff8b4c]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Link
          href={'/entrar' as Route}
          className="rounded-full bg-[#fff8f3] px-5 py-3 text-[13px] font-extrabold text-[#1a0d07] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#ff8a4b]"
        >
          Entrar
        </Link>
      </header>

      <main
        id="conteudo"
        className="relative z-10 mx-auto grid min-h-[650px] max-w-[1320px] grid-cols-1 items-center gap-[25px] px-[5vw] pb-[100px] pt-[65px] lg:grid-cols-[.85fr_1.15fr]"
      >
        <div className="max-w-[510px] pb-[15px]">
          <p className="mb-6 inline-flex items-center gap-[9px] text-[11px] font-extrabold uppercase tracking-[2px] text-[#ff9864]">
            <span aria-hidden="true" className="h-0.5 w-6 bg-[#ff6a1a]" />
            Sua conexão começa aqui
          </p>

          <h1 className="mb-[25px] max-w-[570px] font-sans text-[clamp(48px,5.7vw,78px)] font-black uppercase leading-[.91] tracking-[-4px]">
            Gente que
            <br />
            combina.
            <br />
            <span className="text-[#ff742b]">Ideias que</span>
            <br />
            vibram.
          </h1>

          <p className="mb-8 max-w-[440px] text-[16px] leading-[1.75] text-[#d2c5bd]">
            Um espaço para compartilhar o que você pensa, descobrir novos interesses e encontrar pessoas
            que têm tudo a ver com você. Do seu jeito, no seu ritmo.
          </p>

          <div className="flex flex-wrap gap-[13px]">
            <Link
              href={'/entrar' as Route}
              className="inline-flex items-center justify-center gap-[10px] rounded-[12px] bg-[linear-gradient(135deg,#ff9b59,#ff6418)] px-[22px] py-4 text-[14px] font-extrabold text-[#1a0b04] shadow-[0_12px_35px_#ff641833] transition-[transform,filter] hover:-translate-y-[3px] hover:brightness-110"
            >
              Entrar no Vibra
            </Link>
            <a
              href="#comunidade"
              className="inline-flex items-center justify-center gap-[10px] rounded-[12px] border border-white/20 bg-white/4 px-[22px] py-4 text-[14px] font-extrabold text-[#fff4ed] transition-[transform,filter] hover:-translate-y-[3px] hover:brightness-110"
            >
              Ver a comunidade ↗
            </a>
          </div>

          <p id="sobre" className="mt-[18px] text-[11px] text-[#887b73]">
            Conexões reais. Conversas sem roteiro. Um novo jeito de socializar.
          </p>
        </div>

        <div
          id="comunidade"
          aria-label="Prévia ilustrativa da interface do Vibra"
          className="relative flex min-h-[490px] items-center justify-center"
        >
          <div aria-hidden="true" className="absolute size-[440px] rounded-full bg-[#f45c1740] blur-[75px]" />

          <div className="relative h-[280px] w-full max-w-[650px] rounded-[15px] border border-white/17 bg-[linear-gradient(145deg,#27211e,#100e0d_65%)] p-[9px] shadow-[0_35px_90px_#000a,0_0_0_8px_#ffffff08] sm:h-[370px] sm:rounded-[24px] sm:p-[15px] lg:h-[420px] lg:[transform:perspective(1100px)_rotateY(-8deg)_rotateX(3deg)]">
            <div className="flex h-[30px] items-center gap-[6px] border-b border-white/10 px-2 pb-3 text-[10px] text-[#9e9189]">
              <span className="size-[7px] rounded-full bg-[#ff7040]" />
              <span className="size-[7px] rounded-full bg-[#e9a24e]" />
              <span className="size-[7px] rounded-full bg-[#6e9a63]" />
              <span className="ml-2">vibra.social / comunidade</span>
            </div>

            <div className="grid h-[calc(100%-30px)] grid-cols-[85px_1fr_0] gap-[6px] pt-3 sm:gap-3 lg:grid-cols-[145px_1fr_130px]">
              <aside className="border-r border-white/7 px-1 py-[5px] sm:px-2">
                <div className="mb-3 text-[12px] font-black sm:mb-5 sm:text-[16px]">
                  vibra<span className="text-[#ff762d]">.</span>
                </div>
                {MOCK_NAV.map((item) => (
                  <div
                    key={item.label}
                    className={`my-1 rounded-[7px] px-1 py-[7px] text-[7px] sm:px-2 sm:py-[9px] sm:text-[10px] ${
                      item.active
                        ? 'border border-[#ff6a1a35] bg-[#ff6a1a25] text-white'
                        : 'text-[#b6aaa2]'
                    }`}
                  >
                    <span aria-hidden="true">{item.icon}</span> &nbsp;{item.label}
                  </div>
                ))}
              </aside>

              <section className="px-[5px] py-1">
                <div className="mb-3 text-[12px] font-extrabold sm:mb-[14px] sm:text-[15px]">Seu universo</div>
                <div className="mb-3 rounded-[10px] border border-white/9 bg-white/5 p-2 text-[8px] text-[#9c8e86] sm:mb-3 sm:p-3 sm:text-[10px]">
                  O que está passando pela sua cabeça?
                </div>

                <article className="flex gap-[9px] border-b border-white/8 px-[3px] py-2 sm:py-3">
                  <div className="size-[27px] shrink-0 rounded-full bg-[linear-gradient(140deg,#ff9b59,#79351e)]" />
                  <div>
                    <strong className="text-[10px]">marina.lima</strong>{' '}
                    <small className="text-[8px] text-[#84776f]">· há 12 min</small>
                    <p className="my-1.5 text-[7px] leading-[1.5] text-[#d2c5bd] sm:text-[9px]">
                      Finalmente encontrei uma galera que curte os mesmos jogos que eu. ✨
                    </p>
                    <div className="text-[9px] text-[#ff9a62]">♡ 128 &nbsp;&nbsp; ◌ 24 comentários &nbsp;&nbsp; ↗</div>
                  </div>
                </article>

                <article className="flex gap-[9px] border-b border-white/8 px-[3px] py-2 sm:py-3">
                  <div className="size-[27px] shrink-0 rounded-full bg-[linear-gradient(140deg,#f7b8a0,#7346a1)]" />
                  <div>
                    <strong className="text-[10px]">caio.dev</strong>{' '}
                    <small className="text-[8px] text-[#84776f]">· há 35 min</small>
                    <p className="my-1.5 text-[7px] leading-[1.5] text-[#d2c5bd] sm:text-[9px]">
                      Qual foi a última música que ficou presa na sua cabeça?
                    </p>
                    <div className="mt-2 grid h-[52px] place-items-center rounded-[8px] bg-[linear-gradient(130deg,#442014,#ff742b_48%,#1d1110)] text-[25px] text-white sm:h-[90px]">
                      ♫
                    </div>
                    <div className="mt-[7px] text-[9px] text-[#ff9a62]">♡ 86 &nbsp;&nbsp; ◌ 19 comentários &nbsp;&nbsp; ↗</div>
                  </div>
                </article>
              </section>

              <aside id="explorar" className="hidden border-l border-white/7 py-1.5 pl-2.5 lg:block">
                {TRENDS.map((trend) => (
                  <div key={trend.label} className="mb-[14px] text-[9px] text-[#8d8179]">
                    {trend.label}
                    <b className="mt-1 block text-[10px] text-[#eee2db]">{trend.value}</b>
                  </div>
                ))}
              </aside>
            </div>
          </div>

          <div className="absolute right-[-3px] top-3 z-20 rounded-[14px] border border-white/15 bg-[#211a17ed] px-[10px] py-[9px] shadow-[0_15px_35px_#0008] backdrop-blur-[12px] sm:right-[-5px] sm:top-[50px] sm:px-4 sm:py-[13px]">
            <strong className="block text-[10px] sm:text-[12px]">
              <span className="mr-1.5 text-[19px] text-[#ff8b4b]">✦</span>
              Novas conexões
            </strong>
            <span className="text-[10px] text-[#b5a69d]">Pessoas com seus interesses</span>
          </div>

          <div className="absolute bottom-2 left-[-2px] z-20 rounded-[14px] border border-white/15 bg-[#211a17ed] px-[10px] py-[9px] shadow-[0_15px_35px_#0008] backdrop-blur-[12px] sm:bottom-[35px] sm:left-[-5px] sm:px-4 sm:py-[13px]">
            <strong className="block text-[10px] sm:text-[12px]">+ 2,4 mil</strong>
            <span className="text-[10px] text-[#b5a69d]">conversas acontecendo agora</span>
          </div>
        </div>
      </main>

      <section
        id="recursos"
        className="relative z-10 mx-auto -mt-5 flex max-w-[1050px] flex-wrap justify-center gap-[45px] px-[25px] pb-10 text-[12px] text-[#a99a91] max-sm:justify-start max-sm:gap-[25px]"
      >
        <div>
          <b className="mb-[3px] block text-[17px] text-[#fff0e8]">Seu espaço</b>
          Perfil com a sua identidade
        </div>
        <div>
          <b className="mb-[3px] block text-[17px] text-[#fff0e8]">Seus interesses</b>
          Descubra novas comunidades
        </div>
        <div>
          <b className="mb-[3px] block text-[17px] text-[#fff0e8]">Suas conexões</b>
          Converse com quem combina
        </div>
      </section>
    </div>
  );
}
