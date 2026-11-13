# Vibra 2.0

Rede social local com descoberta de afinidades e uma área de namoro separada, verificada e baseada em consentimento. O projeto é original: não usa código, marca, layout ou imagens do Instagram ou do Tinder.

![Perfil do Vibra](docs/landing/index.html)

Repositório: [`github.com/oixeol/Rede-social`](https://github.com/oixeol/Rede-social)

---

## Estrutura do projeto

```
minha-rede-social/
│
├── frontend/                # Aplicação Next.js (React 19, App Router)
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── next.config.ts
│   ├── src/
│   │   ├── app/             # Rotas (App Router) + globals.css (tokens)
│   │   ├── components/
│   │   │   ├── landing/     # Landing page (rota /)
│   │   │   ├── profile/     # Tela de PERFIL (coluna central + lateral)
│   │   │   ├── shell/       # Sidebar, topbar, logo
│   │   │   └── ui/          # Componentes base
│   │   ├── lib/             # API, Supabase (browser/server), view models, flags
│   │   └── types/           # Tipos do schema Supabase
│   ├── tests/               # Testes unitários do frontend (node:test)
│   └── public/
│       └── theme-init.js
│
├── backend/                 # Gateway FastAPI
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── main.py              # Entrada FastAPI (uvicorn main:app)
│   ├── requirements.txt     # FastAPI, uvicorn, httpx, supabase
│   │
│   └── node-api/            # Implementação Node.js funcional (fonte de verdade da API)
│       ├── Dockerfile
│       ├── .dockerignore
│       ├── server.js        # Servidor HTTP + API JSON + SQLite (sem frontend estático)
│       ├── app.config.js
│       ├── package.json
│       ├── lib/
│       ├── qa/              # Suítes de teste automatizado
│       └── scripts/         # Seed de demonstração
│
├── docker-compose.yml       # Orquestração completa
├── .env.example             # Modelo de variáveis de ambiente
├── .gitignore
├── .gitattributes
├── README.md
├── docs/
│   ├── design-tokens.md     # Tokens, tipografia, paletas, acessibilidade
│   └── landing/
└── supabase/
    ├── config.toml
    ├── migrations/          # Schema, RLS, grants, view users_public
    ├── MIGRATION_GUIDE.md
    └── ENVIRONMENT.md
```

> **Nota:** o código legacy (frontend vanilla em `backend/node-api/public/`, esqueleto Django e documentação antiga) foi removido. O frontend em React/Next.js é a única interface web do projeto.

---

## Estado atual

| Componente | Estado | Observações |
| --- | --- | --- |
| Frontend Next.js (porta 3000) | **Funcional** | App Router + React 19 + TypeScript + Tailwind v4, rewrites `/api/*` → backend |
| Tela de PERFIL | **Funcional** | Layout responsivo de 3 colunas (sidebar + centro + direita) alimentado por dados reais de `/api/users/:username`; `getSuggestions()` real; 404 próprio; abas com ARIA e navegação por teclado |
| Backend FastAPI (porta 8000) | **Funcional** | Gateway que repassa `/api/*` e `/uploads/*` para a API Node |
| API Node.js (porta 4173) | **Funcional** | Servidor HTTP + SQLite + seed opcional (fonte de verdade da API) |
| PostgreSQL 18.6 (porta 5432) | **Pronto** | Container com healthcheck e volume `vibra_postgres_data` |
| Supabase | **Migrado** | Cliente browser + server no React, RLS ativo nas migrations, secret só no backend |
| Testes automatizados | **Disponíveis** | Suítes fumaça, configuração, Namoro e retenção |
| Landing page (Etapa 3) | **Concluída** | `frontend/src/components/landing/landing-page.tsx` — rota `/` renderiza a landing; CTA "Entrar" → `/entrar` |

> A aplicação web completa (frontend + API) roda via **Node.js + SQLite nativo** (`backend/node-api/server.js`). O gateway FastAPI expõe a API na porta 8000 e encaminha para a implementação Node existente, mantendo o contrato estável. O Supabase é a camada de persistência/auth em migração: schema, RLS e view `users_public` já estão versionados em `supabase/migrations/`.

---

## Como rodar com Docker Compose (recomendado)

Requisitos: **Docker Desktop** ou **Docker Engine** com Compose v2.

```powershell
cd C:\Rede-social
docker compose up -d --build
```

O Compose sobe quatro serviços:

| Serviço | Porta | Descrição |
| --- | --- | --- |
| `frontend` | 3000 | Next.js em modo dev (Turbopack, hot reload) |
| `backend` | 8000 | FastAPI gateway (uvicorn --reload) |
| `node-api` | 4173 | API Node.js funcional (SQLite) |
| `postgres` | 5432 | PostgreSQL 18.6 (volume persistente) |

Abra **http://localhost:3000** (frontend). A rota `/` exibe a **Landing Page (Etapa 3)**; ao clicar "Entrar" você é levado a `/entrar` (login) e, após autenticar, ao app em `/inicio`. Os rewrites do Next.js encaminham `/api/*` para o backend (8000), que por sua vez repassa para a API Node (4173).

Para parar mantendo os volumes:
```powershell
docker compose down
```

Para limpar completamente (apaga dados persistidos):
```powershell
docker compose down -v
```

> **Importante:** o frontend usa variáveis de ambiente `NEXT_PUBLIC_*`, `VIBRA_API_ORIGIN` e `VIBRA_PUBLIC_ORIGIN` (lidas em tempo de execução pelo `next dev`). O backend FastAPI lê `NODE_API_URL=http://node-api:4173` e as credenciais Supabase do `.env`.

---

## Rodando localmente sem Docker (desenvolvimento)

### Frontend (Next.js)

```powershell
cd C:\Rede-social\frontend
npm ci
npm run dev           # http://localhost:3000
```

### API Node.js (backend/node-api)

Requisitos: **Node.js 22.5+** (usa `node:sqlite` experimental, já disponível).

```powershell
cd C:\Rede-social\backend\node-api
npm ci
npm start             # http://127.0.0.1:4173
```

A primeira execução cria um banco vazio em `backend/node-api/data/vibra.db`. Para popular com cinco perfis de exemplo (apenas desenvolvimento):

```powershell
$env:VIBRA_DEMO_PASSWORD='escolha-uma-senha-forte'; npm run seed:demo
```

A senha precisa ter pelo menos 8 caracteres. `NODE_ENV=production` recusa o comando.

Para usar outra porta:
```powershell
$env:PORT=8080; npm start
```

### Backend Python (FastAPI gateway)

```powershell
cd C:\Rede-social\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

O gateway FastAPI (`main.py`) serve a API encaminhando para a API Node. Não há código Django no repositório: os apps Django e o `manage.py` foram removidos, e `requirements.txt` mantém apenas FastAPI, uvicorn, httpx e supabase.

---

## Variáveis de ambiente (modelo em `.env.example`)

| Variável | Padrão | Uso |
| --- | --- | --- |
| `SUPABASE_URL` | — | URL do projeto Supabase (frontend + backend) |
| `SUPABASE_PUBLISHABLE_KEY` | — | Chave anônima (`sb_publishable_…`) para o cliente frontend |
| `SUPABASE_SECRET_KEY` | — | Service role key — **somente backend**, nunca no navegador |
| `DATABASE_URL` | — | Conexão Postgres direta (migração) |
| `VIBRA_API_ORIGIN` | `http://backend:8000` | Origem da API para rewrites Next.js |
| `VIBRA_PUBLIC_ORIGIN` | (vazio) | Origem pública canônica do frontend; usada pelo QR de login. Em produção configure a URL real (sem caminho) |
| `NEXT_PUBLIC_VIBRA_FEATURE_PREMIUM` | ativo | `0` desliga o item Premium na interface |
| `NEXT_PUBLIC_VIBRA_FEATURE_COMMUNITIES` | ativo | `0` desliga Comunidades na interface |
| `NEXT_PUBLIC_VIBRA_FEATURE_REELS` | ativo | `0` desliga a aba Reels |
| `NEXT_PUBLIC_VIBRA_FEATURE_HIGHLIGHTS` | ativo | `0` desliga Destaques |
| `NEXT_PUBLIC_VIBRA_FEATURE_SUGGESTIONS` | ativo | `0` desliga Sugestões |
| `NEXT_PUBLIC_VIBRA_FEATURE_NOTIFICATIONS` | ativo | `0` desliga Notificações |
| `VIBRA_FIXTURES` | (vazio) | `1` libera fixtures sintéticas **somente** com `NODE_ENV=development`; em produção o valor é ignorado |
| `NODE_API_URL` | `http://node-api:4173` | Upstream da API Node (backend gateway) |
| `VIBRA_DATA_DIR` | `./data` | Diretório do SQLite + uploads (Node) |
| `VIBRA_SEED_DEMO` | `0` | `1` habilita seed de demonstração (proibido em produção) |
| `VIBRA_DEMO_PASSWORD` | (vazio) | Senha mínima 8 caracteres para contas demo |
| `IDENTITY_PROVIDER` | (vazio) | `dev` ou `webhook` (verificação de identidade do Namoro) |
| `IDENTITY_WEBHOOK_SECRET` | — | Segredo HMAC obrigatório se `webhook` |
| `ADMIN_TOKEN` | — | Libera fila de moderação via `X-Admin-Token` |
| `COOKIE_SECURE` | `0` | `1` força cookie `Secure`; produção já força |
| `VIBRA_DB_NAME` | `vibra` | Banco PostgreSQL local |
| `VIBRA_DB_USER` | `vibra` | Usuário PostgreSQL |
| `VIBRA_DB_PASSWORD` | `vibra_dev_password` | Senha PostgreSQL |
| `VIBRA_DB_PORT` | `5432` | Porta PostgreSQL |
| `VIBRA_TZ` | `UTC` | Fuso horário |

> O arquivo `.env` real **não deve ser versionado**. Copie `.env.example` para `.env` e preencha as chaves.

### Supabase no React

| Arquivo | Ambiente | Chave usada |
| --- | --- | --- |
| `frontend/src/lib/supabase.ts` | Browser (Client Components) | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `frontend/src/lib/supabase-server.ts` | Server Components / Route Handlers | Mesma chave pública, sessão via cookies (`getAll` / `setAll`) |

- `SUPABASE_SECRET_KEY` (service role) fica **apenas** no serviço `backend` do Compose. Nunca é exposta como `NEXT_PUBLIC_*` e nunca entra no bundle do navegador.
- As políticas de RLS estão versionadas em `supabase/migrations/20261103000001_rls_policies.sql` e a view `users_public` em `20261103000003_users_public_view.sql`. A resolução do usuário autenticado usa `users.auth_uid` + `private.current_vibra_user_id()`; o schema `private` não é exposto pela Data API.
- `docker-compose.yml` injeta no frontend apenas URL e chave pública do Supabase.

---

## Testes automatizados

Os testes rodam um servidor Node isolado com banco temporário, seed explícito e verificação por webhook assinado.

```powershell
cd C:\Rede-social\backend\node-api
npm test
```

A suíte cobre:
- **Configuração:** produção recusa seed, webhook sem segredo, simulação e cookie sem `Secure`.
- **Fumaça:** login, sessão, feed, exploração, busca, perfis, seguir, curtir, comentar, publicações, carrossel, vídeo, stories, conversas, notificações, privacidade de perfil e fluxo de solicitações de seguimento.
- **Namoro verificado:** bloqueio de menores, data de nascimento imutável, assinatura HMAC inválida, quiz, perfil independente, descoberta sem distância, match idempotente, conversa de namoro, expiração da verificação, Radar bilateral, revogação, localização apagada, bloqueio/desbloqueio, denúncias, moderação, unmatch, fotos validadas.
- **Retenção:** remoção de localização após prazo e invalidação de sessão expirada.

Para rodar a fumaça contra um servidor já em execução:

```powershell
$env:BASE_URL='http://localhost:4173'; node qa/smoke.mjs
```

As capturas de tela em `backend/node-api/qa/` são geradas com Chromium headless via CDP:

```powershell
cd C:\Rede-social\backend\node-api
powershell -NoProfile -ExecutionPolicy Bypass -File qa/shot.ps1 -Out qa/tela.png -Width 1400 -Height 1000
```

### Testes do frontend

```powershell
cd C:\Rede-social\frontend
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # node:test (fixtures, origem pública, QR)
npm run build      # build de produção
```

Cobertura atual: regras de fixture (ausentes em produção), resolução segura de `VIBRA_PUBLIC_ORIGIN` e geração do QR em SVG inline sem `dangerouslySetInnerHTML`.

---

## Acessibilidade

- Link “Pular para o conteúdo” visível apenas no foco.
- Foco visível em botões, links, campos e controles.
- Contraste reforçado nos textos secundários e nos botões primários.
- Rótulos ARIA nos ícones e nas ações que não têm texto.
- Estados de carregamento, vazio e erro com texto claro.
- Navegação por teclado nos modais, com fechamento por `Esc`.
- Preferência `prefers-reduced-motion` respeitada.
- Áreas de toque de pelo menos 38–44 px nos controles principais.

---

## Identidade visual

O Vibra usa linguagem visual própria:

- preto, branco e laranja como paleta principal;
- títulos em serifa e texto em sans-serif;
- cartões com bordas suaves, sombras discretas e cantos generosos;
- ícones SVG próprios, desenhados para a interface;
- grade de publicações e cartões de perfil em vez de pilha de swipe.

Os tokens ficam em `frontend/src/app/globals.css`. Paletas de assinatura disponíveis: `orange`, `black` e `white`.

---

## Configuração do Google OAuth

### Render (Backend)
1. Acesse o [painel do Render](https://dashboard.render.com)
2. Em "Environment" → adicione:
   - `GOOGLE_CLIENT_ID` = ID do cliente OAuth do Google
   - `GOOGLE_CLIENT_SECRET` = Secret do cliente OAuth do Google

### Google Cloud Console
1. Acesse: https://console.cloud.google.com/apis/credentials
2. Em "OAuth 2.0 Client IDs" → Configure:
   - **Authorized redirect URIs**: `https://rede-social-attz.onrender.com/api/auth/callback/google`
3. Copie o `Client ID` e `Client Secret`

### Vercel (Frontend)
1. Acesse o [dashboard da Vercel](https://vercel.com/dashboard)
2. Em "Settings" → "Environment Variables" → adicione:
   - `NEXT_PUBLIC_API_ORIGIN=https://rede-social-attz.onrender.com`
3. Reinicie o deploy

### Teste
```bash
curl -X POST https://rede-social-attz.onrender.com/api/auth/sign-in/social \
  -H "Content-Type: application/json" \
  -d '{"provider":"google","callbackURL":"https://rede-social-attz.onrender.com/auth/callback"}'
```

Deverá retornar:
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "redirect": true
}
```

---

## Limitações

- Projeto local para um único computador. O padrão escuta só em `127.0.0.1` e não está pronto para exposição direta na internet. Produção ainda exige HTTPS, proxy reverso, backups e banco gerenciado.
- Sem credenciais de um provedor real, a verificação de identidade é uma simulação local explícita (`providerMode: dev`). O contrato de webhook está documentado, mas não foi exercitado contra um fornecedor externo.
- Não há recuperação de senha, autenticação em dois fatores, notificações em tempo real, e-mail/push/SMS nem múltiplas instâncias.
- A fila de moderação é local e não substitui uma equipe humana 24/7 nem uma política jurídica de privacidade revisada.
- Uploads ficam em `backend/node-api/data/uploads/`; não há CDN, storage de objetos ou backup automático.
- As imagens de exemplo são SVGs gerados pelo próprio projeto.

---

Projeto local de estudo. Não afiliado ao Instagram ou ao Tinder.