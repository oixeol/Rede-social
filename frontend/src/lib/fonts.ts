import localFont from 'next/font/local';

export const inter = localFont({
  src: [
    {
      path: '../assets/fonts/inter-latin-variable.woff2',
      style: 'normal',
      weight: '100 900',
    },
  ],
  display: 'swap',
  variable: '--font-inter',
  fallback: ['system-ui', 'sans-serif'],
});

export const lora = localFont({
  src: [
    {
      path: '../assets/fonts/lora-latin-variable.woff2',
      style: 'normal',
      weight: '400 700',
    },
    {
      path: '../assets/fonts/lora-latin-variable-italic.woff2',
      style: 'italic',
      weight: '400 700',
    },
  ],
  display: 'swap',
  variable: '--font-lora',
  fallback: ['Georgia', 'serif'],
});
