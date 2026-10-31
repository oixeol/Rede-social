# Vibra — Funcionalidades e Registro de Atualizações

Este arquivo é o registro oficial do que foi pedido para o Vibra e do que já foi
entregue. Ele tem duas partes:

1. **Funcionalidades solicitadas** — o escopo combinado, com o estado atual.
2. **Registro de atualizações** — um histórico cronológico. Toda alteração
   relevante feita no projeto deve acrescentar uma entrada no fim desta seção.

Legenda de estado:

- **Concluído** — implementado e verificado no código.
- **Parcial** — implementado com alguma limitação documentada.
- **Simulação** — funciona localmente, mas depende de integração externa para
  operar em produção.
- **Pendente** — ainda não implementado.

---

## 1. Funcionalidades solicitadas

### 1.1 Produto e identidade

| # | Funcionalidade | Estado | Onde está |
| --- | --- | --- | --- |
| 1 | Rede social local com feed, descoberta, perfis, mensagens e notificações | Concluído | `server.js`, `public/js/` |
| 2 | Marca própria “Vibra”, sem copiar layout, marca ou imagens de Instagram/Tinder | Concluído | `app.config.js`, `public/` |
| 3 | Identidade visual editorial quente (papel, terracota, verde-teal, serifa + sans-serif) | Concluído | `public/styles.css` |
| 4 | Layout responsivo para desktop e celular, com os mesmos cinco destinos | Concluído | `public/styles.css`, `public/index.html` |
| 5 | Áreas obrigatórias: **Início**, **Explorar**, **Namoro**, **Mensagens** e **Perfil** | Concluído | `public/index.html`, `public/js/main.js` |
| 6 | Estados de carregamento, vazio e erro em todas as áreas | Concluído | componentes em `public/js/` |
| 7 | Acessibilidade: foco visível, ARIA, teclado, modais com `Esc`, `prefers-reduced-motion` | Concluído | `public/index.html`, `public/styles.css`, `core.js` |

### 1.2 Rede social

| # | Funcionalidade | Estado | Onde está |
| --- | --- | --- | --- |
| 8 | Cadastro, login, logout e sessão em cookie `HttpOnly` | Concluído | `server.js` |
| 9 | Feed com publicações de quem a pessoa segue | Concluído | `server.js`, `social.js` |
| 10 | Publicações com foto ou vídeo, legenda e carrossel de até 10 fotos | Concluído | `server.js`, `social.js` |
| 11 | Curtir, comentar, apagar os próprios comentários e compartilhar | Concluído | `server.js`, `social.js` |
| 12 | Stories de 24 h, visualizações, menções, reações e respostas | Concluído | `server.js`, `social.js` |
| 13 | Perfis com bio, foto, interesses, seguidores, badges e privacidade | Concluído | `server.js`, `social.js` |
| 14 | Seguir, deixar de seguir, perfil privado e solicitações de seguimento | Concluído | `server.js`, `social-actions.js` |
| 15 | Melhores amigos e stories restritos | Concluído | `server.js`, `social-actions.js` |
| 16 | Explorar e buscar pessoas por nome, usuário, bio ou legenda | Concluído | `server.js`, `social.js` |
| 17 | Tema claro/escuro | Concluído | `core.js`, `styles.css` |

### 1.3 Namoro verificado (18+)

| # | Funcionalidade | Estado | Onde está |
| --- | --- | --- | --- |
| 18 | Namoro separado da rede social; usar o social **não** exige ativar o namoro nem responder o quiz | Concluído | `lib/dating.js`, `dating.js` |
| 19 | Acesso ao namoro somente após verificação de identidade e idade aprovada no backend | Concluído | `lib/dating.js`, `server.js` |
| 20 | Bloqueio real de menores de 18 anos e de data de nascimento inconsistente | Concluído | `lib/dating.js`, `server.js` |
| 21 | Verificação real via provedor quando configurado; sem credenciais, simulação local claramente rotulada | Simulação | `lib/dating.js`, `README.md` |
| 22 | Data de nascimento já cadastrada não pode ser trocada para burlar a verificação | Concluído | `server.js` |
| 23 | Perfil de namoro independente do perfil social (bio, fotos, preferências) | Concluído | `lib/dating.js`, `dating-profile.js` |
| 24 | Fotos do namoro escolhidas entre fotos já publicadas e validadas no backend | Concluído | `lib/dating.js` |
| 25 | Questionário de compatibilidade com salvamento automático e critérios explicados | Concluído | `lib/dating.js`, `dating-profile.js` |
| 26 | Preferência de distância de descoberta entre 10 km e 400 km, padrão 50 km | Concluído | `lib/dating.js`, `dating-profile.js` |
| 27 | Descoberta sem exibir distância antes do match | Concluído | `lib/dating.js`, `dating.js` |
| 28 | Like/deslike e match apenas com curtida mútua, sem duplicatas ou corrida | Concluído | `lib/dating.js` |
| 29 | Desfazer match e impedir novas interações após bloqueio ou unmatch | Concluído | `lib/dating.js`, `server.js` |
| 30 | Conversas de namoro exigem verificação atual dos dois participantes | Concluído | `server.js` |
| 31 | Desativar perfil de namoro sem apagar a conta social | Concluído | `lib/dating.js`, `dating-profile.js` |

### 1.4 Radar de proximidade consensual

| # | Funcionalidade | Estado | Onde está |
| --- | --- | --- | --- |
| 32 | Radar disponível apenas entre pessoas com match | Concluído | `lib/dating.js` |
| 33 | Consentimento separado por match, além do consentimento global do Radar | Concluído | `lib/dating.js`, `dating-profile.js` |
| 34 | Radar desativado por padrão em perfis novos | Concluído | `lib/dating.js` |
| 35 | Localização aproximada, nunca coordenadas exatas, e sem distância antes do match | Concluído | `lib/dating.js` |
| 36 | Pausar/desativar Radar e revogar consentimento a qualquer momento | Concluído | `lib/dating.js`, `dating-profile.js` |
| 37 | Apagar localização revoga todos os consentimentos de Radar da pessoa | Concluído | `lib/dating.js`, `server.js` |
| 38 | Alertas de proximidade respeitam consentimento e estado global dos dois lados | Concluído | `lib/dating.js` |

### 1.5 Privacidade, segurança e moderação

| # | Funcionalidade | Estado | Onde está |
| --- | --- | --- | --- |
| 39 | Bloquear, desbloquear e listar pessoas bloqueadas | Concluído | `server.js`, `social-actions.js` |
| 40 | Bloqueio encerra interações, mensagens e visibilidade entre as partes | Concluído | `server.js`, `lib/dating.js` |
| 41 | Denunciar publicações, comentários, stories, perfis e mensagens | Concluído | `server.js`, `social-actions.js`, `messages.js` |
| 42 | Fila de moderação protegida por `ADMIN_TOKEN` | Concluído | `server.js` |
| 43 | Validação de upload por tipo, tamanho e conteúdo; nomes de arquivo seguros | Concluído | `server.js` |
| 44 | Limite de taxa nas rotas sensíveis (login, cadastro, envio, denúncias etc.) | Concluído | `server.js` |
| 45 | Sessões protegidas: token aleatório, hash no banco, expiração e invalidação | Concluído | `server.js` |
| 46 | Retenção LGPD: limpeza de localizações, sessões, alertas, notificações e consentimentos encerrados | Concluído | `server.js` |
| 47 | Logs sem senhas, tokens, documentos ou coordenadas sensíveis | Concluído | `server.js` |
| 48 | Preferências, respostas do quiz, matches e localização privados do perfil social | Concluído | `lib/dating.js`, `server.js` |
| 49 | Regras de mensagem configuráveis e bloqueio de contato indesejado | Concluído | `server.js` |

### 1.6 Qualidade, testes e documentação

| # | Funcionalidade | Estado | Onde está |
| --- | --- | --- | --- |
| 50 | Testes automatizados de verificação, compatibilidade, matches, Radar e fluxos sociais | Concluído | `qa/run-tests.mjs`, `qa/smoke.mjs`, `qa/dating-tests.mjs`, `qa/retention-tests.mjs` |
| 51 | Teste isolado com banco temporário e porta própria | Concluído | `qa/run-tests.mjs` |
| 52 | Documentação com instruções, variáveis de ambiente, limitações e integrações ausentes | Concluído | `README.md` |
| 53 | Registro contínuo de funcionalidades e atualizações | Concluído | este arquivo |

### 1.7 Requisitos técnicos

| # | Requisito | Estado |
| --- | --- | --- |
| 54 | Node.js 22.5+ | Concluído |
| 55 | Zero dependências externas | Concluído |
| 56 | `node:http` e `node:sqlite` nativos | Concluído |
| 57 | Frontend em HTML, CSS e JavaScript puro | Concluído |
| 58 | Toda ação importante validada e autorizada no backend | Concluído |

### 1.8 Integrações ausentes para produção

Estas dependências externas não existem neste ambiente e estão documentadas como
limitações:

- Provedor real de verificação de identidade/idade (hoje há contrato de webhook,
  mas nenhuma credencial configurada; o modo local é explicitamente simulado).
- Armazenamento de objetos/CDN para uploads (hoje os arquivos ficam em `data/uploads/`).
- Envio real de e-mail, push ou SMS.
- Moderação humana 24/7 e revisão de denúncias fora do painel local.
- Banco gerenciado, backups, múltiplas instâncias e HTTPS/reverse proxy.
- Política de privacidade e termos de uso revisados juridicamente.

---

## 2. Registro de atualizações

Cada entrada descreve o que mudou e por quê. Entradas novas devem ser
acrescentadas ao final, com data e numeração sequencial.

Modelo para novas entradas:

```md
### AAAA-MM-DD — Atualização NNN — Título curto

- O que foi alterado.
- Por que foi alterado.
- Como foi verificado (teste, captura, revisão manual).
```

### 2026-10-28 — Atualização 001 — Auditoria inicial e inventário

- Inventário completo do projeto, banco, rotas, telas e scripts de QA.
- Identificação dos fluxos existentes de rede social, namoro, mensagens e Radar.
- Levantamento de lacunas de autorização, privacidade, estados de interface e testes.
- Confirmadas as credenciais de demonstração fixas no código e o cookie `vibra_session`.

### 2026-10-28 — Atualização 002 — Reparação de codificação do frontend

- Corrigida a codificação de `public/js/social.js`, que estava com caracteres
  duplicados/mojibake em textos e expressões.
- Arquivo reprocessado de Latin-1 para UTF-8; removidos caracteres de substituição.
- Interface voltou a exibir acentos, emojis e textos em português corretamente.

### 2026-10-29 — Atualização 003 — Blindagem da verificação de idade

- `POST /api/dating/verification` não aceita mais alteração da data de nascimento
  de uma conta já cadastrada.
- Divergência entre a data enviada e a data do cadastro retorna `409 birth_date_locked`.
- A idade é sempre recalculada no backend; nenhuma aprovação depende do frontend.

### 2026-10-29 — Atualização 004 — Namoro separado do uso social

- Confirmado que feed, perfil, exploração e mensagens sociais funcionam sem
  ativação do namoro e sem responder ao questionário.
- O gate do namoro permanece exclusivo da área de namoro e das conversas de match.

### 2026-10-29 — Atualização 005 — Mensagens de namoro protegidas

- Conversas de namoro, contagem de não lidas, leitura e envio agora exigem
  verificação vigente dos participantes aplicáveis.
- Respostas passam a informar `dating_locked` quando o acesso foi perdido.
- O frontend mostra uma explicação específica em vez de erro genérico.

### 2026-10-29 — Atualização 006 — Bloqueios explícitos e listagem

- Adicionado `GET /api/blocks` para listar pessoas bloqueadas.
- Adicionados `DELETE` e `PUT /api/users/:username/block`; `POST` continua
  funcionando como alternância para compatibilidade.
- Bloqueio impede mensagens, curtidas, follows e interações de namoro entre as partes.

### 2026-10-29 — Atualização 007 — Retenção e limpeza de dados

- Adicionada limpeza periódica de localizações antigas, sessões expiradas,
  alertas/notificações antigos e consentimentos de matches encerrados.
- Limpeza executada na inicialização e de forma controlada durante requisições.
- Novas variáveis `LOCATION_RETENTION_MS` e `CLEANUP_INTERVAL_MS` permitem
  configurar e testar a retenção.

### 2026-10-29 — Atualização 008 — Distância privada até o match

- Removida a exibição de distância nos cartões de descoberta e na compatibilidade.
- O filtro de distância continua sendo aplicado no backend somente quando os dois
  lados têm localização aproximada recente.
- A distância só aparece depois de um match e dentro do Radar consensual.

### 2026-10-29 — Atualização 009 — Política de mensagens no perfil

- `GET /api/users/:username` passou a expor `messagePolicy`, permitindo à interface
  explicar quem pode iniciar conversa sem revelar dados privados.

### 2026-10-29 — Atualização 010 — Fotos do namoro validadas

- O perfil de namoro não aceita mais caminhos arbitrários em `/uploads/...`.
- Só são aceitas fotos já publicadas pela própria pessoa ou enviadas pelo endpoint
  validado de upload.
- Reduz o risco de referenciar arquivos de terceiros ou caminhos inexistentes.

### 2026-10-29 — Atualização 011 — Radar desligado por padrão

- Novos perfis de namoro são criados com `radar_enabled = 0`.
- O Radar exige ativação explícita e consentimento individual por match.
- Perfis de demonstração continuam com Radar ligado apenas para ilustrar o fluxo.

### 2026-10-29 — Atualização 012 — Radar bilateral e revogação coerente

- O cálculo de proximidade considera o estado global de Radar dos dois usuários.
- Apagar a localização revoga todos os consentimentos de Radar da própria pessoa.
- Pausar ou desligar o Radar interrompe novos alertas imediatamente.

### 2026-10-29 — Atualização 013 — Interface de bloqueios

- Adicionado modal “Pessoas bloqueadas” no perfil, com lista e ação de desbloquear.
- Botão de bloqueio no perfil de terceiros e textos explícitos sobre o efeito.
- Estados de carregamento, vazio e erro incluídos no modal.

### 2026-10-29 — Atualização 014 — Controles do perfil de namoro

- Data de nascimento fica somente leitura quando já existe verificação cadastrada.
- Adicionado botão de desativar perfil de namoro, com confirmação.
- Texto de retenção da localização esclarecido na interface.

### 2026-10-29 — Atualização 015 — Estilos das novas áreas

- Completados estilos de namoro, gate de verificação, quiz, matches, Radar,
  mensagens, bloqueados e estados responsivos.
- Ajustes de layout para telas pequenas, incluindo grids de fotos e cartões.

### 2026-10-30 — Atualização 016 — Runner de testes isolado

- Criado `qa/run-tests.mjs` para subir um servidor próprio com banco temporário,
  porta aleatória e limpeza ao final.
- `npm test` passou a executar o runner em vez de depender de um servidor já aberto.

### 2026-10-30 — Atualização 017 — Registro oficial de funcionalidades

- Criado este `FUNCIONALIDADES.md` com o escopo solicitado, estados e histórico.
- A partir desta atualização, cada mudança relevante deve acrescentar uma entrada
  no registro abaixo.

### 2026-10-30 — Atualização 018 — Documentação de operação e limites

- `README.md` atualizado com instruções de execução, conta demo, arquitetura,
  testes isolados, retenção, privacidade e integrações ausentes em produção.
- Documentado que a verificação de identidade é simulação local sem credenciais.

### 2026-10-30 — Atualização 019 — Verificação final de qualidade

- Execução de `npm test` em servidor isolado.
- Conferência manual das cinco áreas em desktop e celular.
- Correção de regressões encontradas durante a verificação.

### 2026-10-30 — Atualização 020 — Suíte de testes do Namoro e retenção

- Criado `qa/dating-tests.mjs`, com mais de 90 asserções cobrindo:
  cadastro social sem namoro, bloqueio de menores, data de nascimento
  imutável, webhook com assinatura HMAC, aprovação real sem simulação, quiz,
  perfil independente, pontuação de compatibilidade, descoberta sem distância,
  match com curtidas
  simultâneas, conversa de namoro, expiração de verificação, Radar bilateral,
  revogação de consentimento, exclusão de localização, bloqueio, desbloqueio,
  denúncias, moderação, unmatch, fotos validadas e proteção de sessão.
- Criado `qa/retention-tests.mjs`, que sobe um servidor com retenção curta e
  verifica a remoção de localização e a invalidação de sessão expirada.
- `qa/run-tests.mjs` passou a configurar verificação por webhook, `ADMIN_TOKEN`
  e limpeza controlada, executando fumaça, namoro e retenção em sequência.

### 2026-10-30 — Atualização 021 — Revisão visual desktop e mobile

- Verificadas as cinco áreas em 1400×1000 e 390×844 com Chromium headless.
- Início, Namoro, Mensagens e Perfil renderizam sem erros de JavaScript; o feed,
  os cartões de namoro, o seletor de abas e a barra inferior permanecem legíveis.
- Conferidos estados de perfil verificado/simulado, distância privada, filtros de
  descoberta, lista de conversas e botões de bloqueio.
- Ajustado o texto da distância para “distância privada até o match”.

### 2026-10-30 — Atualização 022 — README de operação e segurança

- Documentados os modos de verificação (`dev`, `webhook` e desabilitado em
  produção), o contrato HMAC do webhook e todos os status aceitos.
- Adicionada tabela de variáveis de ambiente, incluindo retenção e moderação.
- Documentadas as garantias de privacidade, bloqueio, uploads, rate limits,
  sessões e limpeza LGPD.
- Atualizadas as suítes de teste e as limitações reais de produção.

### 2026-10-30 — Atualização 023 — Contenção de publicação e baseline

- O servidor passou a escutar em `127.0.0.1` por padrão; expor outra interface
  exige `HOST` explícito.
- O seed deixou de ser automático. Dados de demonstração só são criados com
  `VIBRA_SEED_DEMO=1` e `VIBRA_DEMO_PASSWORD` de pelo menos 8 caracteres, pelo
  comando `npm run seed:demo`.
- Produção recusa seed, simulação de identidade, webhook sem segredo e cookie
  sem `Secure`. Aprovações simuladas existentes não liberam o Namoro.
- Removidos o botão, a ação e as credenciais de demonstração da interface, da
  configuração e da saída do console.
- Adicionados `.gitignore`, `.env.example` e `qa/production-tests.mjs`.
- Os testes que dependem dos perfis de exemplo agora habilitam o seed de forma
  explícita e recebem uma senha aleatória.
