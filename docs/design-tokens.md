# Design Tokens — Vibra

Tokens compartilhados pelo frontend React/Next.js. Fonte: `frontend/src/app/globals.css`.

## Paleta

Interface restrita a **laranja, preto, branco e cinza-escuro**. Cores semânticas de status permanecem específicas para indicação funcional.

| Papel | Token | Modo escuro | Modo claro |
| --- | --- | --- | --- |
| Fundo | `--vibra-background` | `#050505` | `#FAFAFA` |
| Fundo secundário | `--vibra-background-secondary` | `#0B0B0B` | `#F4F4F5` |
| Superfície | `--vibra-surface` | `#101010` | `#FFFFFF` |
| Superfície elevada | `--vibra-surface-raised` | `#101010` | `#FFFFFF` |
| Superfície sutil | `--vibra-surface-subtle` | `#181818` | `#F4F4F5` |
| Texto principal | `--vibra-foreground` | `#FFFFFF` | `#111111` |
| Texto secundário | `--vibra-muted` | `#A1A1AA` | `#52525B` |
| Texto discreto | `--vibra-subtle` | `#71717A` | `#71717A` |
| Borda | `--vibra-border` | `#242424` | `#E4E4E7` |
| Borda forte | `--vibra-border-strong` | `#3F3F46` | `#D4D4D8` |

### Laranja

| Token | Valor |
| --- | --- |
| `--vibra-brand` | `#FF6A00` |
| `--vibra-brand-hover` | `#FF8C00` |
| `--vibra-brand-fill` | `#FF6A00` |
| `--vibra-brand-fill-hover` | `#FF4500` |
| `--vibra-brand-soft` | `#3A1600` |
| `--vibra-on-brand` | `#0A0A0A` |
| `--vibra-accent` | `#FF8C00` |
| `--vibra-accent-soft` | `#3A1600` |
| `--vibra-premium-from` / `--vibra-premium-to` | `#FF8C00` / `#FF4500` |
| `--vibra-wave-from` / `--vibra-wave-to` | `#FF6A00` / `#FF8C00` |

### Status e superfícies auxiliares

| Token | Função |
| --- | --- |
| `--vibra-success` | Indicador online e feedback positivo |
| `--vibra-danger` | Exclusão e notificação de erro |
| `--vibra-danger-soft` | Fundo de alertas destrutivos |
| `--vibra-follow-bg` / `--vibra-follow-text` | Botão "Seguir" da referência |
| `--vibra-nav-active-bg` | Fundo do item de navegação ativo |
| `--vibra-nav-active-border` | Borda do item de navegação ativo |
| `--vibra-nav-active-text` | Texto do item de navegação ativo |

Variáveis Tailwind são expostas em `@theme inline`. Exemplos: `bg-background`, `bg-background-secondary`, `bg-surface`, `text-foreground`, `text-muted`, `border-border`, `bg-brand-fill`, `text-on-brand`, `bg-success` e `bg-danger`.

## Paletas de assinatura

Backend limita `theme_palette` à allow-list **`orange`, `black`, `white`**. Valor padrão: `orange`. Assinatura expirada ou valor inválido volta ao padrão.

### `orange` — padrão

Usa tokens laranja da tabela principal.

### `black`

| Token | Modo escuro | Modo claro |
| --- | --- | --- |
| `--vibra-brand` | `#F5F5F5` | `#111111` |
| `--vibra-brand-hover` | `#FFFFFF` | `#242424` |
| `--vibra-brand-fill` | `#101010` | `#111111` |
| `--vibra-brand-fill-hover` | `#242424` | `#242424` |
| `--vibra-brand-soft` | `#242424` | `#E4E4E7` |
| `--vibra-on-brand` | `#FFFFFF` | `#FFFFFF` |
| `--vibra-accent` | `#FFFFFF` | `#111111` |
| `--vibra-accent-soft` | `#242424` | `#E4E4E7` |

### `white`

| Token | Modo escuro | Modo claro |
| --- | --- | --- |
| `--vibra-brand` | `#FFFFFF` | `#52525B` |
| `--vibra-brand-hover` | `#E4E4E7` | `#242424` |
| `--vibra-brand-fill` | `#FFFFFF` | `#FFFFFF` |
| `--vibra-brand-fill-hover` | `#E4E4E7` | `#E4E4E7` |
| `--vibra-brand-soft` | `#242424` | `#E4E4E7` |
| `--vibra-on-brand` | `#111111` | `#111111` |
| `--vibra-accent` | `#FFFFFF` | `#52525B` |
| `--vibra-accent-soft` | `#242424` | `#E4E4E7` |

Seletores ficam em `frontend/src/app/globals.css`. Frontend aplica valor via `data-palette`; manipulação do DOM não amplia entitlement, validado no backend.

## Tema claro/escuro

- `data-theme="dark"` é padrão.
- `data-theme="light"` ativa superfícies brancas e texto preto.
- `frontend/public/theme-init.js` restaura preferência `vibra-theme` sem depender de JavaScript no React.
- Toggle fica no topbar: sol no modo escuro, lua no modo claro.

## Tipografia

| Papel | Fonte | Via `next/font` | Fallback |
| --- | --- | --- | --- |
| Interface | **Inter** | `localFont` | `system-ui`, `sans-serif` |
| Títulos/marca | **Lora** | `localFont` | `Georgia`, `serif` |

Variáveis CSS: `--font-inter`, `--font-lora`. `@theme inline` mapeia `--font-sans` e `--font-display`.

## Raio

| Token | Valor | Classe Tailwind |
| --- | --- | --- |
| `--radius-pill` | `999px` | `rounded-pill` |
| `--radius-card` | `1rem` | `rounded-card` |
| `--radius-panel` | `1.25rem` | `rounded-panel` |

## Sombras

| Token | Valor |
| --- | --- |
| `--shadow-card` | `0 14px 34px rgb(0 0 0 / 0.08)` |
| `--shadow-float` | `0 18px 50px rgb(0 0 0 / 0.16)` |
| `--shadow-brand` | `0 10px 30px rgb(255 106 0 / 0.22)` |

## Movimento

- `html { scroll-behavior: smooth; }`.
- Skip link `.skip-link` usa `transition: transform 160ms ease`.
- Skeleton usa `animate-pulse`.
- `prefers-reduced-motion: reduce` reduz animações e transições para `0.01ms`.

## Acessibilidade

- Anel `:focus-visible`: 3 px com `color-mix(in srgb, var(--vibra-brand-fill) 68%, transparent)` e `outline-offset: 3px`.
- Utilitário `.sr-only` disponível.
- Skip link fixo no topo.
- Controles só por ícone usam `aria-label`.
- Estados de foco, hover, disabled e erro preservam contraste entre texto, superfície e accent.

## Backend — regras de entitlement

1. Allow-list: `orange`, `black`, `white`. Padrão: `orange`.
2. Assinaturas ativas: status `active` ou `subscribed`.
3. `canCustomizeTheme`: assinatura ativa e não expirada.
4. `themeStateFor(user)` devolve paleta armazenada somente com entitlement válido e valor allow-listed.
5. `resetInvalidThemePalette(user)` força `orange` quando entitlement termina ou valor persistido é inválido.
6. `PATCH /api/me/theme-palette` aceita somente `{ palette: string }`; valor fora da allow-list retorna `400`; usuário sem entitlement recebe `403`.

## Segurança

- Sem `dangerouslySetInnerHTML`.
- Frontend não acessa chave secreta do Supabase.
- Sessão usa cookie `HttpOnly; SameSite=Lax`; frontend não guarda token em `localStorage`.
- API usa `fetch` com `credentials: 'same-origin'`, `cache: 'no-store'` e validação de caminho `/api/*`.
- RLS e `users_public` ficam versionados em `supabase/migrations/`.

## Layout do perfil

Tokens e medidas do shell responsivo:

| Medida | Token / valor | Uso |
| --- | --- | --- |
| Sidebar desktop | `248px` | Fixa à esquerda em telas largas |
| Coluna central | `872px` | Conteúdo principal do perfil |
| Coluna direita | `354px` | Sobre, destaques e sugestões |
| Gap entre colunas | `22px` | Grade do perfil |
| Banner | `207px` desktop | Raio `22px` |
| Avatar | `166px` desktop | Anel laranja `3px`, glow e ponto verde |
| Abas | Pill natural | Ativa com fundo elevado e sublinhado laranja |
| Grade | 2 colunas, proporção `2:1` | Gap `16px`; uma coluna no mobile |

Regras: coluna direita some abaixo de `1280px`; sidebar vira icon rail no tablet; mobile usa bottom nav e busca por ícone. Nenhuma área cria rolagem horizontal.

## Referência visual

Perfil principal usa dados reais de `/api/users/:username`. A comparação visual usa imagens materializadas em `docs/reference/`, captura em 1536 × 1024 e medidas acima. Dados e arte da referência não entram no produto.
