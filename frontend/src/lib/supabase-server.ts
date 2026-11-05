import 'server-only';

import { createServerClient } from '@supabase/ssr';

import { cookies } from 'next/headers';

import type { Database } from '@/types/database';

/**
 * Cliente Supabase para Server Components, Route Handlers e Actions.
 *
 * Usa apenas a chave pública (NEXT_PUBLIC_SUPABASE_ANON_KEY /
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). A service role NUNCA entra aqui.
 *
 * O refresh de sessão acontece no middleware/proxy via `createServerClient`
 * com `setAll` funcional.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function requireConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
}

export async function createServerSupabaseClient() {
  const { url, key } = requireConfig();

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem escrever cookies.
          // O refresh de sessão deve ocorrer no middleware (proxy.ts).
        }
      },
    },
  });
}

export type { Database };