import type { Metadata } from 'next';

import { Crown, Heart, Lock, MessageCircle, Shield, Sparkles, Star, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Orbit Premium',
  description: 'Desbloqueie recursos exclusivos, personalize seu perfil e apoie o Orbit.',
};

const BENEFITS = [
  {
    icon: Crown,
    title: 'Perfil Premium',
    description: 'Badge exclusivo, tema dourado e cores personalizadas no seu perfil.',
  },
  {
    icon: Sparkles,
    title: 'Temas exclusivos',
    description: 'Paleta de cores dourada, gradientes especiais e fundos animados.',
  },
  {
    icon: Shield,
    title: 'Privacidade avançada',
    description: 'Modo fantasma aprimorado, visualização anônima de stories e mais controle.',
  },
  {
    icon: Star,
    title: 'Destaques ilimitados',
    description: 'Crie quantos destaques quiser no seu perfil sem limite.',
  },
  {
    icon: Users,
    title: 'Comunidades prioritárias',
    description: 'Crie comunidades privadas, moderação avançada e analytics.',
  },
  {
    icon: Heart,
    title: 'Reações premium',
    description: 'Pack de reações animadas e exclusivas para posts e mensagens.',
  },
  {
    icon: MessageCircle,
    title: 'Mensagens diretas expandidas',
    description: 'Arquivo ilimitado, fixar conversas importantes e filtros inteligentes.',
  },
  {
    icon: Lock,
    title: 'Suporte prioritário',
    description: 'Atendimento mais rápido e canal direto com a equipe do Vibra.',
  },
] as const;

export default function VibraPremiumPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-brand-soft/20 p-8 md:p-12">
        <div className="relative text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand/20 px-4 py-1.5 text-sm font-semibold text-brand">
            <Crown className="size-4" aria-hidden="true" />
            Orbit Premium
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-[-0.02em] text-foreground sm:text-5xl md:text-6xl">
            Desbloqueie a experiência completa
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-muted">
            Personalize seu perfil, acesse recursos exclusivos e apoie o desenvolvimento do Orbit.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              type="button"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-6 py-3 text-base font-bold text-on-brand shadow-[0_4px_16px_var(--orbit-brand)/30] transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              disabled
            >
              <Crown className="size-5" aria-hidden="true" />
              Assinar Premium <span className="text-xs opacity-70">(em breve)</span>
            </button>
            <a
              href="#beneficios"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Saiba mais
            </a>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="beneficios" className="mt-12 scroll-mt-8">
        <header className="text-center">
          <p className="text-xs font-bold tracking-[0.18em] text-brand uppercase">Recursos</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl">
            Tudo que o Premium oferece
          </h2>
          <p className="mt-3 max-w-2xl mx-auto text-muted">
            Recursos pensados para quem quer se expressar sem limites e fazer parte da comunidade mais próxima do Orbit.
          </p>
        </header>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {BENEFITS.map((benefit, index) => (
            <li key={index} className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 transition-all hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5">
              <div className="relative flex gap-4">
                <span className="flex shrink-0 size-12 items-center justify-center rounded-xl bg-brand text-on-brand">
                  <benefit.icon className="size-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-foreground">{benefit.title}</h3>
                  <p className="mt-1 text-sm text-muted">{benefit.description}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Footer CTA */}
      <section className="mt-16 relative overflow-hidden rounded-3xl border border-border bg-brand-soft/10 p-8 md:p-12 text-center">
        <div className="relative">
          <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
            Pronto para brilhar?
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-muted">
            O Orbit Premium chega em breve. Inscreva-se na lista de espera para ser avisado no lançamento e ganhar um mês grátis.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <p className="inline-flex min-h-12 items-center rounded-xl border border-border bg-background px-4 text-sm text-muted">
              Lista de espera em breve
            </p>
            <button
              type="button"
              disabled
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-base font-bold text-on-brand opacity-65 shadow-[0_4px_16px_var(--orbit-brand)/30]"
            >
              <Crown className="size-4" aria-hidden="true" />
              Entrar na lista de espera
            </button>
          </div>
          <p className="mt-4 text-xs text-muted">
            Ao se inscrever, você concorda com nossos Termos e com a Política de Privacidade do Orbit.
          </p>
        </div>
      </section>
    </div>
  );
}