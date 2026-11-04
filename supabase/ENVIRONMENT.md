# Supabase Environment Configuration

## Variáveis necessárias

Crie um arquivo `.env.local` na raiz do projeto (`frontend/.env.local`) ou configure no painel do Supabase:

```bash
# URL do projeto Supabase (encontrado em Settings > General)
NEXT_PUBLIC_SUPABASE_URL=https://cpobpnmrisgkceerbkxr.supabase.co

# Chave anônima (public) - para cliente frontend
# sb_publishable_... (obtida em Settings > API)
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Chave de service role - **NUNCA** exponha no frontend
# Use apenas no backend/serviço de migração
SUPABASE_SERVICE_ROLE_KEY=
```

### Conexão direta PostgreSQL (backend Node.js)

```bash
# URL de conexão (Settings > Database > Connection string > Transaction pooler ou Direct)
# Use `sslmode=no-verify` pois o certificado é auto-assinado
DATABASE_URL=postgresql://postgres:<SENHA>@db.cpobpnmrisgkceerbkxr.supabase.co:5432/postgres?sslmode=no-verify
PGSSL=1
```

A senha do banco foi definida via Management API: `vibra-botola-2026`.

## Como obter as chaves

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Selecione o projeto **cpobpnmrisgkceerbkxr** ("Botola e amigos")
3. Vá em **Settings > General** → copie a **Project URL**
4. Vá em **Settings > API** → copie:
   - **Publishable key** (nova, prefixo `sb_publishable_`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (legacy JWT ou `sb_secret_...`) → `SUPABASE_SERVICE_ROLE_KEY` (apenas backend)

## Database (PostgreSQL)

O schema está versionado em `supabase/migrations/`:
- `20261103000000_initial_schema.sql` — 30 tabelas, BIGINT timestamps (ms epoch)
- `20261103000001_rls_policies.sql` — Row Level Security com `private.current_vibra_user_id()`
- `20261103000002_data_api_grants.sql` — privilégios Data API (anon mínimo, users coluna a coluna)
- `20261103000003_users_public_view.sql` — view `users_public` com `security_invoker=true`

Aplicar local (Docker stack):
```bash
supabase db reset
```

Aplicar no cloud:
```bash
supabase db push --remote --yes --include-all
```

## Row Level Security (RLS)

Todas as tabelas têm RLS habilitado. Políticas usam `private.current_vibra_user_id()` que resolve o `auth_uid` da sessão Supabase.

## Data API (PostgREST) — privilégios

- `anon`: SELECT apenas em `posts`, `post_media`, `likes`, `comments`, `follows`, `shares`, `story_reactions`, `users_public`
- `authenticated`: CRUD completo com RLS decidindo linha a linha
- `service_role`: acesso total (bypass RLS) — backend Node.js conecta como `postgres`

`password_hash` e `auth_uid` **nunca** expostas via Data API.

## Storage para uploads

Configure no Supabase Storage:
- Bucket: `uploads`
- Público: sim (para imagens de posts, avatars, stories)

## Autenticação

O Supabase Auth substitui a autenticação customizada:
- Remove o token de sessão do SQLite
- Use os endpoints de autenticação do Supabase
- Atualize o frontend para usar `@supabase/ssr`

## Regenerar tipos TypeScript

```bash
supabase gen types typescript --project-id cpobpnmrisgkceerbkxr > frontend/src/types/database.ts
# ou local:
supabase gen types typescript --local > frontend/src/types/database.ts
```

## Comandos úteis

```bash
# Status do projeto Supabase
supabase status

# Ver logs
supabase logs

# Reset local (apaga tudo)
supabase db reset

# Link remoto
supabase link --project-ref cpobpnmrisgkceerbkxr --skip-pooler
```