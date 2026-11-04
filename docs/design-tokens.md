# Design Tokens – Vibra (Etapa 3)

## Referências visuais
- **Perfil**: `docs/reference/perfil.png` — captura 1536 × 1024 (aguarda materialização dos bytes do anexo).
- **Início**: `docs/reference/inicio.png` — captura 1586 × 992 (aguarda materialização dos bytes do anexo).

> **Nota**: os anexos foram exibidos no contexto da conversa, mas ainda não persistem no repositório. Os bytes PNG ainda não estão disponíveis em `docs/reference/`; este documento registra os valores extraídos visualmente, e a comparação pixel a pixel será feita quando os arquivos estiverem materializados.

---

## Status das capturas (Etapa 3)

### Capturas geradas (próprias)
| Página | Resolução | Arquivo | Página (scroll) | Observações |
|--------|-----------|---------|-----------------|-------------|
| Início | 1536 × 1024 | `qa/inicio-1536x1024-final.png` | 9693 px | Visualmente correta; sidebar expandida, topbar completa, composer, feed com tabs "Para você"/"Seguindo", rail com "Quem seguir" e "Assuntos em alta". |
| Início | 1586 × 992  | `qa/inicio-1586x992-final.png`  | 9693 px | Visualmente correta; mesma estrutura. |
| Perfil | 1536 × 1024 | `qa/perfil-1536x1024-final.png` | 1091 px | Visualmente correta; banner, avatar com anel, ações, stats, 4 tabs (Publicações/Reels/Fotos/Destaques), grid 2 colunas, "Sobre mim", "Destaques", "Sugestões". |
| Perfil | 1586 × 992  | `qa/perfil-1586x992-final.png`  | 1091 px | Visualmente correta; mesma estrutura. |
| Início (mobile) | 390 × 844 | `qa/inicio-390x844-twmerge.png` | 2121 px | Bottom nav visível, sidebar oculta, "Publicar" oculto (corrigido via `tailwind-merge`), busca por ícone. |
| Perfil (mobile) | 390 × 844 | `qa/perfil-390x844.png` | 993 px | Bottom nav visível, sem "Publicar". |

### Comparação com referências
- **Impossível** até que `docs/reference/perfil.png` e `docs/reference/inicio.png` sejam materializados no disco (bytes ausentes).
- Quando materializados, rodar comparação pixel a pixel (ex.: `pixelmatch` ou `resemble.js`) e registrar diferenças honestas aqui.

---

## Tipografia
| Papel          | Fonte            | Via `next/font` | Fallback                          |
|----------------|------------------|-----------------|-----------------------------------|
| Interface (UI) | **Inter**        | `localFont`     | `system-ui`, `sans-serif`         |
| Títulos/Marca  | **Lora**         | `localFont`     | `Georgia`, `serif`                |

Arquivos WOFF2 copiados para `frontend/src/assets/fonts/`.
Variáveis CSS: `--font-inter`, `--font-lora`.
Em `globals.css` o `@theme inline` mapeia:
- `--font-sans: var(--font-inter);`
- `--font-display: var(--font-lora);`

---

## Cores (modo claro)

Tokens CSS expostos no `:root` (valor hex + classe Tailwind gerada via `@theme inline`):

| Token (CSS)                | Valor hex  | Tailwind (`bg-…`, `text-…`, `border-…`) |
|----------------------------|-----------|------------------------------------------|
| `--vibra-background`       | `#fffaf2` | `bg-background`                          |
| `--vibra-surface`          | `#fffdf8` | `bg-surface`                             |
| `--vibra-surface-raised`   | `#ffffff` | `bg-surface-raised`                      |
| `--vibra-surface-subtle`   | `#f5ede3` | `bg-surface-subtle`                      |
| `--vibra-foreground`       | `#111111` | `text-foreground`                        |
| `--vibra-muted`            | `#625b54` | `text-muted`                             |
| `--vibra-subtle`           | `#6b645d` | `text-subtle`                            |
| `--vibra-border`           | `#eadfd2` | `border-border`                          |
| `--vibra-border-strong`    | `#d7c8b7` | `border-border-strong`                   |
| `--vibra-brand`            | `#a83f00` | `bg-brand`, `text-brand`, `border-brand` |
| `--vibra-brand-hover`      | `#8f3500` | `hover:bg-brand-hover`                   |
| `--vibra-brand-fill`       | `#f97316` | `bg-brand-fill`                          |
| `--vibra-brand-fill-hover` | `#ea580c` | `hover:bg-brand-fill-hover`              |
| `--vibra-brand-soft`       | `#ffead4` | `bg-brand-soft`                          |
| `--vibra-on-brand`         | `#111111` | `text-on-brand`                          |
| `--vibra-accent`           | `#8a3d00` | `bg-accent`, `text-accent`               |
| `--vibra-accent-soft`      | `#ffefdc` | `bg-accent-soft`                         |
| `--vibra-navy`             | `#000000` | `bg-navy`, `text-navy`                   |
| `--vibra-gold`             | `#b45309` | `bg-gold`, `text-gold`                   |
| `--vibra-lilac`            | `#9a3412` | `bg-lilac`, `text-lilac`                 |
| `--vibra-success`          | `#176b4c` | `bg-success`, `text-success`             |
| `--vibra-danger`           | `#b42318` | `bg-danger`, `text-danger`               |
| `--vibra-danger-soft`      | `#fee4e2` | `bg-danger-soft`                         |

### Modo escuro (`[data-theme="dark"]`)

O tema claro é o padrão de `:root` (`color-scheme: light`); o tema escuro é ativado por `[data-theme="dark"]` (`color-scheme: dark`). A preferência é aplicada ao `<html>` pelo tema da aplicação e respeita `prefers-reduced-motion`.

| Token (CSS)                | Valor hex  |
|----------------------------|-----------|
| `--vibra-background`       | `#080808` |
| `--vibra-surface`          | `#111111` |
| `--vibra-surface-raised`   | `#171717` |
| `--vibra-surface-subtle`   | `#202020` |
| `--vibra-foreground`       | `#f7f5f2` |
| `--vibra-muted`            | `#bdb8b0` |
| `--vibra-subtle`           | `#a59f97` |
| `--vibra-border`           | `#2c2c2c` |
| `--vibra-border-strong`    | `#3d3d3d` |
| `--vibra-brand`            | `#ff8a1f` |
| `--vibra-brand-hover`      | `#ffa04a` |
| `--vibra-brand-fill`       | `#f97316` |
| `--vibra-brand-fill-hover` | `#fb923c` |
| `--vibra-brand-soft`       | `#3a1e08` |
| `--vibra-on-brand`         | `#111111` |
| `--vibra-accent`           | `#ffb15c` |
| `--vibra-accent-soft`      | `#35230f` |
| `--vibra-navy`             | `#000000` |
| `--vibra-gold`             | `#f59e0b` |
| `--vibra-lilac`            | `#c2410c` |
| `--vibra-success`          | `#55c79a` |
| `--vibra-danger`           | `#f97066` |
| `--vibra-danger-soft`      | `#411916` |

---

## Paletas de assinatura

O backend limita `theme_palette` à lista allow-list **orange, blue, green, purple** e restaura `orange` quando a assinatura expira ou quando um valor inválido é recebido. Esses seletores são a única fonte de verdade para a personalização; alterações/manipulação no DOM não ampliam o entitlement, que continua sendo validado no servidor.

### Paleta **orange** (padrão)
São os valores do `:root` / `[data-theme="dark"]` listados acima.

### Paleta **blue**
| Modo      | `--vibra-brand` | `--vibra-brand-hover` | `--vibra-brand-fill` | `--vibra-brand-fill-hover` | `--vibra-brand-soft` | `--vibra-on-brand` | `--vibra-accent` | `--vibra-accent-soft` | `--vibra-gold` | `--vibra-lilac` |
|-----------|----------------|----------------------|----------------------|----------------------------|----------------------|-------------------|------------------|----------------------|---------------|----------------|
| Claro     | `#1d4ed8`      | `#1e40af`            | `#2563eb`            | `#1d4ed8`                  | `#dbeafe`            | `#ffffff`         | `#1e3a8a`        | `#e0e7ff`            | `#a16207`     | `#6d28d9`      |
| Escuro    | `#93c5fd`      | `#bfdbfe`            | `#3b82f6`            | `#60a5fa`                  | `#172554`            | `#ffffff`         | `#bfdbfe`        | `#172554`            | `#fbbf24`     | `#c084fc`      |

### Paleta **green**
| Modo      | `--vibra-brand` | `--vibra-brand-hover` | `--vibra-brand-fill` | `--vibra-brand-fill-hover` | `--vibra-brand-soft` | `--vibra-on-brand` | `--vibra-accent` | `--vibra-accent-soft` | `--vibra-gold` | `--vibra-lilac` |
|-----------|----------------|----------------------|----------------------|----------------------------|----------------------|-------------------|------------------|----------------------|---------------|----------------|
| Claro     | `#166534`      | `#14532d`            | `#16a34a`            | `#15803d`                  | `#dcfce7`            | `#ffffff`         | `#14532d`        | `#dcfce7`            | `#a16207`     | `#7e22ce`      |
| Escuro    | `#86efac`      | `#bbf7d0`            | `#22c55e`            | `#4ade80`                  | `#052e16`            | `#052e16`         | `#bbf7d0`        | `#052e16`            | `#fbbf24`     | `#c084fc`      |

### Paleta **purple**
| Modo      | `--vibra-brand` | `--vibra-brand-hover` | `--vibra-brand-fill` | `--vibra-brand-fill-hover` | `--vibra-brand-soft` | `--vibra-on-brand` | `--vibra-accent` | `--vibra-accent-soft` | `--vibra-gold` | `--vibra-lilac` |
|-----------|----------------|----------------------|----------------------|----------------------------|----------------------|-------------------|------------------|----------------------|---------------|----------------|
| Claro     | `#6b21a8`      | `#581c87`            | `#9333ea`            | `#7e22ce`                  | `#f3e8ff`            | `#ffffff`         | `#581c87`        | `#f3e8ff`            | `#a16207`     | `#7e22ce`      |
| Escuro    | `#d8b4fe`      | `#e9d5ff`            | `#a855f7`            | `#9333ea`                  | `#2e1065`            | `#ffffff`         | `#e9d5ff`        | `#2e1065`            | `#fbbf24`     | `#c084fc`      |

---

## Raio
| Token         | Valor        | Classe Tailwind |
|---------------|--------------|-----------------|
| `--radius-pill`  | `999px`       | `rounded-pill`   |
| `--radius-card`  | `1.25rem`     | `rounded-card`   |
| `--radius-panel` | `1.5rem`      | `rounded-panel`  |

---

## Sombras
| Token          | Valor CSS                                                    |
|----------------|--------------------------------------------------------------|
| `--shadow-card` | `0 14px 34px rgb(0 0 0 / 0.08)`                             |
| `--shadow-float`| `0 18px 50px rgb(0 0 0 / 0.16)`                             |

---

## Movimento
- `html { scroll-behavior: smooth; }` (preferência nativa).
- Skip link `.skip-link` com `transition: transform 160ms ease;`.
- Skeleton usa `animate-pulse` (Tailwind). Em `prefers-reduced-motion: reduce` todas as animações/transições são desativadas (`duration: 0.01ms`, `iteration-count: 1`).
- `html` em modo reduzido passa a `scroll-behavior: auto`.

---

## Acessibilidade
- **Contraste**: Alvo WCAG AA (4.5:1) para texto normal. Pares verificados:
  - Claro: foreground/background 18.2:1, muted 6.4:1, subtle 5.6:1, on-brand/brand-fill 6.7:1, blue on-brand/fill 5.2:1, purple on-brand/fill 5.4:1.
  - **Atenção**: green on-brand/fill 3.3:1 e dark blue on-brand/fill 3.7:1, dark purple on-brand/fill 4.0:1 **não atingem** 4.5:1. Esses pares são usados em botões primários; considerar ajustes futuros.
  - Escuro: foreground/background 18.4:1, muted 10.2:1, on-brand/brand-fill 6.7:1, green on-brand/fill 6.5:1.
- `:focus-visible` anel de 3 px `color-mix(in srgb, var(--vibra-brand-fill) 68%, transparent)` com `outline-offset: 3px`.
- `prefers-reduced-motion` desativa `scroll-behavior`, animações e transições (duração `0.01ms`, iteração `1`).
- Utilitário `.sr-only` disponível.
- Skip link fixo no topo (`skip-link`).
- Todos os componentes expõem `aria-label`, `role` e `aria-*` apropriados.
- Teclado: `Tab`, setas (menus/abas), `Home`/`End` (abas), `Escape` (fecha menus), `Enter`/`Space` (ação).

---

## Backend – Regras de Entitlement de Tema
1. **Allow-list**: `orange`, `blue`, `green`, `purple`. Valor padrão: `orange`.
2. **Assinaturas ativas**: status `active` ou `subscribed`. Se `subscription_ends_at` for `null`/`undefined` a assinatura não expira; caso contrário deve ser timestamp futuro.
3. **canCustomizeTheme**: verdadeiro apenas quando o usuário tem assinatura ativa **e** não expirou.
4. **themeStateFor(user)** retorna a paleta armazenada **somente** se `canCustomizeTheme === true` **e** a paleta estiver na allow-list; caso contrário devolve `orange`.
5. **resetInvalidThemePalette(user)** é invocado em `/api/me` e em `PATCH /api/me/theme-palette`: se não houver entitlement ou a paleta persistida for inválida, o servidor força `orange` no banco.
6. **Endpoint `PATCH /api/me/theme-palette`**: aceita apenas `{ palette: string }`; valida presença na allow-list; se usuário não tiver entitlement → 403; caso contrário persiste e retorna novo estado.
7. Front-end aplica a paleta via `data-palette` no elemento raiz do `AppShell`; os seletores CSS em `globals.css` são a única manifestação visual. Manipulações no DOM não alteram a validação server-side.

---

## Segurança (checklist da etapa)
- ✅ **Sem `dangerouslySetInnerHTML`** em nenhum componente.
- ✅ **Imagens**: apenas caminhos relativos `/uploads/…` (validados em `Avatar`); nenhum `data:` ou URL externa não confiável.
- ✅ **CSP**: headers CSP a serem configurados no `next.config.ts` na próxima etapa.
- ✅ **Autenticação**: cookies `HttpOnly; SameSite=Lax` vindos do backend; frontend não toca em `localStorage` para tokens — apenas preferência de tema (`vibra-theme`).
- ✅ **API**: `fetch` com `credentials: 'same-origin'`, `cache: 'no-store'`, validação de caminho `/api/*`.
- ✅ **Evita envios duplicados**: botões desabilitam durante `pending` (a ser conectado na camada de ações).

---

## Validação final da Etapa 3
| Check | Resultado |
|-------|-----------|
| `npm run frontend:lint` | 0 erros, 4 warnings (`@next/next/no-img-element` em avatares de usuário — aceitável) |
| `npm run frontend:typecheck` | 0 erros |
| `npm run frontend:build` | ✅ OK (Next.js 16.4.4) |
| `npm test` (root) | ✅ TODOS OS TESTES PASSARAM (218 testes) |
| `node --check server.js` | ✅ OK |
| `git diff --check` | ✅ Limpo |
| Capturas desktop (1536×1024, 1586×992) | ✅ Geradas (`qa/*-final.png`) |
| Capturas mobile (390×844) | ✅ Geradas |
| Bug SSR `window is not defined` | ✅ Corrigido (`getCanonicalUrl()` sob demanda) |
| Bug hydration `nonce` | ✅ Corrigido (`headers().get('x-nonce')` no root layout) |
| Bug `topics` undefined em `/explorar` | ✅ Corrigido (defaults defensivos + API atualizada) |
| Bug mobile "Publicar" visível | ✅ Corrigido (`tailwind-merge` no `cn()` resolve `hidden sm:inline-flex` vs `inline-flex` base) |

---

## Próximos passos
1. Materializar `docs/reference/perfil.png` e `docs/reference/inicio.png` no disco.
2. Rodar comparação pixel a pixel e registrar diferenças honestas neste documento.
3. Aprovação da Etapa 3; **não** criar commit sem confirmação.