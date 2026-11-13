import type { Metadata } from 'next';
import Link from 'next/link';

import { LoginBackground } from '@/components/auth/login-background';
import { LoginQrActions } from '@/components/auth/login-qr-actions';
import { LoginQrPanel } from '@/components/auth/login-qr-panel';
import { OrbitLogo } from '@/components/shell/orbit-logo';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Entrar',
};

export default function EntrarPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#121214]">
      <LoginBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="px-6 pt-7 sm:px-10 sm:pt-9">
          <Link
            href="/"
            aria-label="Orbit – página inicial"
            className="inline-flex items-center gap-2 transition-opacity hover:opacity-85"
          >
            <OrbitLogo />
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-[880px] overflow-hidden rounded-[24px] border border-[#FF6A00]/35 bg-[#0D0D0D]/85 shadow-[0_0_70px_-12px_rgba(255,106,0,0.55),0_28px_70px_rgba(0,0,0,0.65)] backdrop-blur-md">
            <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
              <div className="px-6 py-8 sm:px-10 sm:py-10">
                <LoginForm />
              </div>

              <div className="flex flex-col justify-center border-t border-[#1A1A1C] px-6 py-8 sm:px-10 sm:py-10 lg:border-t-0 lg:border-l">
                <LoginQrPanel />
                <LoginQrActions />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
