import { getMe } from '@/lib/server-api';
import { redirect } from 'next/navigation';
import AppShell from './app-shell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let meResponse;
  try {
    meResponse = await getMe();
  } catch (error) {
    // Unauthenticated – redirect to login
    redirect('/entrar');
  }

  const palette = meResponse.themePalette ?? 'orange';

  return (
    <AppShell me={meResponse} dataPalette={palette}>
      {children}
    </AppShell>
  );
}