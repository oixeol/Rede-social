# Migração para Supabase - Guia de Implementação

## Status: ✅ Schema criado, aguardando configuração do projeto

## O que foi criado

### 1. Schema PostgreSQL (`/supabase/migrations/20261103000000_initial_schema.sql`)
- Todas as 30 tabelas do SQLite migradas para PostgreSQL
- Índices e constraints apropriados
- Tipos ENUM para campos limitados (`report_status`, `identity_status`, `conversation_kind`, etc.)

### 2. Cliente Supabase (`/frontend/src/lib/supabase.ts`)
- Configuração do cliente para SSR com `@supabase/ssr`

### 3. Tipos TypeScript (`/frontend/src/types/database.ts`)
- Definições de tipos para todas as tabelas

### 4. Scripts de migração (`/qa/`)
- `migrate-sqlite-to-supabase.mjs` - Script Node.js para migrar dados
- `dump-sqlite-to-postgres.sql` - Template de dump SQL

## Passos a seguir

### 1. Criar projeto Supabase
```bash
# Instalar CLI
npm install -g supabase@latest

# Inicializar (já feito)
supabase init
```

### 2. Configurar credenciais
Criar `frontend/.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Aplicar schema ao Supabase
```bash
# Via CLI local (recomendado)
supabase db push --file supabase/migrations/20261103000000_initial_schema.sql

# Ou via dashboard → SQL Editor
# Copiar todo o conteúdo do arquivo .sql
```

### 4. Executar migração de dados
```bash
# Do diretório do projeto
cd /c/Vibe
node qa/migrate-sqlite-to-supabase.mjs

# Ou manualmente com psql:
# 1. Exportar SQLite: sqlite3 data/vibra.db ".dump" > dump.sql
# 2. Importar dados temporariamente como tabelas _sqlite_*
# 3. Executar o template de INSERT
```

### 5. Configurar Autenticação
No painel do Supabase → **Authentication**:
- Habilitar **External OAuth** se necessário
- Configurar **URL de redirecionamento**: `http://localhost:3000`

### 6. Configurar Storage
No painel do Supabase → **Storage**:
- Criar bucket `uploads`
- Configurar política de público: `public`

### 7. Habilitar Row Level Security (RLS)
```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
-- ... repetir para todas as tabelas

-- Políticas básicas de exemplo
CREATE POLICY "public_users" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "authenticated_posts" ON public.posts
  FOR SELECT USING (true);
```

### 8. Migrar autenticação do usuário
O Supabase Auth substitui a autenticação customizada:

**Antes (SQLite):**
- Tokens de sessão em cookies `HttpOnly`
- Verificação via `server.js`

**Depois (Supabase Auth):**
- Usar `supabase.auth.getUser()` no middleware
- Atualizar `middleware.ts` para usar `@supabase/ssr`

### 9. Atualizar API do backend
O `server.js` atual precisa ser adaptado:
- Substituir chamadas SQLite por `@supabase/supabase-js` (service_role)
- Ou manter como proxy para Supabase via `supabaseEdgeFunctions`

### 10. Migração de imagens
- As imagens permanecem em `data/uploads/` localmente
- Para migrar para Supabase Storage:
  1. Criar bucket `uploads`
  2. Upload assíncrono dos arquivos
  3. Atualizar URLs no banco (paths `/uploads/...` permanecem válidos se servir localmente)

## Considerações importantes

### Segurança
- ⚠️ **NUNCA** exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend
- Use apenas `NEXT_PUBLIC_SUPABASE_ANON_KEY` no cliente
- As políticas RLS são cruciais

### Dados
- Backup do SQLite antes da migração
- A migração é irreversível
- Dados sintéticos de teste podem ser recriados após

### Desempenho
- Supabase PostgreSQL é mais rápido que SQLite para consultas complexas
- Índices já foram criados no schema

## Próximos passos após migração

1. Atualizar variáveis de ambiente no Vercel/Netlify
2. Remover dependência de `node:sqlite` no `package.json`
3. Deploy do novo backend

## Comandos úteis

```bash
# Status do projeto Supabase
supabase status

# Ver logs
supabase logs

# Reset local (apaga tudo)
supabase db reset

# Generar tipos TypeScript
supabase gen types typescript > frontend/src/types/database.ts
```