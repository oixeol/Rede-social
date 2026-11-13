import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { headers } from 'next/headers';
import { connection } from 'next/server';

import { inter } from '@/lib/fonts';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Orbit',
    template: '%s · Orbit',
  },
  description: 'Rede social e descoberta de afinidades para adultos, com privacidade por padrão.',
  applicationName: 'Orbit',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF9' },
    { media: '(prefers-color-scheme: dark)', color: '#0E0E10' },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <body className={inter.variable}>
        <Script src="/theme-init.js" strategy="beforeInteractive" nonce={nonce} />
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
