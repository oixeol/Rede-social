import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/database';

/**
 * Cliente Supabase para componentes Client-side.
 *
 * Usa apenas a chave pública (NEXT_PUBLIC_SUPABASE_ANON_KEY /
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). A service role NUNCA entra no bundle.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function requireConfig(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
}

let _browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createBrowserSupabaseClient() {
  if (!_browserClient) {
    const { url, key } = requireConfig();
    _browserClient = createBrowserClient<Database>(url, key);
  }
  return _browserClient;
}

export type { Database };