import type { Metadata } from 'next';

import { Brand } from '@/components/ui/brand';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { SignupForm } from './signup-form';

export const metadata: Metadata = {
  title: 'Cadastrar-se',
};

export default function CadastrarPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/80 backdrop-blur-sm px-4 lg:px-8">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <main id="conteudo" className="flex-1 pt-16 px-4 lg:px-8 py-10 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Criar conta no Vibra</h1>
            <p className="mt-2 text-sm text-muted">Preencha seus dados para começar</p>
          </div>
          <SignupForm />
        </div>
      </main>
    </div>
  );
}