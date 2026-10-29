# Vibra 2.0

Rede social local com descoberta de afinidades e uma área de namoro separada, verificada e baseada em consentimento. O projeto é original: não usa código, marca, layout ou imagens do Instagram ou do Tinder.

![Início do Vibra](qa/final-feed.png)

## Como rodar

Requisitos: **Node.js 22.5 ou superior**. O projeto não tem dependências externas e usa o SQLite nativo do Node (`node:sqlite`).

```powershell
cd C:\Vibe
npm start
```

Abra **http://localhost:4173**.

Conta demo:

- usuário: `vibra`
- senha: `vibra123`

Para usar outra porta:

```powershell
$env:PORT=8080; npm start
```

> O Node pode exibir um aviso de que `node:sqlite` é experimental. Isso é esperado e não impede o funcionamento.

## As cinco áreas

| Área | Propósito |
| --- | --- |
| **Início** | Mural editorial com stories de 24 horas, feed vertical em coluna única, publicações de quem você segue e atalhos de descoberta. |
| **Explorar** | Busca por pessoas e legendas; sugestões por interesses em comum e grade de publicações. |
| **Namoro** | Área independente para maiores de 18 anos com identidade verificada: descoberta, matches, Radar de proximidade e perfil de afinidade. |
| **Mensagens** | Conversas sociais e conversas de match em um só lugar, com permissões e estados vazios claros. |
| **Perfil** | Perfil público, edição de dados, interesses, privacidade de mensagens e publicações. |

No desktop a navegação fica no topo; no celular, na barra inferior. As duas versões mantêm os mesmos cinco destinos, os mesmos ícones e os mesmos estados ativos.

## O que dá para fazer

- Criar conta e entrar com sessão em cookie `HttpOnly`
- Mural com publicações de quem você segue
- Publicar fotos ou vídeos com legenda; até 10 fotos viram um carrossel navegável
- Vídeos MP4/WEBM de até 60 minutos e 1 GB, com play/pause e mute direto no feed
- Carrossel com setas, contador, indicadores e gesto de arrastar no feed e no post aberto
- Feed em coluna única com fotos de 468 × 623 px no desktop e proporção preservada no celular
- Curtir, comentar, compartilhar e apagar seus próprios comentários
- Stories que expiram em 24 horas, com visualizador, exclusão dos seus, menções com @usuario (notificação e link para o perfil), reações por emoji, respostas em mensagem e lista de visualizações para o autor
- Perfis com bio, foto, seguidores, publicações, privacidade configurável, conquistas (badges) por marcos de uso e listas de seguidores/seguindo
- Seguir e deixar de seguir pessoas
- Perfis privados com solicitação de seguimento: a pessoa escolhe manter o perfil privado, quem quiser seguir envia solicitação e o dono aceita ou recusa
- Modal de solicitações de seguimento com contador no perfil e notificações `follow_request` e `follow_accept`
- Ao voltar o perfil para público, as solicitações pendentes são aceitas automaticamente
- Sistema de badges no perfil: Primeira publicação, Criador, Prolífico, Primeiro seguidor, Popular, Influente, Explorador, Conversador, Storyteller, Verificado e Veterano
- Melhores amigos (close friends): lista gerenciável, stories exclusivos com anel verde e visibilidade restrita a quem foi adicionado
- Explorar publicações e buscar pessoas por nome, usuário ou legenda
- Conversas sociais e conversas de match, com compositor, compartilhamento de publicação e denúncia
- Notificações, bloqueio de pessoas e denúncias de conteúdo
- Área de namoro com verificação de idade/identidade (simulação local explícita)
- Perfil de namoro usa fotos escolhidas entre as fotos já publicadas no perfil social, sem upload separado
- Perfil de namoro independente do perfil social, com fotos, bio e preferências
- Questionário de afinidade com salvamento automático e explicação dos critérios
- Matches, Radar de proximidade com consentimento bilateral e alertas de distância
- Tema claro e escuro
- Layout responsivo para desktop e celular

## Identidade visual

O Vibra usa uma linguagem editorial própria:

- papel quente, terracota e verde-teal como cores principais;
- títulos em serifa e texto em sans-serif;
- cartões com bordas suaves, sombras discretas e cantos generosos;
- ícones SVG próprios, desenhados para a interface;
- grade de publicações e cartões de perfil em vez de pilha de swipe.

Os tokens de cor, tipografia e espaçamento ficam no início de `public/styles.css`. A camada de componentes da Fase 1 começa em `/* Shared components (Phase 1) */`.

## Acessibilidade

- Link “Pular para o conteúdo” visível apenas no foco.
- Foco visível em botões, links, campos e controles.
- Contraste reforçado nos textos secundários e nos botões primários.
- Rótulos ARIA nos ícones e nas ações que não têm texto.
- Estados de carregamento, vazio e erro com texto claro.
- Navegação por teclado nos modais, com fechamento por `Esc`.
- Preferência `prefers-reduced-motion` respeitada.
- Áreas de toque de pelo menos 38–44 px nos controles principais.

## Onde ficam os dados

Tudo fica na pasta `data/`:

- `data/vibra.db` — banco SQLite
- `data/uploads/` — fotos e vídeos enviados e imagens de exemplo

Para voltar ao estado inicial, pare o servidor, apague a pasta `data/` e rode `npm start` novamente. O banco e o conteúdo de exemplo serão recriados.

## Arquitetura

```text
server.js                 servidor HTTP + API JSON + SQLite + seed
app.config.js             nome, slug, tagline e credenciais demo
lib/dating.js             regras de namoro, afinidade, matches e Radar
public/index.html         shell, autenticação e navegação principal
public/js/core.js         estado, API, ícones, modal, navegação e tema
public/js/main.js         inicialização e roteamento
public/js/social.js       Início, Explorar, Perfil e stories
public/js/social-actions.js  modais, notificações, denúncias, bloqueios e compartilhamento
public/js/messages.js     lista de conversas, thread e compositor
public/js/dating.js       gate, descoberta, matches e ações de namoro
public/js/dating-profile.js  perfil de namoro, questionário e Radar
public/styles.css         tokens, layout, componentes e responsividade
qa/                       testes, capturas e scripts de QA
docs/FASE-1.md            registro da análise, decisões e entregas da Fase 1
```

Decisões principais:

- **Zero dependências**: servidor HTTP com `node:http`, banco com `node:sqlite`, frontend em HTML/CSS/JS puro.
- **Sessões no servidor**: token aleatório, cookie `HttpOnly`, senha com `scrypt` e salt por usuário.
- **Uploads locais**: imagens chegam em base64 (até 8 MB cada) e vídeos usam upload em fluxo contínuo (`POST /api/uploads/video`, até 1 GB); ambos são validados por tipo/tamanho e gravados em `data/uploads/`. A duração de até 60 minutos é conferida no navegador pelos metadados do vídeo. Publicações com várias fotos usam `post_media`, mantendo `posts.image` como capa para compatibilidade.
- **Seed automático**: na primeira execução são criados cinco perfis, publicações, stories, perfis de namoro, um match e duas conversas de exemplo.
- **Privacidade por padrão**: preferências românticas não aparecem no perfil social; o Radar só calcula distância com consentimento dos dois lados.

## Testes

O teste de fumaça cobre login, sessão, feed, descobrir, busca, perfil, seguir, curtir, comentar, criar/apagar publicação, criar/apagar carrossel, upload/criação/exclusão de vídeo, criar/apagar story, namoro, matches, Radar, conversas, notificações e o fluxo completo de perfil privado (solicitar, cancelar, aceitar, recusar e auto-aceite ao voltar a público).

```powershell
# sobe um servidor isolado com banco temporário e roda tudo
npm test
```

Para testar contra um servidor já em execução:

```powershell
$env:BASE_URL='http://localhost:4173'; node qa/smoke.mjs
```

As capturas em `qa/` são geradas com Chromium headless via CDP:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File qa/shot.ps1 -Out qa/tela.png -Width 1400 -Height 1000
```

## Limitações

- Projeto local para um único computador; não foi feito para exposição na internet.
- A verificação de identidade é uma simulação local explícita (`providerMode: dev`).
- Não há recuperação de senha, moderação humana, notificações em tempo real ou múltiplas instâncias.
- O visualizador de stories avança automaticamente, mas não tem resposta direta ou reações.
- As imagens de exemplo são SVGs gerados pelo próprio projeto.

---

Projeto local de estudo. Não afiliado ao Instagram ou ao Tinder.
