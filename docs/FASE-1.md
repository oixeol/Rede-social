# Vibra 2.0 — Fase 1

## Objetivo

Analisar o projeto existente, preservar o que já funcionava e consolidar uma identidade visual e uma experiência de navegação consistentes para as cinco áreas do produto: **Início, Explorar, Namoro, Mensagens e Perfil**.

A Fase 1 não foi um redesign do zero. O ponto de partida foi o Vibra 2.0 já funcional, com servidor HTTP próprio, SQLite nativo e frontend em HTML/CSS/JS puro.

## Análise do projeto

| Camada | O que existe |
| --- | --- |
| Servidor | `backend/node-api/server.js` com `node:http`, API JSON, uploads em base64 e SQLite via `node:sqlite` |
| Banco | `backend/node-api/data/vibra.db`, com usuários, posts, stories, seguidores, conversas, namoro e Radar |
| Regras de namoro | `backend/node-api/lib/dating.js`: gate 18+, perfis, questionário, afinidade, matches e consentimento de localização |
| Cliente | `backend/node-api/public/index.html` + módulos ES em `backend/node-api/public/js/` |
| Estilo | `backend/node-api/public/styles.css`, com tokens, layout editorial e componentes |
| QA | `backend/node-api/qa/smoke.mjs`, `backend/node-api/qa/run-tests.mjs`, `backend/node-api/qa/shot.ps1`, `backend/node-api/qa/capture.mjs` |
| Seed | cinco perfis, publicações, stories, perfis de namoro, um match e duas conversas |

### Problemas encontrados

1. **CSS incompleto para os módulos novos.** Cerca de 200 classes usadas por Explorar, Mensagens, Namoro, Perfil, modais, notificações e compartilhamento não tinham regra. Essas telas apareciam parcialmente sem estilo.
2. **Identidade antiga nos scripts de QA e na documentação.** README, smoke test e captura usavam nomes de usuário, senhas, cookie e banco diferentes dos do app, além da porta 4173.
3. **Link “Pular para o conteúdo” sempre visível.** Faltava o estado padrão deslocado para fora da tela.
4. **Navegação superior quebrando.** O ícone e o rótulo dos itens do topo quebravam em duas linhas; o badge de Mensagens cobria a última letra do rótulo.
5. **Ícones perdidos após ações assíncronas.** O `setBusy` substituía o `innerHTML` do botão por texto e não restaurava o conteúdo original.
6. **Badges com valor zero continuavam visíveis.** A regra `.nav-badge { display: grid; }` vencia o atributo `hidden` do HTML.
7. **Badge de conversa não sumia ao abrir a thread.** A API marcava como lida, mas o estado local e o item da lista continuavam com o contador antigo.
8. **Abas de Namoro cortadas no celular.** As quatro abas não cabiam em 390 px e a última ficava parcialmente fora da tela.
9. **Stories vistos excessivamente apagados.** O estado `seen` aplicava grayscale e opacidade fortes, deixando os cartões com aparência desabilitada.

## Identidade visual

### Princípios

- **Editorial, não clone.** Papel quente, serifa nos títulos e composição em cartões e grades. Nada de swipe stack ou barras de app de relacionamento.
- **Calma e contexto.** A área de Namoro é separada do perfil social e explica permissões, verificação e consentimento antes de pedir dados.
- **Hierarquia clara.** Cada tela tem um eyebrow, um título, uma descrição curta e uma ação principal.
- **Consistência entre áreas.** Os mesmos tokens, botões, chips, campos, cabeçalhos de seção e estados vazios aparecem em todas as cinco áreas.

### Tokens principais

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--bg` | `#f7f2ea` | `#120f0c` | fundo do papel |
| `--surface` | `#fffdf9` | `#1b1713` | cartões e modais |
| `--surface-2` | `#f0e8dc` | `#26201a` | campos, chips e trilhos |
| `--text` | `#231e19` | `#f5ede2` | texto principal |
| `--muted` | `#6f6358` | `#ab9e90` | texto secundário |
| `--primary` | `#bf472d` | `#ff8f72` | terracota de ação e destaque |
| `--primary-fill` | `#bf472d` | `#b8442a` | preenchimento de botões e badges |
| `--on-primary` | `#fffaf6` | `#fff8ef` | texto sobre terracota |
| `--accent` | `#0f6f68` | `#4cc9bd` | teal de apoio e confirmação |
| `--gold` | `#9a661a` | `#e0ad5a` | selos de simulação e avisos |

A separação entre `--primary` e `--primary-fill` permite usar o terracota claro no texto do tema escuro sem perder contraste no preenchimento dos botões.

### Tipografia

- Títulos: `Iowan Old Style`, `Palatino Linotype`, Palatino, Georgia, serif.
- Texto e controles: `Segoe UI Variable Text`, `Segoe UI`, system-ui, sans-serif.
- Escala: títulos de página com `clamp(30px, 3.6vw, 44px)`, títulos de seção em 22 px, corpo entre 12 e 15 px e metadados entre 9 e 11 px.

### Ícones

Os ícones são SVGs inline próprios, centralizados em `backend/node-api/public/js/core.js`. O mesmo conjunto é usado no topo, na barra inferior, nos cartões, nos modais e nos estados vazios. Isso evita dependência externa e mantém o traço consistente.

## Navegação

### Desktop

Barra superior com marca, cinco destinos, notificações, tema, botão Publicar e avatar. O item ativo recebe fundo escuro e texto claro.

### Celular

Barra inferior fixa com os cinco destinos. Namoro recebe um toque de terracota no ícone para marcar a área separada, sem competir com o estado ativo. O botão Publicar vira um ícone circular no topo.

### Mapa das áreas

| Área | Rota interna | Conteúdo principal |
| --- | --- | --- |
| Início | `home` | Stories, feed vertical em coluna única, rail de sugestões e teaser de Namoro |
| Explorar | `explore` | Busca, pessoas e grade de publicações |
| Namoro | `dating` | Gate, onboarding, descoberta, matches, Radar e Meu perfil |
| Mensagens | `messages` | Lista de conversas e thread |
| Perfil | `profile` | Capa, avatar, bio, interesses, privacidade e publicações |

## Correções e entregas

### Estilo e componentes

- Camada de componentes compartilhados: chips, campos, cabeçalhos de seção, status, progresso, switches, skeletons e estados vazios.
- Explorar: busca, pessoas, cartões e grade.
- Perfil: interesses, privacidade, capa e galeria.
- Mensagens: layout de dois painéis, lista, bolhas, compositor e estados vazios.
- Namoro: gate, onboarding, cartões de descoberta, matches, perfil, questionário e Radar.
- Modais: notificações, bloqueio, denúncia, compartilhamento, menu e confirmação.
- Responsividade em 1080, 900, 820 e 520 px.

### Navegação e acessibilidade

- Skip link corrigido.
- Itens do topo em `inline-flex`, com ícone e rótulo na mesma linha.
- Badge de Mensagens com espaço reservado e alinhamento vertical.
- `[hidden]` com `display: none !important` para badges zerados.
- Foco visível em todos os controles.
- `aria-label` nos ícones e ações sem texto.
- `tabindex="-1"` na região de conteúdo para o skip link funcionar.
- `prefers-reduced-motion` respeitado.

### Correções funcionais

- `setBusy` restaura o HTML original do botão e preserva os ícones.
- Abrir uma conversa zera o contador local, remove o badge da lista e atualiza os badges globais.
- Abas de Namoro compactadas no celular para caber as quatro opções.
- Stories vistos com dessaturação suave em vez de aparência desabilitada.

## QA

### Teste de fumaça

`npm test` sobe um servidor isolado com banco temporário e executa `backend/node-api/qa/smoke.mjs`. Cobertura atual:

- login demo e cookie de sessão;
- `/api/me`, feed, explorar, stories, busca e perfil;
- seguir/deixar de seguir, curtir, comentar e apagar comentário;
- criar/apagar publicação e story;
- status de namoro, descoberta, matches e Radar;
- conversas, thread e notificações;
- logout e encerramento de sessão.

Resultado: **28 verificações aprovadas**.

### Lighthouse

Auditoria da página inicial no navegador integrado:

| Categoria | Pontuação |
| --- | --- |
| Acessibilidade | 100 |
| Boas práticas | 100 |
| SEO | 100 |

### Capturas

As capturas finais ficam em `backend/node-api/qa/` e são geradas com Chromium headless via CDP. O script `backend/node-api/qa/shot.ps1` usa um perfil temporário, porta CDP aleatória e banco `backend/node-api/data/vibra.db`.

## Próximos passos sugeridos (Fase 2)

1. Revisar os fluxos de denúncia e moderação com uma fila de análise e estados de retorno.
2. Melhorar o onboarding de Namoro com etapas mais curtas e salvamento parcial visível.
3. Adicionar paginação real no feed e em Explorar, com skeletons consistentes.
4. Criar testes de interface para os cinco destinos e para os modais principais.
5. Revisar o comportamento de notificações em tempo real e a atualização de badges entre abas.
6. Auditar contraste no tema escuro com ferramenta automatizada e ampliar os testes de teclado.
