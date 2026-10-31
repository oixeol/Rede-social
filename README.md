# Vibra 2.0

Rede social local com descoberta de afinidades e uma área de namoro separada, verificada e baseada em consentimento. O projeto é original: não usa código, marca, layout ou imagens do Instagram ou do Tinder.

O escopo completo e o histórico de cada alteração ficam em [`FUNCIONALIDADES.md`](FUNCIONALIDADES.md).

![Início do Vibra](qa/final-feed.png)

Repositório: [`github.com/oixeol/Rede-social`](https://github.com/oixeol/Rede-social)

## Estado atual

> **A aplicação funcional hoje é a implementação em Node.js, com SQLite nativo.** O PostgreSQL já está preparado no Docker e o backend em Django/DRF está em fase de migração; ele ainda não substitui a API Node em execução.

| Componente | Estado | Observações |
| --- | --- | --- |
| Aplicação web e API Node.js | **Funcional** | Servidor HTTP, API JSON, frontend HTML/CSS/JavaScript e SQLite nativo. |
| PostgreSQL 18.6 | **Pronto para uso local** | Container com healthcheck e volume persistente `vibra_postgres_data`. |
| Backend Django 5.2 + DRF | **Em preparação** | Configuração inicial criada; apps, modelos, rotas e migrações ainda serão implementados. |
| Testes automatizados | **Disponíveis** | Suítes de fumaça, configuração, Namoro e retenção executadas pelo Node. |
| Documentação do código | **Atualizada** | Comentários em português e JSDoc nas funções principais do backend e do frontend. |

## Como rodar a aplicação atual

Requisitos: **Node.js 22.5 ou superior**. A implementação atual do servidor não tem dependências npm externas e usa o SQLite nativo do Node (`node:sqlite`).

```powershell
cd C:\Vibe
npm start
```

Abra **http://127.0.0.1:4173**. O servidor escuta apenas no loopback, a menos que `HOST` seja definido explicitamente.

A primeira execução cria um banco vazio. Não há conta nem senha de demonstração embutidas. Para popular um banco vazio com os cinco perfis de exemplo, fora de produção:

```powershell
$env:VIBRA_DEMO_PASSWORD='escolha-uma-senha'; npm run seed:demo
```

A senha precisa ter pelo menos 8 caracteres, vale para todos os perfis de exemplo e não é impressa no console. `NODE_ENV=production` recusa esse comando.

Para usar outra porta:

```powershell
$env:PORT=8080; npm start
```

> O Node pode exibir um aviso de que `node:sqlite` é experimental. Isso é esperado e não impede o funcionamento.

### Executar em segundo plano no Windows

Para manter o servidor disponível depois que o terminal for fechado, abra um novo PowerShell e execute:

```powershell
cd C:\Vibe
Start-Process node -ArgumentList 'server.js'
```

Verifique se a porta está ativa:

```powershell
Invoke-WebRequest http://127.0.0.1:4173/ -UseBasicParsing
```

Para encerrar o processo nessa máquina:

```powershell
Get-NetTCPConnection -LocalPort 4173 -State Listen |
  ForEach-Object { Stop-Process -Id $_.OwningProcess }
```

## Banco PostgreSQL local

O projeto inclui uma configuração do **PostgreSQL 18.6** para a futura API Django. Ela é orquestrada pelo Docker Compose e os dados ficam no volume persistente `vibra_postgres_data`.

Requisitos: Docker Desktop ou Docker Engine com suporte ao Compose v2.

```powershell
cd C:\Vibe
docker compose up -d postgres
docker compose ps
```

Quando o healthcheck estiver saudável, o banco estará disponível com os seguintes valores padrão:

| Configuração | Valor padrão |
| --- | --- |
| Host | `127.0.0.1` |
| Porta | `5432` |
| Banco | `vibra` |
| Usuário | `vibra` |
| Senha | `vibra_dev_password` |

A URL usada pelo Django é:

```text
postgresql://vibra:vibra_dev_password@127.0.0.1:5432/vibra
```

Os valores podem ser alterados com `VIBRA_DB_NAME`, `VIBRA_DB_USER`, `VIBRA_DB_PASSWORD` e `VIBRA_DB_PORT`. Esses dados são apenas para desenvolvimento; use segredos próprios fora da máquina local.

Comandos úteis:

```powershell
docker compose ps                 # estado e healthcheck
docker compose logs -f postgres  # logs do banco
docker compose stop postgres     # parar, preservando o volume
docker compose down              # remover o container, preservando o volume
docker compose down -v           # remover container e dados persistidos
```

> `docker compose down -v` apaga o banco. Use apenas quando quiser começar do zero.

## Backend Django em preparação

A pasta `backend/` contém a base do futuro backend com Django 5.2 e Django REST Framework. As dependências já estão declaradas em `backend/requirements.txt` e o ambiente virtual local pode ser criado assim:

```powershell
cd C:\Vibe
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

A configuração inicial está em `backend/vibra/settings.py`. Ela já contempla:

- sessão e cookies seguros;
- CORS restrito aos frontends locais;
- autenticação por sessão do Django;
- arquivos estáticos e uploads em `backend/staticfiles/` e `backend/media/`;
- PostgreSQL por `DATABASE_URL`, com SQLite como fallback local;
- isolamento por idioma `pt-br` e fuso horário configurável.

**Status:** a migração ainda está em andamento. Os apps `accounts`, `social`, `messaging` e `dating`, o modelo de usuário, as URLs, os serializers e as migrations ainda precisam ser criados. Portanto, `python backend/manage.py runserver` ainda não representa a API disponível.

A direção planejada é portar o contrato do `server.js` para Django/DRF e usar o PostgreSQL como persistência principal, mantendo a interface web compatível durante a transição.

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
- Área de namoro com verificação de idade/identidade real via webhook quando configurada; sem credenciais, simulação local explícita
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

Para voltar ao estado inicial, pare o servidor e apague a pasta `data/`. `npm start` recria um banco vazio; o conteúdo de exemplo só volta com `npm run seed:demo`.

## Arquitetura

```text
server.js                 servidor HTTP + API JSON + SQLite + seed opcional
app.config.js             nome, slug e tagline
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
qa/run-tests.mjs          runner isolado (configuração + fumaça + namoro + retenção)
qa/production-tests.mjs   travas de produção, seed e cookie Secure
scripts/seed-demo.mjs     seed explícito, sem senha padrão
qa/dating-tests.mjs       verificação, matches, conversas e Radar
qa/retention-tests.mjs    retenção de localização e sessão
docs/FASE-1.md            registro da análise, decisões e entregas da Fase 1
FUNCIONALIDADES.md        escopo solicitado e histórico de atualizações
```

Decisões principais:

- **Zero dependências**: servidor HTTP com `node:http`, banco com `node:sqlite`, frontend em HTML/CSS/JS puro.
- **Sessões no servidor**: token aleatório, cookie `HttpOnly`, senha com `scrypt` e salt por usuário.
- **Uploads locais**: imagens chegam em base64 (até 8 MB cada) e vídeos usam upload em fluxo contínuo (`POST /api/uploads/video`, até 1 GB); ambos são validados por tipo/tamanho e gravados em `data/uploads/`. A duração de até 60 minutos é conferida no navegador pelos metadados do vídeo. Publicações com várias fotos usam `post_media`, mantendo `posts.image` como capa para compatibilidade.
- **Seed explícito**: dados de demonstração só são criados com `VIBRA_SEED_DEMO=1` e uma senha definida em `VIBRA_DEMO_PASSWORD`. Produção recusa essa opção.
- **Privacidade por padrão**: preferências românticas não aparecem no perfil social; o Radar só calcula distância com consentimento dos dois lados.

## Privacidade e segurança

- Preferências, respostas do quiz, bio do namoro, matches e localização não
  aparecem no perfil social nem nas rotas públicas de perfil.
- A distância nunca aparece na descoberta. Antes do match, a interface mostra
  apenas “distância privada até o match”. Depois, só com consentimento bilateral
  no Radar e com localização recente.
- Bloquear encerra o match, remove os follows entre as partes e impede mensagens,
  curtidas, novas solicitações e interações de namoro. Desbloquear não recria o
  match; é preciso haver novas curtidas mútuas.
- Denúncias de perfil, publicação, story e mensagem entram na fila de moderação.
  As rotas de moderação exigem `ADMIN_TOKEN`.
- Uploads de imagem exigem data URL de imagem válida, até 8 MB; vídeos usam
  streaming com limite de 1 GB. Nomes de arquivo são gerados pelo servidor e
  caminhos são confinados à pasta de uploads.
- Login, cadastro, envios, curtidas, localização, denúncias e moderação têm
  limites de taxa por cliente. Sessões usam token aleatório, hash de senha com
  `scrypt` e cookie `HttpOnly`/`SameSite=Lax`. Em produção o cookie também
  recebe `Secure`; desativar esse atributo interrompe a inicialização.
- Logs não incluem senhas, tokens, documentos, respostas do quiz nem coordenadas.
- A retenção remove localizações, sessões expiradas, alertas antigos,
  notificações lidas antigas e consentimentos de matches encerrados.

## Verificação de identidade (Namoro)

O Namoro é uma área separada e só é liberada quando o backend confirma que a
pessoa tem 18 anos ou mais e possui uma verificação aprovada. Usar o feed, o
perfil social ou as mensagens sociais não exige verificação nem questionário.

- **Desenvolvimento (`IDENTITY_PROVIDER=dev`, padrão fora de produção):** a
  verificação é uma simulação local explicitamente rotulada na interface. O
  endpoint `POST /api/dating/verification/dev-approve` só existe nesse modo.
- **Integração real (`IDENTITY_PROVIDER=webhook` + `IDENTITY_WEBHOOK_SECRET`):**
  o envio cria uma verificação `in_review`; o provedor externo aprova, rejeita
  ou expira por webhook. Sem o segredo, o modo webhook não é ativado.
- **Produção sem provedor (`NODE_ENV=production` sem webhook):** a verificação
  fica desabilitada e o Namoro não pode ser liberado. Aprovações simuladas já
  gravadas no banco também são recusadas (`simulation_not_allowed`).
- **Configuração inválida:** `webhook` sem segredo, `IDENTITY_PROVIDER=dev` em
  produção ou seed de demonstração em produção interrompem a inicialização.
- A data de nascimento usada no cadastro é imutável pela verificação. Tentar
  trocá-la retorna `409 birth_date_locked`.
- A aprovação é sempre recalculada no backend; nenhuma liberação depende do
  frontend. Homens e mulheres menores de 18 são recusados com `not_adult`.

Contrato do webhook:

```http
POST /api/webhooks/identity
X-Vibra-Signature: <HMAC-SHA256 hexadecimal do corpo bruto>
Content-Type: application/json

{
  "userId": 42,
  "status": "approved",
  "providerRef": "id-do-provedor",
  "expiresAt": 1790000000000,
  "reason": "opcional"
}
```

Status aceitos: `approved`, `rejected`, `needs_review`, `expired`. O segredo
nunca é enviado ao navegador. Em produção, coloque o servidor atrás de HTTPS e
de um proxy confiável.

## Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `4173` | Porta HTTP. |
| `HOST` | `127.0.0.1` | Interface de escuta. Expor a rede exige valor explícito. |
| `VIBRA_DATA_DIR` | `./data` | Banco SQLite e uploads. Útil para testes isolados. |
| `NODE_ENV` | vazio | `production` desabilita simulação e recusa seed e cookie sem `Secure`. |
| `VIBRA_SEED_DEMO` | desligado | `1` cria dados de exemplo apenas em banco vazio e fora de produção. |
| `VIBRA_DEMO_PASSWORD` | vazio | Senha obrigatória do seed, com pelo menos 8 caracteres. |
| `IDENTITY_PROVIDER` | `dev` fora de produção | `webhook` ativa a integração real; `dev` é proibido em produção. |
| `IDENTITY_WEBHOOK_SECRET` | vazio | Segredo HMAC obrigatório quando o provedor é `webhook`. |
| `ADMIN_TOKEN` | vazio | Libera `GET/PATCH /api/moderation/reports` via header `X-Admin-Token`. |
| `COOKIE_SECURE` | ligado em produção | `1` adiciona `Secure`; `0` é recusado em produção. |
| `LOCATION_RETENTION_MS` | `86400000` (24 h) | Prazo máximo das localizações aproximadas do Radar. |
| `CLEANUP_INTERVAL_MS` | `900000` (15 min) | Intervalo da limpeza; `0` executa a cada requisição (testes). |

O modelo comentado está em [`.env.example`](.env.example). O arquivo `.env` real não deve ser versionado.

As sessões expiram em 30 dias e são removidas do banco na limpeza. Alertas de
Radar, notificações antigas e consentimentos de matches encerrados também são
limpos periodicamente.

## Testes

`npm test` sobe um servidor isolado em `127.0.0.1`, com banco temporário, seed
de demonstração explícito, senha aleatória, verificação por webhook assinado e
token de moderação. A suíte cobre configuração, fumaça, namoro e retenção:

- **Configuração:** produção recusa seed, webhook sem segredo, simulação de
  identidade e cookie sem `Secure`; banco vazio não cria conta de demonstração.
- **Fumaça:** login, sessão, feed, exploração, busca, perfis, seguir, curtir,
  comentar, publicações, carrossel, vídeo, stories, conversas, notificações,
  privacidade de perfil e todo o fluxo de solicitações de seguimento.
- **Namoro verificado:** bloqueio de menores, data de nascimento imutável,
  assinatura HMAC inválida, quiz, perfil independente, descoberta sem distância,
  match idempotente com curtidas simultâneas, conversa de namoro, expiração da
  verificação, Radar bilateral, revogação, localização apagada, bloqueio,
  desbloqueio, denúncias, moderação, unmatch e fotos validadas.
- **Retenção:** remoção de localização após o prazo e invalidação de sessão
  expirada, em um servidor com janela curta.

```powershell
# sobe um servidor isolado e roda todas as suítes
npm test
```

Para rodar a fumaça contra um servidor já em execução:

```powershell
$env:BASE_URL='http://localhost:4173'; node qa/smoke.mjs
```

As capturas em `qa/` são geradas com Chromium headless via CDP:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File qa/shot.ps1 -Out qa/tela.png -Width 1400 -Height 1000
```

## Limitações

- Projeto local para um único computador. O padrão escuta só em `127.0.0.1` e
  não está pronto para exposição direta na internet. Produção ainda exige
  HTTPS, proxy reverso, backups e banco gerenciado.
- Sem credenciais de um provedor real, a verificação de identidade é uma
  simulação local explícita (`providerMode: dev`). O contrato de webhook está
  documentado acima, mas não foi exercitado contra um fornecedor externo.
- Não há recuperação de senha, autenticação em dois fatores, notificações em
  tempo real, e-mail/push/SMS nem múltiplas instâncias.
- A fila de moderação é local e não substitui uma equipe humana 24/7 nem uma
  política jurídica de privacidade revisada.
- Uploads ficam em `data/uploads/`; não há CDN, storage de objetos ou backup
  automático.
- As imagens de exemplo são SVGs gerados pelo próprio projeto.

---

Projeto local de estudo. Não afiliado ao Instagram ou ao Tinder.
