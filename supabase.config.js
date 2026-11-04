'use strict';

/**
 * Configuração do Supabase para migração do SQLite.
 * 
 * Configure estas variáveis de ambiente:
 * - SUPABASE_URL: URL do projeto Supabase (ex: https://xxxxx.supabase.co)
 * - SUPABASE_ANON_KEY: Chave anônima do projeto
 * - SUPABASE_SERVICE_ROLE_KEY: Chave de serviço (para admin operations)
 * - SUPABASE_DB_PATH: Caminho opcional do dump do SQLite existente
 * 
 * O Supabase já possui autenticação built-in, então manteremos:
 * - Email/password auth
 * - RLS (Row Level Security) policies
 * - Triggers para timestamps automáticos
 */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  SUPABASE_URL e SUPABASE_ANON_KEY não configurados.');
  console.warn('   Defina variáveis de ambiente para usar Supabase.');
}

module.exports = {
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  isUsingSupabase: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
};