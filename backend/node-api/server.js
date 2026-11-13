'use strict';

/**
 * VIBE - rede social local (tipo Instagram) com foco em comunidade,
 * conteúdo de fotos/vídeos, feed, histórias, mensagens e área de namoro.
 *
 * Arquitetura do módulo:
 * - O servidor HTTP nativo é criado por `http.createServer()` no final do arquivo.
 * - O callback normaliza `req.url` e separa API de uploads.
 * - `handleApi()` despacha as rotas sequencialmente por método e `pathname`;
 *   `matchRoute()` interpreta parâmetros como `:id` e `:username`.
 * - O estado persistente fica em SQLite, acessado de forma síncrona por
 *   `node:sqlite`; não há dependências npm externas.
 *
 * Persistência e arquivos:
 * - `VIBRA_DATA_DIR` define `DATA_DIR`; por padrão, `./data`.
 * - O banco SQLite é `DATA_DIR/vibra.db`.
 * - Uploads são gravados em `DATA_DIR/uploads` e expostos por `/uploads/`.
 * - O frontend React (Next.js) é servido pelo serviço `frontend`; esta API
 *   responde apenas `/api/*` e `/uploads/*`.
 *
 * Mapa aproximado das seções:
 * - 20-120: configuração, ambiente e validação de inicialização.
 * - 120-410: banco SQLite, esquema e migrações aditivas.
 * - 410-1210: helpers, segurança, privacidade, DTOs e uploads.
 * - 1210-1330: consultas e transformação de publicações.
 * - 1330-2740: roteador e handlers da API.
 * - 2740-2780: arquivos estáticos e proteção contra path traversal.
 * - 2780-3370: seed de demonstração e dados sintéticos.
 * - 3370-3460: ciclo de vida do servidor HTTP.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createDatabase } = require('./lib/db');
const { SseHub } = require('./lib/sse-hub');
const { handleChatRoutes } = require('./lib/chat-spaces');
const { ChatWsHub } = require('./lib/chat-ws-hub');
const { presignPut, getBucket } = require('./lib/minio-client');
const { enqueueTranscode, startTranscodeWorker, getHLSManifestUrl, deleteHLS } = require('./lib/video-transcode');
const APP = require('./app.config');
const APP_VERSION = require('./package.json').version;
const dating = require('./lib/dating');

/* Carrega .env da raiz do repositório (sem dependência externa). */
function loadRepoEnv() {
  const envPath = path.resolve(__dirname, '../../.env');
  try {
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(m[1] in process.env)) {
        process.env[m[1]] = value;
      }
    }
  } catch {
    /* arquivo opcional — segue sem .env local */
  }
}
loadRepoEnv();

// Global error handlers to prevent container crashes
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  // Don't exit in production, let the container restart
  if (!IS_PRODUCTION) process.exit(1);
});

const { auth } = require('./lib/auth');

/** Better Auth handler for /api/auth/* routes (lazy initialization) */
const betterAuthHandler = auth.handler;

/* ------------------------------------------------------------------ */
/* Configuração e inicialização                                        */
/* ------------------------------------------------------------------ */

const PORT = Number(process.env.PORT) || 4173;
/* O padrão é loopback. Expor a rede exige HOST explícito. */
const HOST = process.env.HOST || '127.0.0.1';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ROOT = __dirname;
const DATA_DIR = process.env.VIBRA_DATA_DIR
  ? path.resolve(process.env.VIBRA_DATA_DIR)
  : path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const STAGING_DIR = path.join(DATA_DIR, 'staging');
const DB_PATH = path.join(DATA_DIR, 'vibra.db');
const SESSION_COOKIE = 'vibra_session';
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
/* Vídeos grandes usam upload em fluxo contínuo; o limite vale para o arquivo bruto. */
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
/* Localizações do Radar são temporárias. O prazo pode ser reduzido por ambiente. */
const LOCATION_RETENTION_MS =
  Number(process.env.LOCATION_RETENTION_MS) > 0
    ? Number(process.env.LOCATION_RETENTION_MS)
    : 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS =
  Number(process.env.CLEANUP_INTERVAL_MS) >= 0
    ? Number(process.env.CLEANUP_INTERVAL_MS)
    : 15 * 60 * 1000;

/*
 * Dados de demonstração são opt-in. Nunca são criados automaticamente e não
 * podem ser habilitados em produção. A senha não tem valor padrão: quem
 * habilitar o seed precisa definir VIBRA_DEMO_PASSWORD.
 */
const SEED_DEMO = ['1', 'true'].includes(String(process.env.VIBRA_SEED_DEMO || '').toLowerCase());
const SEED_ONLY = process.env.VIBRA_SEED_ONLY === '1';
const DEMO_PASSWORD = process.env.VIBRA_DEMO_PASSWORD || '';
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === '1' ||
  (IS_PRODUCTION && process.env.COOKIE_SECURE !== '0');

/**
 * Verificação de identidade:
 * - `dev` (padrão fora de produção): simulação explícita, sem documentos.
 * - `webhook`: integração real via provedor externo + segredo HMAC.
 * - `disabled`: nenhuma verificação disponível; o Namoro fica bloqueado.
 * Configurações incompletas ou inseguras interrompem a inicialização.
 */
const IDENTITY_PROVIDER = process.env.IDENTITY_PROVIDER || '';
const IDENTITY_WEBHOOK_SECRET = process.env.IDENTITY_WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

function failConfig(message) {
  console.error(`Configuração inválida: ${message}`);
  process.exit(1);
}

if (IS_PRODUCTION && SEED_DEMO) {
  failConfig('VIBRA_SEED_DEMO não pode ser habilitado com NODE_ENV=production.');
}
if (SEED_DEMO && DEMO_PASSWORD.length < 8) {
  failConfig('VIBRA_SEED_DEMO=1 exige VIBRA_DEMO_PASSWORD com pelo menos 8 caracteres.');
}
if (SEED_ONLY && !SEED_DEMO) {
  failConfig('VIBRA_SEED_ONLY=1 exige VIBRA_SEED_DEMO=1.');
}
if (IDENTITY_PROVIDER && !['dev', 'webhook'].includes(IDENTITY_PROVIDER)) {
  failConfig('IDENTITY_PROVIDER deve ser "dev" ou "webhook".');
}
if (IDENTITY_PROVIDER === 'webhook' && !IDENTITY_WEBHOOK_SECRET) {
  failConfig('IDENTITY_PROVIDER=webhook exige IDENTITY_WEBHOOK_SECRET.');
}
if (IS_PRODUCTION && IDENTITY_PROVIDER === 'dev') {
  failConfig('IDENTITY_PROVIDER=dev não é permitido com NODE_ENV=production.');
}
if (IS_PRODUCTION && process.env.COOKIE_SECURE === '0') {
  failConfig('COOKIE_SECURE=0 não é permitido em produção; publique atrás de HTTPS.');
}

const IDENTITY_MODE =
  IDENTITY_PROVIDER === 'webhook'
    ? 'webhook'
    : IDENTITY_PROVIDER === 'dev'
      ? 'dev'
      : IS_PRODUCTION
        ? 'disabled'
        : 'dev';

if (IS_PRODUCTION && !ADMIN_TOKEN) {
  console.warn('Aviso: ADMIN_TOKEN ausente; a fila de moderação ficará desativada.');
}
if (IS_PRODUCTION && IDENTITY_MODE === 'disabled') {
  console.warn('Aviso: verificação de identidade desativada; o Namoro ficará bloqueado.');
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(STAGING_DIR, { recursive: true });

/*
 * Persistência: SQLite local por padrão; PostgreSQL (Supabase) quando
 * `DATABASE_URL` estiver definido. A API do driver é a mesma nos dois casos
 * (`prepare().get/all/run`), então o restante do servidor não muda.
 */
const db = createDatabase({ sqlitePath: DB_PATH });
const USING_POSTGRES = db.mode === 'postgres';
/* SSE revalida a sessão a cada keepalive: revogação/expiração encerra o stream. */
const sseHub = new SseHub({
  isSessionActive: (token, userId) => {
    if (!token || !Number.isInteger(userId)) return false;
    const row = db
      .prepare('SELECT user_id FROM sessions WHERE token = ? AND created_at > ?')
      .get(token, Date.now() - SESSION_TTL);
    return !!row && row.user_id === userId;
  },
});

if (USING_POSTGRES) {
  console.log('Banco de dados: PostgreSQL (Supabase).');
} else {
  /* WAL permite leituras concorrentes ao backend síncrono sem bloquear cada escrita. */
  db.exec('PRAGMA journal_mode = WAL');
  /* Foreign keys são desativadas por padrão no SQLite; este PRAGMA garante cascatas. */
  db.exec('PRAGMA foreign_keys = ON');
}

/* ------------------------------------------------------------------ */
/* WebSocket Hub para chat, presence, typing, voice signaling         */
/* ------------------------------------------------------------------ */
const wsHub = new ChatWsHub({
  isSessionActive: (token, userId) => {
    if (!token || !Number.isInteger(userId)) return false;
    const row = db
      .prepare('SELECT user_id FROM sessions WHERE token = ? AND created_at > ?')
      .get(token, Date.now() - SESSION_TTL);
    return !!row && row.user_id === userId;
  },
  maxConnectionsPerUser: 5,
});

/* ------------------------------------------------------------------ */
/* Video transcoding worker                                           */
/* ------------------------------------------------------------------ */
let transcodeWorker = null;
try {
  transcodeWorker = startTranscodeWorker(2);
  console.log('[Transcode] Worker started (concurrency: 2)');
} catch (err) {
  console.warn('[Transcode] Worker failed to start (Redis/FFmpeg unavailable):', err.message);
}

/* ------------------------------------------------------------------ */
/* Schema SQLite                                                       */
/* ------------------------------------------------------------------ */

/*
 * Cria ou atualiza todas as tabelas e índices usados pela API e pelo seed.
 * No PostgreSQL o schema é versionado em `supabase/migrations`, então o DDL
 * abaixo só roda no modo SQLite.
 */
const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar TEXT,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    highlights TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS post_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image',
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media(post_id, position, id);

  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

  CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (follower_id, following_id)
  );

  CREATE TABLE IF NOT EXISTS follow_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    UNIQUE (requester_id, target_id)
  );
  CREATE INDEX IF NOT EXISTS idx_follow_requests_target ON follow_requests(target_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS close_friends (
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (owner_id, friend_id)
  );
  CREATE INDEX IF NOT EXISTS idx_close_friends_owner ON close_friends(owner_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS story_reactions (
    story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (story_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_story_reactions_story ON story_reactions(story_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_stories_expiry ON stories(expires_at);

  CREATE TABLE IF NOT EXISTS story_views (
    story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at INTEGER NOT NULL,
    PRIMARY KEY (story_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS shares (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, post_id)
  );
  CREATE INDEX IF NOT EXISTS idx_shares_post ON shares(post_id);

  /* Repost: publicação replicada no feed de quem repostou. */
  CREATE TABLE IF NOT EXISTS reposts (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, post_id)
  );
  CREATE INDEX IF NOT EXISTS idx_reposts_post ON reposts(post_id);

  /* Salvo (bookmark): publicação guardada pelo próprio usuário. */
  CREATE TABLE IF NOT EXISTS saved_posts (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, post_id)
  );
  CREATE INDEX IF NOT EXISTS idx_saved_posts_post ON saved_posts(post_id);

  CREATE TABLE IF NOT EXISTS blocks (
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id)
  );
  CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('user', 'post', 'story', 'message')),
    target_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
    created_at INTEGER NOT NULL,
    reviewed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);

  /* Relatos de problemas técnicos enviados pelo menu do perfil. */
  CREATE TABLE IF NOT EXISTS problem_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('bug', 'layout', 'login', 'performance', 'moderation', 'other')),
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    context TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
    created_at INTEGER NOT NULL,
    reviewed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_problem_reports_status ON problem_reports(status, created_at);

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    link TEXT,
    created_at INTEGER NOT NULL,
    read_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);

  CREATE TABLE IF NOT EXISTS identity_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
      'in_review', 'approved', 'rejected', 'needs_review', 'expired'
    )),
    is_simulation INTEGER NOT NULL DEFAULT 0,
    provider_ref TEXT,
    submitted_at INTEGER,
    reviewed_at INTEGER,
    expires_at INTEGER,
    reason TEXT
  );

  CREATE TABLE IF NOT EXISTS dating_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT NOT NULL DEFAULT '',
    photos TEXT NOT NULL DEFAULT '[]',
    interests TEXT NOT NULL DEFAULT '[]',
    goals TEXT NOT NULL DEFAULT '[]',
    age_min INTEGER NOT NULL DEFAULT 24,
    age_max INTEGER NOT NULL DEFAULT 45,
    distance_km INTEGER NOT NULL DEFAULT 50,
    active INTEGER NOT NULL DEFAULT 1,
    paused INTEGER NOT NULL DEFAULT 0,
    radar_enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_dating_active ON dating_profiles(active, paused);

  CREATE TABLE IF NOT EXISTS compatibility_answers (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    answer TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, question_id)
  );

  CREATE TABLE IF NOT EXISTS dating_likes (
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (from_user_id, to_user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_dating_likes_target ON dating_likes(to_user_id, action);

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    ended_at INTEGER,
    ended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CHECK (user_a < user_b)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_active_pair
    ON matches(user_a, user_b) WHERE ended_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_matches_user_a ON matches(user_a, ended_at);
  CREATE INDEX IF NOT EXISTS idx_matches_user_b ON matches(user_b, ended_at);

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('social', 'dating')),
    match_id INTEGER UNIQUE REFERENCES matches(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_members_user ON conversation_members(user_id);

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL DEFAULT '',
    shared_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    edited_at INTEGER,
    deleted_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

  CREATE TABLE IF NOT EXISTS message_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image','video','file')),
    mime_type TEXT,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    file_name TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_message_media_msg ON message_media(message_id, position, id);

  /* Espaços e canais: chats coletivos separados das conversas diretas. */
  CREATE TABLE IF NOT EXISTS chat_spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    avatar TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_space_members (
    space_id INTEGER NOT NULL REFERENCES chat_spaces(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
    presence TEXT NOT NULL DEFAULT 'offline' CHECK (presence IN ('online', 'idle', 'offline')),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (space_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_chat_space_members_user ON chat_space_members(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS chat_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    space_id INTEGER NOT NULL REFERENCES chat_spaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    topic TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'voice')),
    position INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (space_id, slug)
  );
  CREATE INDEX IF NOT EXISTS idx_chat_channels_space ON chat_channels(space_id, position, id);

  /* Voice state: quem está conectado em canal de voz (WebRTC P2P mesh) */
  CREATE TABLE IF NOT EXISTS chat_voice_states (
    channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at INTEGER NOT NULL,
    is_muted INTEGER NOT NULL DEFAULT 0,
    is_deafened INTEGER NOT NULL DEFAULT 0,
    is_speaking INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (channel_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_chat_voice_states_user ON chat_voice_states(user_id);

  CREATE TABLE IF NOT EXISTS chat_channel_members (
    channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (channel_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user ON chat_channel_members(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL DEFAULT '',
    shared_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    edited_at INTEGER,
    deleted_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id, id);

  CREATE TABLE IF NOT EXISTS chat_message_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'file')),
    mime_type TEXT,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    file_name TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_message_media_msg ON chat_message_media(message_id, position, id);

  CREATE TABLE IF NOT EXISTS location_consents (
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (match_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS location_snapshots (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    accuracy REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS radar_prefs (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    alerts_enabled INTEGER NOT NULL DEFAULT 0,
    threshold_m INTEGER NOT NULL DEFAULT 1000,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS radar_alerts (
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_notified_at INTEGER NOT NULL,
    distance_m INTEGER NOT NULL,
    PRIMARY KEY (match_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS communities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    avatar TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS community_members (
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (community_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS community_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL DEFAULT '',
    reply_to_id INTEGER REFERENCES community_posts(id) ON DELETE SET NULL,
    shared_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    deleted_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_community_posts_community ON community_posts(community_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_community_posts_reply ON community_posts(reply_to_id);

  CREATE TABLE IF NOT EXISTS community_post_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'file')),
    mime_type TEXT,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    file_name TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_community_post_media_post ON community_post_media(post_id, position, id);

  CREATE TABLE IF NOT EXISTS community_post_likes (
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (post_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_community_post_likes_user ON community_post_likes(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS community_post_reposts (
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (post_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_community_post_reposts_user ON community_post_reposts(user_id, created_at DESC);

  /* Shorts/Reels: vídeos curtos com HLS streaming */
  CREATE TABLE IF NOT EXISTS shorts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    hls_manifest_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration REAL NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_shorts_user ON shorts(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_shorts_status ON shorts(status, created_at DESC);

  CREATE TABLE IF NOT EXISTS shorts_likes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    short_id INTEGER NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, short_id)
  );
  CREATE INDEX IF NOT EXISTS idx_shorts_likes_short ON shorts_likes(short_id);

  CREATE TABLE IF NOT EXISTS shorts_views (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    short_id INTEGER NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
    watched_at INTEGER NOT NULL,
    watch_time REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, short_id)
  );
  CREATE INDEX IF NOT EXISTS idx_shorts_views_short ON shorts_views(short_id);

  /* Convites de espaço: códigos alfanuméricos de 5 chars, 1h de validade, reutilizáveis após expiração */
  CREATE TABLE IF NOT EXISTS space_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code CHAR(5) NOT NULL UNIQUE,
    space_id INTEGER NOT NULL REFERENCES chat_spaces(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_space_invites_space ON space_invites(space_id, expires_at DESC);
  CREATE INDEX IF NOT EXISTS idx_space_invites_code ON space_invites(code);
`;

if (!USING_POSTGRES) db.exec(SQLITE_SCHEMA);

/* Colunas adicionadas em versões novas, sem recriar tabelas existentes. */
// Verifica a metatable antes de aplicar uma migração aditiva idempotente.
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

if (!USING_POSTGRES) {
  ensureColumn('users', 'birth_date', 'TEXT');
  ensureColumn('users', 'interests', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('users', 'message_policy', "TEXT NOT NULL DEFAULT 'connections'");
  ensureColumn('users', 'is_private', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'last_active_at', 'INTEGER');
  ensureColumn('users', 'banner', 'TEXT');
  ensureColumn('users', 'subscription_status', "TEXT NOT NULL DEFAULT 'free'");
  ensureColumn('users', 'subscription_ends_at', 'INTEGER');
  ensureColumn('users', 'theme_palette', "TEXT NOT NULL DEFAULT 'orange'");
  ensureColumn('users', 'email', 'TEXT');
  ensureColumn('users', 'gender', 'TEXT');
  ensureColumn('users', 'country', 'TEXT');
  ensureColumn('users', 'state', 'TEXT');
  ensureColumn('users', 'points', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'highlights', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('users', 'external_link', 'TEXT');
  ensureColumn('users', 'preferences', "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn('users', 'presence', "TEXT NOT NULL DEFAULT 'available'");
  ensureColumn('sessions', 'user_agent', 'TEXT');
  ensureColumn('posts', 'media_type', "TEXT NOT NULL DEFAULT 'image'");
  ensureColumn('posts', 'topic', "TEXT NOT NULL DEFAULT 'cotidiano'");
  ensureColumn('stories', 'media_type', "TEXT NOT NULL DEFAULT 'image'");
  ensureColumn('stories', 'audience', "TEXT NOT NULL DEFAULT 'public'");
  ensureColumn('stories', 'caption', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('stories', 'mentions', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('messages', 'edited_at', 'INTEGER');
  ensureColumn('chat_spaces', 'avatar', 'TEXT');
  ensureColumn('chat_space_members', 'presence', "TEXT NOT NULL DEFAULT 'offline'");
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Erro de domínio com status HTTP, código estável e detalhes opcionais.
class HttpError extends Error {
  constructor(status, message, code = null, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/* Relógio centralizado: toda a API grava timestamps em milissegundos Unix. */
const now = () => Date.now();

/**
 * Catálogo de interesses da plataforma.
 * Cada item tem `id` (chave estável persistida no banco), `label` (exibição) e
 * `group` (usado na UI para agrupar chips). Alterar um `id` aqui invalida os
 * registros já gravados, pois `INTEREST_IDS` filtra o que é aceito na entrada.
 */
const INTERESTS = [
  { id: 'games', label: 'Games', group: 'Cultura digital' },
  { id: 'musica', label: 'Música', group: 'Cultura' },
  { id: 'filmes', label: 'Filmes e séries', group: 'Cultura' },
  { id: 'futebol', label: 'Futebol', group: 'Esportes' },
  { id: 'academia', label: 'Academia', group: 'Esportes' },
  { id: 'tecnologia', label: 'Tecnologia', group: 'Conhecimento' },
  { id: 'viagens', label: 'Viagens', group: 'Experiências' },
  { id: 'livros', label: 'Livros', group: 'Conhecimento' },
  { id: 'arte', label: 'Arte', group: 'Cultura' },
  { id: 'culinaria', label: 'Culinária', group: 'Sabores' },
  { id: 'natureza', label: 'Natureza', group: 'Experiências' },
  { id: 'humor', label: 'Humor', group: 'Cultura' },
  { id: 'fotografia', label: 'Fotografia', group: 'Cultura' },
  { id: 'corrida', label: 'Corrida', group: 'Esportes' },
  { id: 'cafe', label: 'Café', group: 'Sabores' },
  { id: 'design', label: 'Design', group: 'Cultura' },
  { id: 'animais', label: 'Animais', group: 'Estilo de vida' },
  { id: 'cozinhar', label: 'Cozinhar', group: 'Sabores' },
  { id: 'cinema', label: 'Cinema', group: 'Cultura' },
  { id: 'praia', label: 'Praia', group: 'Natureza' },
  { id: 'trilhas', label: 'Trilhas', group: 'Natureza' },
  { id: 'boardgames', label: 'Jogos de tabuleiro', group: 'Cultura digital' },
  { id: 'podcasts', label: 'Podcasts', group: 'Cultura' },
  { id: 'musica-ao-vivo', label: 'Shows', group: 'Cultura' },
];

/* Conjunto de IDs válidos: usado para validar entrada de interesses. */
const INTEREST_IDS = new Set(INTERESTS.map((item) => item.id));
/* Categorias aceitas no relato de problemas técnicos (menu do perfil). */
const PROBLEM_CATEGORIES = new Set(['bug', 'layout', 'login', 'performance', 'moderation', 'other']);
/* Tópicos aceitos na tag de uma publicação. */
const POST_TOPICS = ['cotidiano', 'fotografia', 'natureza', 'arte', 'gastronomia', 'tecnologia', 'viagens', 'esportes'];
const POST_TOPIC_LABELS = {
  cotidiano: 'Cotidiano',
  fotografia: 'Fotografia',
  natureza: 'Natureza',
  arte: 'Arte',
  gastronomia: 'Gastronomia',
  tecnologia: 'Tecnologia',
  viagens: 'Viagens',
  esportes: 'Esportes',
};
/*
 * Paletas de tema são IDs fixos, nunca valores CSS/hex. O cliente traduz o
 * token recebido para seus próprios estilos; assim a API não aceita estilo
 * arbitrário nem precisa armazenar cores.
 */
const DEFAULT_THEME_PALETTE = 'orange';const THEME_PALETTE_PRESETS = new Set(['orange', 'black', 'white']);
/* Statuses internos que representam uma assinatura utilizável. */
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'subscribed']);
/* Estados de presença (bolinha de status do perfil). */
const PRESENCE_VALUES = new Set(['available', 'away', 'dnd', 'invisible']);
const DEFAULT_PRESENCE = 'available';
/* Idade máxima aceita. Acima disso a data de nascimento é tratada como inválida. */
const MAX_AGE_PLATFORM = 120;

// Converte um campo JSON em lista de strings únicas e opcionalmente filtra IDs permitidos.
function parseJsonArray(value, allowed = null) {
  let parsed;
  try {
    parsed = JSON.parse(value || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const list = [...new Set(parsed.filter((item) => typeof item === 'string'))];
  return allowed ? list.filter((item) => allowed.has(item)) : list;
}

/* Destaques são livres: nome escolhido pelo usuário + um ícone do conjunto
   fechado da plataforma. Não dependem do catálogo de interesses. */
const HIGHLIGHT_ICONS = new Set([
  'crown',
  'gamepad',
  'music',
  'plane',
  'trophy',
  'dumbbell',
  'camera',
  'palette',
  'coffee',
  'sparkles',
]);
const MAX_HIGHLIGHTS = 12;
const MAX_HIGHLIGHT_LABEL = 24;
const HIGHLIGHT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;

/**
 * Normaliza a lista de destaques persistida.
 * Entradas inválidas são descartadas: a API nunca devolve dados quebrados.
 */
function parseHighlights(value) {
  let parsed;
  try {
    parsed = JSON.parse(value || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set();
  const list = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    const icon = typeof item.icon === 'string' ? item.icon : '';
    if (!label || label.length > MAX_HIGHLIGHT_LABEL) continue;
    if (!HIGHLIGHT_ICONS.has(icon)) continue;
    const id = typeof item.id === 'string' && HIGHLIGHT_ID_PATTERN.test(item.id) ? item.id : crypto.randomUUID();
    if (seen.has(id)) continue;
    seen.add(id);
    list.push({ id, label, icon });
    if (list.length >= MAX_HIGHLIGHTS) break;
  }
  return list;
}

/**
 * Valida os destaques enviados pelo cliente no PATCH /api/me.
 * Lança 400 quando a lista não é um array válido.
 */
function sanitizeHighlightsInput(value) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'Destaques inválidos.');
  }
  if (value.length > MAX_HIGHLIGHTS) {
    throw new HttpError(400, `Máximo de ${MAX_HIGHLIGHTS} destaques.`);
  }
  const seen = new Set();
  const list = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      throw new HttpError(400, 'Destaque inválido.');
    }
    const label = cleanText(item.label, 'Nome do destaque', {
      min: 1,
      max: MAX_HIGHLIGHT_LABEL,
      required: true,
      strict: true,
    });
    const icon = typeof item.icon === 'string' ? item.icon : '';
    if (!HIGHLIGHT_ICONS.has(icon)) {
      throw new HttpError(400, 'Ícone de destaque inválido.');
    }
    const id =
      typeof item.id === 'string' && HIGHLIGHT_ID_PATTERN.test(item.id)
        ? item.id
        : crypto.randomUUID();
    if (seen.has(id)) {
      throw new HttpError(400, 'Destaques duplicados.');
    }
    seen.add(id);
    list.push({ id, label, icon });
  }
  return list;
}

/** Grupos permitidos no objeto preferences (client-controlled). */
const PREFERENCES_ALLOWED_KEYS = new Set([
  'notifications',
  'privacy',
  'appearance',
  'content',
]);

/** Parse seguro de string JSON para objeto. */
function parseJsonObject(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Sanitiza preferências recebidas do cliente.
 * Só mantém grupos permitidos e, dentro deles, apenas chaves booleanas.
 */
function sanitizePreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = {};
  for (const [group, values] of Object.entries(input)) {
    if (!PREFERENCES_ALLOWED_KEYS.has(group)) continue;
    if (!values || typeof values !== 'object' || Array.isArray(values)) continue;
    const groupOut = {};
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'boolean') groupOut[key] = value;
    }
    out[group] = groupOut;
  }
  return out;
}

/** Mescla preferências existentes com as novas do PATCH. */
function mergePreferences(currentValue, patchValue) {
  const current = parseJsonObject(currentValue) || {};
  const incoming = sanitizePreferences(patchValue);
  if (!incoming) return current;
  return { ...current, ...incoming };
}

// Calcula a idade válida pela data de nascimento, rejeitando datas ou faixas implausíveis.
function ageFromBirthDate(birthDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(birthDate || ''))) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const beforeBirthday =
    today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  if (age < 0 || age > MAX_AGE_PLATFORM) return null;
  return age;
}

// Indica se a data de nascimento comprova idade mínima.
function isAdult(birthDate, minimum = 18) {
  const age = ageFromBirthDate(birthDate);
  return age !== null && age >= minimum;
}

/**
 * Idade exibida publicamente no perfil.
 * Retorna `null` quando a data é ausente ou inconsistente — a UI trata como
 * "idade não informada" em vez de expor um número inventado.
 */
function publicAge(birthDate) {
  return ageFromBirthDate(birthDate);
}

/**
 * Converte IDs de interesse em rótulos legíveis.
 * IDs desconhecidos são descartados silenciosamente para não quebrar a renderização.
 */
function interestLabels(ids) {
  const map = new Map(INTERESTS.map((item) => [item.id, item.label]));
  return ids.map((id) => map.get(id)).filter(Boolean);
}

/**
 * Verifica se existe bloqueio em QUALQUER direção entre dois usuários.
 * O bloqueio é bilateral por definição: se A bloqueou B, B também deixa de
 * ver A. A query checa as duas permutas de uma vez.
 */
function isBlocked(a, b) {
  return !!db
    .prepare(
      `SELECT 1 AS ok FROM blocks
       WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`
    )
    .get(a, b, b, a);
}

/**
 * Indica se já existe uma conversa social entre dois usuários.
 * Usado para decidir se um usuário que "segue" pode iniciar a primeira mensagem.
 */
function hasConversationBetween(a, b) {
  return !!db
    .prepare(
      `SELECT 1 AS ok FROM conversations c
       JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
       JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
       WHERE c.kind = 'social'
       LIMIT 1`
    )
    .get(a, b);
}

/**
 * Regra de visibilidade do botão "Enviar mensagem" na UI.
 * `message_policy` do alvo controla:
 *  - `everyone`  → qualquer usuário pode falar com o alvo;
 *  - `nobody`    → ninguém inicia conversa;
 *  - `connections` (padrão) → exige seguidores mútuos OU conversa já existente.
 * Bloqueio em qualquer direção sempre impede.
 */
function canMessageTarget(me, target) {
  if (!me || !target || me.id === target.id || isBlocked(me.id, target.id)) return false;
  const policy = target.message_policy || 'connections';
  if (policy === 'everyone') return true;
  if (policy === 'nobody') return false;
  return (isFollowing(me.id, target.id) && isFollowing(target.id, me.id)) || hasConversationBetween(me.id, target.id);
}

/**
 * Regra de envio de mensagem social já em andamento (API).
 * Mais restritiva que `canMessageTarget`: aqui exigir seguidores mútuos,
 * sem a exceção da conversa pré-existente, porque abrir uma conversa nova
 * acontece por outra rota que valida `canMessageTarget`.
 */
function socialSendAllowed(me, target) {
  if (!me || !target || me.id === target.id || isBlocked(me.id, target.id)) return false;
  const policy = target.message_policy || 'connections';
  if (policy === 'everyone') return true;
  if (policy === 'nobody') return false;
  return isFollowing(me.id, target.id) && isFollowing(target.id, me.id);
}

/**
 * Autorização das rotas administrativas (fila de moderação).
 * - Sem `ADMIN_TOKEN` configurado a rota simplesmente não existe (404).
 * - A comparação usa `timingSafeEqual` para não vazar o token por timing.
 */
function requireAdmin(req) {
  if (!ADMIN_TOKEN) throw new HttpError(404, 'Rota não encontrada.');
  const provided = String(req.headers['x-admin-token'] || '');
  const expected = ADMIN_TOKEN;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new HttpError(403, 'Acesso negado.');
  }
}

function rawBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, 'Corpo muito grande.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Lê o corpo bruto da requisição como Buffer, com limite de tamanho.
 * Usado pelo webhook de identidade porque a assinatura HMAC é calculada
 * sobre os bytes exatos recebidos — não sobre o JSON re-serializado.
 */
async function rawBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, 'Corpo muito grande.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Webhook do provedor externo de verificação de identidade.
 *
 * Fluxo:
 *  1. Exige `IDENTITY_MODE=webhook` e segredo configurado (503 caso contrário).
 *  2. Valida a assinatura HMAC-SHA256 do header `x-vibra-signature`
 *     sobre o corpo bruto, em tempo constante (401 se inválida).
 *  3. Valida o payload: `userId` inteiro e `status` na lista permitida.
 *  4. Recusa aprovação de quem não comprove idade mínima (403).
 *  5. Faz upsert em `identity_verifications` e notifica o usuário.
 *
 * Nota: `is_simulation` é zerado aqui — somente o modo `dev` cria simulação.
 */
async function handleIdentityWebhook(req, res) {
  if (IDENTITY_MODE !== 'webhook' || !IDENTITY_WEBHOOK_SECRET) {
    throw new HttpError(503, 'Integração de verificação não configurada.', 'provider_disabled');
  }
  const signature = String(req.headers['x-vibra-signature'] || '');
  const payload = await rawBody(req);
  const expected = crypto.createHmac('sha256', IDENTITY_WEBHOOK_SECRET).update(payload).digest('hex');
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length || !crypto.timingSafeEqual(provided, expectedBuffer)) {
    throw new HttpError(401, 'Assinatura inválida.', 'bad_signature');
  }
  let body;
  try {
    body = JSON.parse(payload.toString('utf8'));
  } catch {
    throw new HttpError(400, 'Payload inválido.');
  }
  const userId = Number(body.userId);
  const status = body.status;
  if (!Number.isInteger(userId) || !['approved', 'rejected', 'needs_review', 'expired'].includes(status)) {
    throw new HttpError(400, 'Payload de verificação inválido.');
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new HttpError(404, 'Usuário não encontrado.');
  if (status === 'approved' && !isAdult(user.birth_date)) {
    throw new HttpError(403, 'Aprovação negada: idade mínima não comprovada.', 'not_adult');
  }
  const timestamp = now();
  const existing = db.prepare('SELECT id FROM identity_verifications WHERE user_id = ?').get(userId);
  const expiresAt = status === 'approved' ? Number(body.expiresAt) || timestamp + 365 * 24 * 60 * 60 * 1000 : null;
  const reason = cleanText(body.reason || '', 'Motivo', { max: 300 });
  if (existing) {
    db.prepare(
      `UPDATE identity_verifications
       SET status = ?, provider_ref = ?, reviewed_at = ?, expires_at = ?, reason = ?, is_simulation = 0
       WHERE user_id = ?`
    ).run(status, String(body.providerRef || '').slice(0, 120), timestamp, expiresAt, reason, userId);
  } else {
    db.prepare(
      `INSERT INTO identity_verifications
       (user_id, provider, status, is_simulation, provider_ref, submitted_at, reviewed_at, expires_at, reason)
       VALUES (?, 'webhook', ?, 0, ?, ?, ?, ?, ?)`
    ).run(userId, status, String(body.providerRef || '').slice(0, 120), timestamp, timestamp, expiresAt, reason);
  }
  notify(
    userId,
    'verification',
    status === 'approved' ? 'Sua verificação de identidade foi aprovada.' : 'Sua verificação de identidade foi atualizada.',
    null
  );
  return json(res, 200, { ok: true });
}

/**
 * Contexto injetado em `lib/dating.js`.
 * O módulo de namoro é isolado do monólito: recebe por injeção tudo que
 * precisa (banco, helpers de JSON, upload, DTO, notificações, etc.).
 * Ao migrar para Django este contexto será substituído por serviços do app.
 */
const datingContext = {
  db,
  json,
  readBody,
  cleanText,
  saveImage,
  removeUploadIfUnused,
  userDTO,
  ageFromBirthDate,
  publicAge,
  isAdult,
  isBlocked,
  notify,
  parseJsonArray,
  interestLabels,
  INTERESTS,
  INTEREST_IDS,
  now,
  rateLimit,
  datingStatusFor,
  IDENTITY_MODE,
  conversationForMatch,
  addConversationMember,
  conversationMembers,
  isConversationMember,
  matchRoute,
  HttpError,
};

/**
 * Cria uma notificação persistida para o usuário.
 * `kind` categoriza o evento (like, follow, message, verification...) e
 * `link` é uma rota interna usada pelo frontend para navegar ao click.
 */
function notify(userId, kind, text, link = null) {
  if (!userId) return;
  db.prepare('INSERT INTO notifications (user_id, kind, text, link, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userId,
    kind,
    text,
    link,
    now()
  );
}

/** Quantidade de notificações ainda não lidas pelo usuário (exclui menções de servidor). */
function unreadNotifications(userId) {
  return db
    .prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL AND kind != ?')
    .get(userId, 'server_mention').n;
}

/**
 * Obtém (ou cria) a conversa associada a um match de namoro.
 * O índice UNIQUE em `conversations.match_id` garante 1:1 entre match e conversa.
 */
function conversationForMatch(matchId) {
  const found = db.prepare('SELECT * FROM conversations WHERE match_id = ?').get(matchId);
  if (found) return found;
  const timestamp = now();
  const result = db
    .prepare("INSERT INTO conversations (kind, match_id, created_at, updated_at) VALUES ('dating', ?, ?, ?)")
    .run(matchId, timestamp, timestamp);
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(Number(result.lastInsertRowid));
}

/**
 * Adiciona um participante à conversa. `INSERT OR IGNORE` torna a operação
 * idempotente. `last_read_at` começa em 0, ou seja, "nada lido ainda".
 */
function addConversationMember(conversationId, userId) {
  db.prepare(
    'INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, last_read_at, created_at) VALUES (?, ?, 0, ?)'
  ).run(conversationId, userId, now());
}

/** Lista os participantes da conversa com dados básicos do usuário. */
function conversationMembers(conversationId) {
  return db
    .prepare(
      `SELECT cm.user_id, u.*
       FROM conversation_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = ?`
    )
    .all(conversationId);
}

/** Verifica se o usuário participa da conversa — base da autorização de leitura. */
function isConversationMember(conversationId, userId) {
  return !!db
    .prepare('SELECT 1 AS ok FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .get(conversationId, userId);
}

/**
 * Quebra todos os vínculos ao bloquear alguém.
 * Remove seguimentos (nos dois sentidos), solicitações pendentes e encerra
 * matches ativos, além de apagar os consentimentos de localização do match.
 * Isso garante que o bloqueio encerra também o Radar e as conversas de match.
 */
function blockRelationships(blockerId, blockedId) {
  db.prepare('DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)').run(
    blockerId,
    blockedId,
    blockedId,
    blockerId
  );
  db.prepare(
    'DELETE FROM follow_requests WHERE (requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)'
  ).run(blockerId, blockedId, blockedId, blockerId);
  const matches = db
    .prepare(
      `SELECT id FROM matches
       WHERE ended_at IS NULL
         AND ((user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?))`
    )
    .all(blockerId, blockedId, blockedId, blockerId);
  for (const match of matches) {
    db.prepare('UPDATE matches SET ended_at = ?, ended_by = ? WHERE id = ?').run(now(), blockerId, match.id);
    db.prepare('DELETE FROM location_consents WHERE match_id = ?').run(match.id);
  }
}

/**
 * Limitador de requisições em memória.
 * `bucket` separa categorias (ex.: 'register', 'login', 'dating'),
 * `max` é o número permitido e `windowMs` a janela deslizante.
 *
 * ATENÇÃO: a chave é `bucket + endereço IP`. Como o servidor escuta apenas em
 * 127.0.0.1 por padrão, todos os usuários locais compartilham o mesmo balde.
 * Na migração para Django/PostgreSQL isso deve virar um contador persistido
 * por usuário + IP.
 */
const RATE_BUCKETS = new Map();

/** Identificador do cliente para fins de rate limit (endereço remoto). */
function clientKey(req) {
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Aplica o limite de requisições. Lança `HttpError(429)` quando excedido.
 * Quando o mapa cresce demais, remove entradas expiradas para conter o consumo
 * de memória (a limpeza só roda acima de 5000 chaves).
 */
function rateLimit(req, bucket, max, windowMs) {
  const key = `${bucket}:${clientKey(req)}`;
  const timestamp = now();
  let entry = RATE_BUCKETS.get(key);
  if (!entry || entry.resetAt <= timestamp) {
    entry = { count: 0, resetAt: timestamp + windowMs };
    RATE_BUCKETS.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > max) {
    const retry = Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1000));
    throw new HttpError(429, `Muitas tentativas. Tente novamente em ${retry}s.`, 'rate_limited');
  }
  if (RATE_BUCKETS.size > 5000) {
    for (const [storedKey, value] of RATE_BUCKETS) {
      if (value.resetAt <= timestamp) RATE_BUCKETS.delete(storedKey);
    }
  }
}

/**
 * Proteção CSRF baseada em Same-Origin.
 * Compara o host do header `Origin` com o header `Host` da requisição.
 * Quando atrás de um proxy reverso (ex.: Next.js rewrites), o proxy deve
 * encaminhar o host público via `X-Forwarded-Host`.
 *
 * ATENÇÃO: requisições SEM header `Origin` são liberadas (`if (!origin) return`).
 * Navegadores modernos enviam `Origin` em POST, mas clientes não-browser
 * (curl, scripts) não. Na migração, usar token CSRF do Django/DRF.
 */
function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new HttpError(403, 'Origem inválida.', 'bad_origin');
  }
  const publicHost = req.headers['x-forwarded-host'] || req.headers.host;
  if (parsed.host !== publicHost) {
    throw new HttpError(403, 'Origem não autorizada.', 'bad_origin');
  }
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  );
}

function datingStatusFor(user) {
  const verification = db
    .prepare('SELECT status, is_simulation, submitted_at, reviewed_at, expires_at, reason FROM identity_verifications WHERE user_id = ?')
    .get(user.id);
  const age = publicAge(user.birth_date);
  let status = verification ? verification.status : 'not_started';
  if (status === 'approved' && verification.expires_at && verification.expires_at <= now()) {
    status = 'expired';
    db.prepare("UPDATE identity_verifications SET status = 'expired' WHERE user_id = ?").run(user.id);
  }
  const adult = age !== null && age >= 18;
  const simulation = verification ? !!verification.is_simulation : IDENTITY_MODE === 'dev';
  /* Produção não aceita aprovação simulada, mesmo que o banco tenha vindo de
     um ambiente de demonstração. */
  const simulationBlocked = IS_PRODUCTION && simulation;
  const allowed = status === 'approved' && adult && !simulationBlocked;
  let reason = null;
  if (status !== 'approved') reason = status;
  else if (!adult) reason = 'not_adult';
  else if (simulationBlocked) reason = 'simulation_not_allowed';
  return {
    status,
    allowed,
    reason,
    age,
    isAdult: adult,
    isSimulation: simulation,
    submittedAt: verification ? verification.submitted_at : null,
    reviewedAt: verification ? verification.reviewed_at : null,
    expiresAt: verification ? verification.expires_at : null,
    note: verification ? verification.reason : null,
    providerMode: IDENTITY_MODE,
  };
}

/**
 * O Namoro é uma área separada: conversas de match, matches e Radar só podem
 * ser lidos enquanto a verificação de identidade e idade estiver válida.
 */
function datingAccessFor(user) {
  return !!user && datingStatusFor(user).allowed;
}

function datingConversationAccess(me, otherId) {
  if (!datingAccessFor(me)) return false;
  if (!otherId) return false;
  const other = db.prepare('SELECT * FROM users WHERE id = ?').get(otherId);
  return datingAccessFor(other);
}

/**
 * Verifica se um destinatário SSE pode receber evento de conversa.
 * Reaplica membership ao vivo, bloqueio bilateral e, se for Namoro,
 * acesso de identidade/idade e match ativo.
 */
function authorizeConversationRecipient(client, conversationId) {
  const recipientId = Number(client?.userId);
  if (!Number.isInteger(recipientId) || recipientId <= 0) return false;
  if (!isConversationMember(conversationId, recipientId)) return false;
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  if (!conversation) return false;
  const members = conversationMembers(conversationId);
  const other = members.find((m) => m.user_id !== recipientId);
  if (!other) return false;
  if (isBlocked(recipientId, other.user_id)) return false;
  if (conversation.kind === 'dating') {
    const recipient = db.prepare('SELECT * FROM users WHERE id = ?').get(recipientId);
    if (!recipient || !datingConversationAccess(recipient, other.user_id)) return false;
    const match = db.prepare('SELECT ended_at FROM matches WHERE id = ?').get(conversation.match_id);
    if (!match || match.ended_at) return false;
  }
  return true;
}

/**
 * Adapta payload por destinatário: define `mine` conforme remetente.
 */
function ssePayloadForRecipient(client, payload) {
  const message = payload?.message;
  if (!message || typeof message !== 'object') return payload;
  const senderId = Number(message.sender?.id);
  const mine = Number.isInteger(senderId) && senderId === Number(client.userId);
  return { ...payload, message: { ...message, mine } };
}

/**
 * * Verifica acesso de Namoro para vários participantes em lote.
 * Mantém as mesmas regras de `datingStatusFor`, mas evita uma consulta por
 * conversa na listagem de mensagens.
 */
function batchDatingConversationAccess(me, otherMembers) {
  const allowed = new Set();
  if (!datingAccessFor(me)) return allowed;

  const uniqueIds = [...new Set(otherMembers.map((member) => member.user_id).filter(Boolean))];
  if (!uniqueIds.length) return allowed;
  const placeholders = uniqueIds.map(() => '?').join(',');
  const verifications = db
    .prepare(
      `SELECT user_id, status, is_simulation, expires_at
       FROM identity_verifications WHERE user_id IN (${placeholders})`
    )
    .all(...uniqueIds);
  const verificationByUser = new Map(verifications.map((verification) => [verification.user_id, verification]));
  const timestamp = now();

  for (const member of otherMembers) {
    const verification = verificationByUser.get(member.user_id);
    let status = verification ? verification.status : 'not_started';
    if (status === 'approved' && verification.expires_at && verification.expires_at <= timestamp) {
      status = 'expired';
      db.prepare("UPDATE identity_verifications SET status = 'expired' WHERE user_id = ?").run(member.user_id);
    }
    const adult = publicAge(member.birth_date) !== null && publicAge(member.birth_date) >= 18;
    const simulation = verification ? !!verification.is_simulation : IDENTITY_MODE === 'dev';
    const simulationBlocked = IS_PRODUCTION && simulation;
    if (status === 'approved' && adult && !simulationBlocked) allowed.add(member.user_id);
  }
  return allowed;
}

/**
 * Retenção mínima de dados temporários. Executado na inicialização e
 * periodicamente; em testes pode ser antecipado com CLEANUP_INTERVAL_MS=0.
 */
let lastCleanupAt = 0;

function cleanupRetention() {
  lastCleanupAt = now();
  const timestamp = lastCleanupAt;
  const result = {};
  result.locations = db
    .prepare('DELETE FROM location_snapshots WHERE updated_at < ?')
    .run(timestamp - LOCATION_RETENTION_MS).changes;
  result.expiredSessions = db
    .prepare('DELETE FROM sessions WHERE created_at < ?')
    .run(timestamp - SESSION_TTL).changes;
  result.oldAlerts = db
    .prepare('DELETE FROM radar_alerts WHERE last_notified_at < ?')
    .run(timestamp - 30 * 24 * 60 * 60 * 1000).changes;
  result.oldReadNotifications = db
    .prepare('DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at < ?')
    .run(timestamp - 90 * 24 * 60 * 60 * 1000).changes;
  result.endedConsents = db
    .prepare(
      `DELETE FROM location_consents
       WHERE match_id IN (
         SELECT id FROM matches WHERE ended_at IS NOT NULL AND ended_at < ?
       )`
    )
    .run(timestamp - 30 * 24 * 60 * 60 * 1000).changes;
  result.deletedMessageMedia = db
    .prepare(
      `DELETE FROM message_media
       WHERE message_id IN (SELECT id FROM messages WHERE deleted_at IS NOT NULL)`
    )
    .run().changes;
  result.deletedChatMessageMedia = db
    .prepare(
      `DELETE FROM chat_message_media
       WHERE message_id IN (SELECT id FROM chat_messages WHERE deleted_at IS NOT NULL)`
    )
    .run().changes;
  cleanupOrphanMessageMedia();
  cleanupStagingDirectory();
  return result;
}

function maybeCleanupRetention() {
  if (now() - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  try {
    cleanupRetention();
  } catch (error) {
    console.error('Falha na limpeza de retenção:', error.message);
  }
}

function json(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

/**
 * Executa uma operação em transação.
 *
 * SQLite usa `BEGIN IMMEDIATE`; o driver PostgreSQL converte para `BEGIN`.
 * Todas as queries ficam na mesma conexão serial do worker, portanto a
 * transação engloba mensagem, anexos e atualizações relacionadas.
 */
function withTransaction(operation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* Preserva o erro original da operação. */
    }
    throw error;
  }
}

function readBody(req, limit = 36 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooBig = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (tooBig) return;
      size += chunk.length;
      if (size > limit) {
        tooBig = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooBig) return reject(new HttpError(413, 'Arquivo muito grande.'));
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Corpo JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

function cookieValue(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq > -1 && part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function createSession(userId, userAgent = null) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at, user_agent) VALUES (?, ?, ?, ?)').run(
    token,
    userId,
    now(),
    userAgent ? String(userAgent).slice(0, 255) : null
  );
  return token;
}

/**
 * Identificador público de uma sessão. Não expõe o token: usa um resumo
 * SHA-256 em hexadecimal, o que permite revogar a sessão sem vazar credencial.
 *
 * @param {string} token Token bruto da sessão.
 * @returns {string} Identificador curto e estável.
 */
function sessionId(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 16);
}

/**
 * Descreve o agente do usuário de forma resumida para a lista de sessões.
 *
 * @param {string|null} userAgent Cabeçalho User-Agent.
 * @returns {string} Texto legível.
 */
function describeUserAgent(userAgent) {
  const agent = String(userAgent || '');
  if (!agent) return 'Dispositivo desconhecido';
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /OPR\//.test(agent)
      ? 'Opera'
      : /Chrome\//.test(agent)
        ? 'Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : /Firefox\//.test(agent)
            ? 'Firefox'
            : 'Navegador';
  const platform = /Windows/.test(agent)
    ? 'Windows'
    : /Android/.test(agent)
      ? 'Android'
      : /(iPhone|iPad|iPod)/.test(agent)
        ? 'iOS'
        : /Mac OS X/.test(agent)
          ? 'macOS'
          : /Linux/.test(agent)
            ? 'Linux'
            : '';
  return platform ? `${browser} · ${platform}` : browser;
}

function cookieAttributes() {
  return `Path=/; HttpOnly; SameSite=Lax${COOKIE_SECURE ? '; Secure' : ''}`;
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; ${cookieAttributes()}; Max-Age=${Math.floor(SESSION_TTL / 1000)}`;
}

function currentUser(req) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token) return null;

  // Try Better Auth session validation first
  try {
    const session = auth.api.getSession({
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });
    if (session?.user) {
      // Fetch user from existing users table (migration: link via email or id)
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user.id);
      if (user) return user;
      // Fallback: try by email
      if (session.user.email) {
        const userByEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(session.user.email);
        if (userByEmail) return userByEmail;
      }
    }
  } catch {
    // Better Auth session validation failed, fall through to legacy
  }

  // Legacy session validation (old sessions table)
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.created_at > ?`
    )
    .get(token, now() - SESSION_TTL);
  if (!row) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return row;
}

function requireUser(req) {
  const user = currentUser(req);
  if (!user) throw new HttpError(401, 'Você precisa entrar para continuar.');
  return user;
}

function userDTO(row) {
  const status = String(row.subscription_status || '').trim().toLowerCase();
  const hasActiveSubscription = ACTIVE_SUBSCRIPTION_STATUSES.has(status) &&
    (row.subscription_ends_at === null || row.subscription_ends_at === undefined || Number(row.subscription_ends_at) > now());
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    bio: row.bio,
    avatar: row.avatar || null,
    banner: row.banner || null,
    interests: parseJsonArray(row.interests, INTEREST_IDS),
    isPrivate: !!row.is_private,
    gender: row.gender || null,
    country: row.country || null,
    state: row.state || null,
    points: row.points || 0,
    highlights: parseHighlights(row.highlights),
    presence: PRESENCE_VALUES.has(row.presence) ? row.presence : DEFAULT_PRESENCE,
    isPremium: hasActiveSubscription,
  };
}

function selfDTO(row) {
  const themeState = themeStateFor(row);
  return {
    ...userDTO(row),
    birthDate: row.birth_date || null,
    messagePolicy: row.message_policy || 'connections',
    canCustomizeTheme: themeState.canCustomizeTheme,
    themePalette: themeState.themePalette,
    email: row.email || null,
    gender: row.gender || null,
    country: row.country || null,
    state: row.state || null,
    points: row.points || 0,
    externalLink: row.external_link || null,
    preferences: parseJsonObject(row.preferences) || {},
  };
}

/**
 * Calcula a entitlement de personalização sem expor o status interno.
 * Statuses ativos valem até `subscription_ends_at`; sem término, a assinatura
 * não expira. Uma assinatura expirada perde a entitlement imediatamente.
 */
function canCustomizeThemeFor(user) {
  if (!user) return false;
  const status = String(user.subscription_status || '').trim().toLowerCase();
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(status)) return false;
  if (user.subscription_ends_at === null || user.subscription_ends_at === undefined) return true;
  const endsAt = Number(user.subscription_ends_at);
  return Number.isFinite(endsAt) && endsAt > now();
}

/**
 * Estado público da paleta. Usuários sem entitlement usam sempre o preset
 * padrão, mesmo que uma assinatura tenha expirado depois da personalização.
 */
function themeStateFor(user) {
  const canCustomizeTheme = canCustomizeThemeFor(user);
  const storedPalette = String(user?.theme_palette || '');
  const themePalette = canCustomizeTheme && THEME_PALETTE_PRESETS.has(storedPalette)
    ? storedPalette
    : DEFAULT_THEME_PALETTE;
  return { canCustomizeTheme, themePalette };
}

/** Remove uma paleta persistida quando a entitlement não está mais válida. */
function resetInvalidThemePalette(user) {
  const state = themeStateFor(user);
  if (!state.canCustomizeTheme || !THEME_PALETTE_PRESETS.has(user.theme_palette)) {
    if (user.theme_palette !== DEFAULT_THEME_PALETTE) {
      db.prepare('UPDATE users SET theme_palette = ? WHERE id = ?').run(DEFAULT_THEME_PALETTE, user.id);
      user.theme_palette = DEFAULT_THEME_PALETTE;
    }
  }
}

function isVerifiedUser(userId) {
  return !!db
    .prepare("SELECT 1 AS ok FROM identity_verifications WHERE user_id = ? AND status = 'approved'")
    .get(userId);
}

function statsFor(userId) {
  const one = (sql) => db.prepare(sql).get(userId).n;
  return {
    posts: one('SELECT COUNT(*) AS n FROM posts WHERE user_id = ?'),
    followers: one('SELECT COUNT(*) AS n FROM follows WHERE following_id = ?'),
    following: one('SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?'),
    comments: one('SELECT COUNT(*) AS n FROM comments WHERE user_id = ?'),
    stories: one('SELECT COUNT(*) AS n FROM stories WHERE user_id = ?'),
    likesReceived: one(
      'SELECT COUNT(*) AS n FROM likes l JOIN posts p ON p.id = l.post_id WHERE p.user_id = ?'
    ),
    verified: isVerifiedUser(userId) ? 1 : 0,
  };
}

const BADGES = [
  { id: 'first_post', label: 'Primeira publicação', icon: 'camera', description: 'Publicou a primeira foto ou vídeo.' },
  { id: 'creator', label: 'Criador', icon: 'image', description: 'Publicou 5 ou mais publicações.' },
  { id: 'prolific', label: 'Prolífico', icon: 'spark', description: 'Publicou 10 ou mais publicações.' },
  { id: 'first_follower', label: 'Primeiro seguidor', icon: 'users', description: 'Ganhou o primeiro seguidor.' },
  { id: 'popular', label: 'Popular', icon: 'heart', description: 'Chegou a 10 seguidores.' },
  { id: 'influencer', label: 'Influente', icon: 'spark', description: 'Chegou a 50 seguidores.' },
  { id: 'explorer', label: 'Explorador', icon: 'compass', description: 'Começou a seguir outras pessoas.' },
  { id: 'conversador', label: 'Conversador', icon: 'message', description: 'Deixou 5 ou mais comentários.' },
  { id: 'storyteller', label: 'Storyteller', icon: 'image', description: 'Publicou o primeiro story.' },
  { id: 'verified', label: 'Verificado', icon: 'shield', description: 'Identidade verificada na área de namoro.' },
  { id: 'veteran', label: 'Veterano', icon: 'check', description: 'Conta ativa há mais de 7 dias.' },
];

function badgesFor(user, stats) {
  const nowTs = now();
  const accountAge = nowTs - Number(user.created_at || nowTs);
  const earned = [];
  const add = (id) => {
    const badge = BADGES.find((item) => item.id === id);
    if (badge) earned.push({ id: badge.id, label: badge.label, icon: badge.icon, description: badge.description });
  };
  if (stats.posts >= 1) add('first_post');
  if (stats.posts >= 5) add('creator');
  if (stats.posts >= 10) add('prolific');
  if (stats.followers >= 1) add('first_follower');
  if (stats.followers >= 10) add('popular');
  if (stats.followers >= 50) add('influencer');
  if (stats.following >= 1) add('explorer');
  if (stats.comments >= 5) add('conversador');
  if (stats.stories >= 1) add('storyteller');
  if (stats.verified) add('verified');
  if (accountAge >= 7 * 24 * 60 * 60 * 1000) add('veteran');
  return earned;
}

function isFollowing(followerId, followingId) {
  return !!db
    .prepare('SELECT 1 AS ok FROM follows WHERE follower_id = ? AND following_id = ?')
    .get(followerId, followingId);
}

function hasFollowRequest(requesterId, targetId) {
  return !!db
    .prepare('SELECT 1 AS ok FROM follow_requests WHERE requester_id = ? AND target_id = ?')
    .get(requesterId, targetId);
}

function isCloseFriend(ownerId, friendId) {
  return !!db
    .prepare('SELECT 1 AS ok FROM close_friends WHERE owner_id = ? AND friend_id = ?')
    .get(ownerId, friendId);
}

function followRequestCount(targetId) {
  return db
    .prepare('SELECT COUNT(*) AS n FROM follow_requests WHERE target_id = ?')
    .get(targetId).n;
}

function canViewUserContent(viewerId, owner) {
  if (!owner) return false;
  if (Number(owner.id) === Number(viewerId)) return true;
  if (!Number(owner.is_private)) return true;
  return isFollowing(viewerId, owner.id);
}

function canViewOwnerContent(viewerId, ownerId) {
  const owner = db.prepare('SELECT id, is_private FROM users WHERE id = ?').get(ownerId);
  return canViewUserContent(viewerId, owner);
}

function assertCanViewOwner(viewerId, ownerId) {
  if (!canViewOwnerContent(viewerId, ownerId)) {
    throw new HttpError(403, 'Este perfil é privado. Envie uma solicitação para seguir e ver o conteúdo.');
  }
}

function acceptFollowRequestRow(request) {
  const timestamp = now();
  db.prepare(
    'INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)'
  ).run(request.requester_id, request.target_id, timestamp);
  db.prepare('DELETE FROM follow_requests WHERE id = ?').run(request.id);
  const requester = db.prepare('SELECT * FROM users WHERE id = ?').get(request.requester_id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(request.target_id);
  if (requester && target) {
    notify(
      requester.id,
      'follow_accept',
      `${target.name} aceitou sua solicitação de seguir.`,
      `/perfil/${encodeURIComponent(target.username)}`
    );
  }
}

const IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/;
const VIDEO_RE = /^data:video\/(mp4|webm);base64,([A-Za-z0-9+/=\s]+)$/;
const MESSAGE_IMAGE_BYTES = 8 * 1024 * 1024;
const MESSAGE_DOCUMENT_BYTES = 25 * 1024 * 1024;
const MESSAGE_MEDIA_MAX_ITEMS = 4;
const MESSAGE_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

function messageMediaError(message, status = 400) {
  return new HttpError(status, message);
}

function sanitizeMessageFileName(value) {
  const name = String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return name || 'documento';
}

function decodeMessageMediaDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > 35 * 1024 * 1024) {
    throw messageMediaError('Anexo inválido.');
  }
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) throw messageMediaError('Anexo inválido.');
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw messageMediaError('Arquivo vazio.');
  return { mimeType, buffer };
}

const MESSAGE_PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MESSAGE_OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const MESSAGE_ZIP_LOCAL_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const MESSAGE_ZIP_CENTRAL_SIGNATURE = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
const MESSAGE_DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Extensão declarada pelo cliente → MIME canônico aceito pelo backend. */
const MESSAGE_EXTENSION_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: MESSAGE_DOCX_MIME,
  rtf: 'application/rtf',
  txt: 'text/plain',
  csv: 'text/csv',
};

/** Caracteres de controle proibidos em texto (tab, LF e CR são permitidos). */
const MESSAGE_TEXT_CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function messageExtensionOf(fileName) {
  const name = String(fileName || '').toLowerCase();
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot >= name.length - 1) return '';
  return name.slice(dot + 1).replace(/[^a-z0-9]/g, '');
}

/** Assinatura rápida: usada só para escolher o limite de tamanho. */
function quickMessageImageSignature(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(MESSAGE_PNG_SIGNATURE)) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

/** GIF fica fora do escopo desta etapa e nunca pode virar documento de texto. */
function isMessageGif(buffer) {
  if (buffer.length < 6) return false;
  const header = buffer.toString('ascii', 0, 6);
  return header === 'GIF87a' || header === 'GIF89a';
}

function isValidMessagePng(buffer) {
  if (buffer.length < 45) return false;
  if (buffer.readUInt32BE(8) !== 13) return false;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return false;
  const iend = buffer.lastIndexOf(Buffer.from('IEND', 'ascii'));
  if (iend < 16 || iend + 4 > buffer.length) return false;
  return buffer.readUInt32BE(iend - 4) === 0;
}

function isValidMessageJpeg(buffer) {
  if (buffer.length < 4) return false;
  const eoi = buffer.lastIndexOf(Buffer.from([0xff, 0xd9]));
  return eoi >= 0 && eoi >= buffer.length - 16;
}

function isValidMessageWebp(buffer) {
  if (buffer.length < 16) return false;
  const riffSize = buffer.readUInt32LE(4);
  if (riffSize + 8 > buffer.length) return false;
  const chunk = buffer.toString('ascii', 12, 16);
  return chunk === 'VP8 ' || chunk === 'VP8L' || chunk === 'VP8X';
}

function isValidMessagePdf(buffer) {
  if (buffer.length < 32) return false;
  if (buffer.toString('ascii', 0, 5) !== '%PDF-') return false;
  const tail = buffer.subarray(Math.max(0, buffer.length - 4096)).toString('latin1');
  return tail.includes('%%EOF');
}

function isValidMessageRtf(buffer) {
  if (buffer.length < 6) return false;
  if (buffer.toString('ascii', 0, 5) !== '{\\rtf') return false;
  return buffer.toString('latin1').trimEnd().endsWith('}');
}

function isValidMessageDoc(buffer) {
  if (buffer.length < 512) return false;
  if (!buffer.subarray(0, 8).equals(MESSAGE_OLE_SIGNATURE)) return false;
  const hasDocument = buffer.includes(Buffer.from('WordDocument', 'utf16le'));
  const hasTable = buffer.includes(Buffer.from('1Table', 'utf16le')) ||
    buffer.includes(Buffer.from('0Table', 'utf16le'));
  return hasDocument && hasTable;
}

/** Nomes de entradas do ZIP (cabeçalhos locais + diretório central). */
function messageZipEntryNames(buffer) {
  const names = new Set();
  const scan = (signature, nameOffset, lengthOffset) => {
    let index = buffer.indexOf(signature);
    while (index !== -1) {
      if (index + lengthOffset + 2 <= buffer.length) {
        const nameLength = buffer.readUInt16LE(index + lengthOffset);
        const start = index + nameOffset;
        if (start + nameLength <= buffer.length) {
          names.add(buffer.toString('utf8', start, start + nameLength));
        }
      }
      index = buffer.indexOf(signature, index + 4);
    }
  };
  scan(MESSAGE_ZIP_LOCAL_SIGNATURE, 30, 26);
  scan(MESSAGE_ZIP_CENTRAL_SIGNATURE, 46, 28);
  return names;
}

function isValidMessageDocx(buffer) {
  if (buffer.length < 100) return false;
  if (!buffer.subarray(0, 4).equals(MESSAGE_ZIP_LOCAL_SIGNATURE)) return false;
  let hasContentTypes = false;
  let hasDocument = false;
  for (const name of messageZipEntryNames(buffer)) {
    const lower = name.toLowerCase();
    if (lower === '[content_types].xml') hasContentTypes = true;
    if (lower === 'word/document.xml') hasDocument = true;
  }
  return hasContentTypes && hasDocument;
}

/** UTF-8 estrito: binário vira null em vez de texto corrompido. */
function decodeMessageText(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

/** Separa linhas CSV respeitando campos entre aspas. */
function splitMessageCsvRows(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        current += '""';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      rows.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.length) rows.push(current);
  return rows;
}

function messageCsvFieldCount(row) {
  let fields = 1;
  let inQuotes = false;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === '"') {
      if (inQuotes && row[index + 1] === '"') {
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === ',') fields += 1;
  }
  return fields;
}

/**
 * CSV precisa ter largura constante e evidência estrutural.
 * Uma coluna com vários registros continua válida; texto simples não vira CSV.
 */
function isConsistentMessageCsv(text) {
  const rows = splitMessageCsvRows(text).filter((row) => row.trim() !== '');
  if (!rows.length) return false;
  const counts = rows.map(messageCsvFieldCount);
  const hasMultipleRecords = rows.length >= 2;
  const hasMultipleColumns = counts[0] >= 2;
  if (!hasMultipleRecords && !hasMultipleColumns) return false;
  return counts.every((count) => count === counts[0]);
}

/**
 * Classifica o anexo pelo conteúdo dos bytes.
 * Retorna `{ ok: false, message }` para conteúdo ambíguo, corrompido ou spoofado.
 */
function classifyMessageMedia(buffer) {
  if (quickMessageImageSignature(buffer) === 'png') {
    if (!isValidMessagePng(buffer)) {
      return { ok: false, message: 'PNG inválido ou corrompido.' };
    }
    return { ok: true, mediaType: 'image', mimeType: 'image/png', extension: 'png' };
  }
  if (quickMessageImageSignature(buffer) === 'jpg') {
    if (!isValidMessageJpeg(buffer)) {
      return { ok: false, message: 'JPEG inválido ou corrompido.' };
    }
    return { ok: true, mediaType: 'image', mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (quickMessageImageSignature(buffer) === 'webp') {
    if (!isValidMessageWebp(buffer)) {
      return { ok: false, message: 'WEBP inválido ou corrompido.' };
    }
    return { ok: true, mediaType: 'image', mimeType: 'image/webp', extension: 'webp' };
  }
  if (isMessageGif(buffer)) {
    return { ok: false, message: 'GIF não é suportado. Envie PNG, JPG ou WEBP.' };
  }
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
    if (!isValidMessagePdf(buffer)) {
      return { ok: false, message: 'PDF inválido ou corrompido.' };
    }
    return { ok: true, mediaType: 'file', mimeType: 'application/pdf', extension: 'pdf' };
  }
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '{\\rtf') {
    if (!isValidMessageRtf(buffer)) {
      return { ok: false, message: 'RTF inválido ou corrompido.' };
    }
    return { ok: true, mediaType: 'file', mimeType: 'application/rtf', extension: 'rtf' };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(MESSAGE_OLE_SIGNATURE)) {
    if (!isValidMessageDoc(buffer)) {
      return { ok: false, message: 'DOC inválido ou corrompido.' };
    }
    return { ok: true, mediaType: 'file', mimeType: 'application/msword', extension: 'doc' };
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(MESSAGE_ZIP_LOCAL_SIGNATURE)) {
    if (!isValidMessageDocx(buffer)) {
      return { ok: false, message: 'DOCX inválido ou corrompido.' };
    }
    return { ok: true, mediaType: 'file', mimeType: MESSAGE_DOCX_MIME, extension: 'docx' };
  }

  const text = decodeMessageText(buffer);
  if (text === null) {
    return { ok: false, message: 'Formato não suportado ou arquivo corrompido.' };
  }
  if (MESSAGE_TEXT_CONTROL_RE.test(text)) {
    return { ok: false, message: 'Arquivo de texto contém caracteres inválidos.' };
  }
  if (isConsistentMessageCsv(text)) {
    return { ok: true, mediaType: 'file', mimeType: 'text/csv', extension: 'csv' };
  }
  return { ok: true, mediaType: 'file', mimeType: 'text/plain', extension: 'txt' };
}

function mapMessageMedia(row) {
  return {
    url: row.url,
    mediaType: row.mediaType || row.media_type || 'file',
    mimeType: row.mimeType || row.mime_type || null,
    sizeBytes: Number(row.sizeBytes ?? row.size_bytes ?? 0),
    fileName: row.fileName || row.file_name || null,
  };
}

function validateMessageMediaItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw messageMediaError('Anexo inválido.');
  }
  const decoded = decodeMessageMediaDataUrl(item.dataUrl);
  const fileName = sanitizeMessageFileName(item.fileName);
  const extension = messageExtensionOf(fileName);
  const classified = classifyMessageMedia(decoded.buffer);
  if (!classified.ok) {
    throw messageMediaError(classified.message);
  }

  const expectedMime = MESSAGE_EXTENSION_MIME[extension];
  if (!expectedMime) {
    throw messageMediaError(
      'Formato não suportado. Envie PNG, JPG, WEBP, PDF, DOC, DOCX, RTF, TXT ou CSV.',
    );
  }
  if (expectedMime !== classified.mimeType) {
    throw messageMediaError('O conteúdo do anexo não corresponde à extensão declarada.');
  }

  const maxBytes = classified.mediaType === 'image' ? MESSAGE_IMAGE_BYTES : MESSAGE_DOCUMENT_BYTES;
  if (decoded.buffer.length > maxBytes) {
    throw messageMediaError(
      classified.mediaType === 'image'
        ? 'Imagem muito grande (limite de 8 MB).'
        : 'Documento muito grande (limite de 25 MB).',
      413,
    );
  }

  return {
    mediaType: classified.mediaType,
    mimeType: classified.mimeType,
    extension: classified.extension,
    sizeBytes: decoded.buffer.length,
    fileName,
    buffer: decoded.buffer,
  };
}

function saveMessageMedia(item, conversationId, userId, { kind = 'conversation' } = {}) {
  const prefix = kind === 'channel' ? 'message-channel' : 'message';
  const filename = `${prefix}-${conversationId}-${userId}-${crypto.randomUUID()}.${item.extension}`;
  const stagedPath = path.join(STAGING_DIR, filename);
  fs.writeFileSync(stagedPath, item.buffer, { flag: 'wx' });
  return {
    filename,
    stagedPath,
    finalPath: path.join(UPLOAD_DIR, filename),
    url: `/uploads/${filename}`,
  };
}

function saveUpload(dataUrl, prefix, { video = false } = {}) {
  if (typeof dataUrl !== 'string' || dataUrl.length > 35 * 1024 * 1024) {
    throw new HttpError(400, video ? 'Vídeo inválido.' : 'Imagem inválida.');
  }
  const regex = video ? VIDEO_RE : IMAGE_RE;
  const match = regex.exec(dataUrl);
  if (!match) {
    throw new HttpError(
      400,
      video ? 'Formato de vídeo não suportado. Use MP4 ou WEBM.' : 'Formato de imagem não suportado. Use PNG, JPG, WEBP ou GIF.'
    );
  }
  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw new HttpError(400, 'Arquivo vazio.');
  const max = video ? 25 * 1024 * 1024 : 8 * 1024 * 1024;
  if (buffer.length > max) throw new HttpError(413, video ? 'Vídeo muito grande (limite de 25 MB).' : 'Imagem muito grande (limite de 8 MB).');
  const filename = `${prefix}-${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

function saveImage(dataUrl, prefix) {
  return saveUpload(dataUrl, prefix, { video: false });
}

function saveVideo(dataUrl, prefix) {
  return saveUpload(dataUrl, prefix, { video: true });
}

function saveVideoStream(req, filename, maxBytes = MAX_VIDEO_BYTES) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(UPLOAD_DIR, filename);
    const stream = fs.createWriteStream(filePath);
    let size = 0;
    let settled = false;
    const cleanup = () => {
      stream.destroy();
      fs.rm(filePath, { force: true }, () => {});
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        fail(new HttpError(413, 'Vídeo muito grande (limite de 1 GB).'));
        req.destroy();
      }
    });
    req.on('aborted', () => fail(new HttpError(400, 'Envio do vídeo interrompido.')));
    req.on('error', fail);
    stream.on('error', fail);
    stream.on('finish', () => {
      if (settled) return;
      if (!size) {
        fail(new HttpError(400, 'Arquivo vazio.'));
        return;
      }
      settled = true;
      resolve({ url: `/uploads/${filename}`, size });
    });
    req.pipe(stream);
  });
}

function requireVideoUpload(value, userId) {
  if (typeof value !== 'string') throw new HttpError(400, 'Vídeo inválido.');
  const url = value.trim();
  if (!url.startsWith('/uploads/')) throw new HttpError(400, 'Vídeo inválido.');
  const filename = url.slice('/uploads/'.length);
  const match = /^video-(\d+)-[a-f0-9]+\.(mp4|webm)$/.exec(filename);
  if (!match || Number(match[1]) !== Number(userId)) throw new HttpError(400, 'Vídeo inválido.');
  if (!fs.existsSync(path.join(UPLOAD_DIR, filename))) {
    throw new HttpError(400, 'Vídeo não encontrado. Envie novamente.');
  }
  return url;
}

function removeUploadIfUnused(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  const filename = url.slice('/uploads/'.length);
  if (filename.includes('/') || filename.includes('\\')) return;

  /* Anexos de mensagem têm namespace próprio. Confirme ausência em
   * message_media e chat_message_media antes de apagar qualquer arquivo final. */
  if (filename.startsWith('message-')) {
    const referenced =
      db.prepare('SELECT 1 AS ok FROM message_media WHERE url = ? LIMIT 1').get(url) ||
      db.prepare('SELECT 1 AS ok FROM chat_message_media WHERE url = ? LIMIT 1').get(url);
    if (!referenced) fs.rmSync(path.join(UPLOAD_DIR, filename), { force: true });
    return;
  }

  const used =
    db.prepare('SELECT 1 AS ok FROM posts WHERE image = ? LIMIT 1').get(url) ||
    db.prepare('SELECT 1 AS ok FROM post_media WHERE url = ? LIMIT 1').get(url) ||
    db.prepare('SELECT 1 AS ok FROM users WHERE avatar = ? LIMIT 1').get(url) ||
    db.prepare('SELECT 1 AS ok FROM users WHERE banner = ? LIMIT 1').get(url) ||
    db.prepare('SELECT 1 AS ok FROM stories WHERE image = ? LIMIT 1').get(url) ||
    db.prepare('SELECT 1 AS ok FROM dating_profiles WHERE instr(photos, ?) > 0 LIMIT 1').get(`"${url}"`);
  if (!used) fs.rmSync(path.join(UPLOAD_DIR, filename), { force: true });
}

/** Confirma no banco antes de remover arquivos de anexos sem referência. */
function cleanupOrphanMessageMedia() {
  const referenced = new Set([
    ...db
      .prepare('SELECT url FROM message_media')
      .all()
      .map((row) => (typeof row.url === 'string' ? row.url : '')),
    ...db
      .prepare('SELECT url FROM chat_message_media')
      .all()
      .map((row) => (typeof row.url === 'string' ? row.url : '')),
  ]);

  for (const filename of fs.readdirSync(UPLOAD_DIR)) {
    if (!filename.startsWith('message-')) continue;
    const url = `/uploads/${filename}`;
    if (!referenced.has(url)) {
      fs.rmSync(path.join(UPLOAD_DIR, filename), { force: true });
    }
  }
}

/** Remove staged files. Inicialização remove todos; execução remove apenas expirados. */
function cleanupStagingDirectory(removeAll = false) {
  const nowMs = Date.now();
  const maxAgeMs = 60 * 60 * 1000;
  for (const filename of fs.readdirSync(STAGING_DIR)) {
    const filePath = path.join(STAGING_DIR, filename);
    const stat = fs.statSync(filePath, { throwIfNoEntry: false });
    if (!stat?.isFile()) continue;
    if (removeAll || nowMs - stat.mtimeMs > maxAgeMs) {
      fs.rmSync(filePath, { force: true });
    }
  }
}

/**
 * Normaliza um texto curto vindo do cliente.
 *
 * Por padrão apenas remove espaços das pontas e valida o tamanho. Com
 * `strict: true` (usado em Nome e Bio) recusa caracteres de controle e
 * remove espaços extras entre palavras. Em textos de uma linha, como o
 * Nome, quebras de linha também são recusadas.
 *
 * @param {*} value Valor recebido.
 * @param {string} field Nome do campo (usado nas mensagens).
 * @param {object} [options] Opções de validação.
 * @param {number} [options.min=0] Tamanho mínimo.
 * @param {number} [options.max=1000] Tamanho máximo.
 * @param {boolean} [options.required=false] Campo obrigatório.
 * @param {boolean} [options.strict=false] Recusa controles e compacta espaços.
 * @param {boolean} [options.multiline=false] Mantém quebras de linha.
 * @returns {string} Texto normalizado.
 */
function cleanText(value, field, { min = 0, max = 1000, required = false, strict = false, multiline = false } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) throw new HttpError(400, `${field} e obrigatorio.`);
  let normalized = text;
  if (strict && text) {
    const forbidden = multiline
      ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
      : /[\u0000-\u001F\u007F]/;
    if (forbidden.test(text)) {
      throw new HttpError(400, `${field} contem caracteres invalidos.`);
    }
    normalized = multiline
      ? text
          .split('\n')
          .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
          .join('\n')
          .trim()
      : text.replace(/\s+/g, ' ');
  }
  if (normalized.length < min) throw new HttpError(400, `${field} muito curto.`);
  if (normalized.length > max) throw new HttpError(400, `${field} muito longo (máximo ${max}).`);
  return normalized;
}

/* ------------------------------------------------------------------ */
/* Posts / comments                                                    */
/* ------------------------------------------------------------------ */

const POST_SELECT = `
  SELECT p.id, p.image, p.caption, p.created_at, p.user_id, p.media_type, p.topic,
         u.username, u.name, u.avatar, u.is_private,
         (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
         (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
         (SELECT COUNT(*) FROM shares sh WHERE sh.post_id = p.id) AS share_count,
         (SELECT COUNT(*) FROM reposts r WHERE r.post_id = p.id) AS repost_count,
         (SELECT COUNT(*) FROM saved_posts sp WHERE sp.post_id = p.id) AS save_count,
         CASE WHEN EXISTS (
           SELECT 1 FROM identity_verifications iv
           WHERE iv.user_id = u.id AND iv.status = 'approved'
         ) THEN 1 ELSE 0 END AS author_verified,
         CASE WHEN EXISTS (
           SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = ?
         ) THEN 1 ELSE 0 END AS liked
  FROM posts p
  JOIN users u ON u.id = p.user_id`;

function mapPost(row) {
  const mediaType = row.media_type || 'image';
  const isTextOnly = mediaType === 'text' || !row.image;
  return {
    id: row.id,
    image: isTextOnly ? '' : row.image,
    mediaType: isTextOnly ? 'text' : mediaType,
    media: isTextOnly ? [] : [{ url: row.image, mediaType }],
    topic: row.topic || 'cotidiano',
    caption: row.caption,
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      username: row.username,
      name: row.name,
      avatar: row.avatar || null,
      isPrivate: !!row.is_private,
      verified: !!row.author_verified,
    },
    likes: row.like_count,
    comments: row.comment_count,
    shares: row.share_count || 0,
    reposts: row.repost_count || 0,
    saves: row.save_count || 0,
    liked: !!row.liked,
    reposted: false,
    saved: false,
    authorFollowing: false,
    authorFollowRequested: false,
  };
}

/**
 * Preenche os campos que dependem de quem está olhando: repost e save próprios
 * e a relação de follow com o autor. Uma consulta por tipo, em lote.
 */
function withViewerState(posts, viewerId) {
  if (!posts.length) return posts;
  const ids = posts.map((post) => post.id);
  const placeholders = ids.map(() => '?').join(',');

  const repostRows = db
    .prepare(`SELECT post_id FROM reposts WHERE user_id = ? AND post_id IN (${placeholders})`)
    .all(viewerId, ...ids);
  const repostedIds = new Set(repostRows.map((row) => row.post_id));

  const savedRows = db
    .prepare(`SELECT post_id FROM saved_posts WHERE user_id = ? AND post_id IN (${placeholders})`)
    .all(viewerId, ...ids);
  const savedIds = new Set(savedRows.map((row) => row.post_id));

  const authorIds = [...new Set(posts.map((post) => post.user.id))];
  const authorPlaceholders = authorIds.map(() => '?').join(',');
  const followRows = db
    .prepare(`SELECT following_id FROM follows WHERE follower_id = ? AND following_id IN (${authorPlaceholders})`)
    .all(viewerId, ...authorIds);
  const followingIds = new Set(followRows.map((row) => row.following_id));

  const followRequestRows = db
    .prepare(`SELECT target_id FROM follow_requests WHERE requester_id = ? AND target_id IN (${authorPlaceholders})`)
    .all(viewerId, ...authorIds);
  const followRequestedIds = new Set(followRequestRows.map((row) => row.target_id));

  for (const post of posts) {
    post.reposted = repostedIds.has(post.id);
    post.saved = savedIds.has(post.id);
    post.authorFollowing = followingIds.has(post.user.id);
    post.authorFollowRequested = followRequestedIds.has(post.user.id);
  }
  return posts;
}

function withMedia(posts) {
  if (!posts.length) return posts;
  const ids = posts.map((post) => post.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT post_id, url, media_type FROM post_media
       WHERE post_id IN (${placeholders})
       ORDER BY post_id ASC, position ASC, id ASC`
    )
    .all(...ids);
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row.post_id) || [];
    list.push({ url: row.url, mediaType: row.media_type || 'image' });
    grouped.set(row.post_id, list);
  }
  for (const post of posts) {
    const media = grouped.get(post.id);
    if (media && media.length) {
      post.media = media;
      post.image = media[0].url;
      post.mediaType = media[0].mediaType;
    }
  }
  return posts;
}

function withPreviews(posts) {
  if (!posts.length) return posts;
  withMedia(posts);
  const ids = posts.map((post) => post.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT c.id, c.post_id, c.text, c.created_at, u.id AS user_id, u.username, u.name, u.avatar
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id IN (${placeholders})
       ORDER BY c.created_at ASC, c.id ASC`
    )
    .all(...ids);
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row.post_id) || [];
    list.push({
      id: row.id,
      text: row.text,
      createdAt: row.created_at,
      user: { id: row.user_id, username: row.username, name: row.name, avatar: row.avatar || null },
    });
    grouped.set(row.post_id, list);
  }
  for (const post of posts) post.preview = (grouped.get(post.id) || []).slice(-2);
  return posts;
}

function commentDTO(row) {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    user: { id: row.user_id, username: row.username, name: row.name, avatar: row.avatar || null },
  };
}

/**
 * Converte uma linha de `communities` no DTO público.
 * `member_count` chega como número (COUNT) e `is_member` como booleano.
 */
function communityDTO(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    avatar: row.avatar || null,
    memberCount: Number(row.member_count || 0),
    isMember: !!row.is_member,
    role: row.role || null,
    createdAt: row.created_at,
  };
}

function shortDTO(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || '',
    description: row.description || '',
    hlsManifestUrl: row.hls_manifest_url,
    thumbnailUrl: row.thumbnail_url,
    duration: row.duration,
    width: row.width,
    height: row.height,
    status: row.status,
    likesCount: Number(row.likes_count || 0),
    viewsCount: Number(row.views_count || 0),
    liked: !!row.liked,
    user: {
      id: row.user_id,
      username: row.username,
      name: row.name,
      avatar: row.avatar,
      verified: !!row.verified,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** SELECT padrão de comunidades com contagem de membros. */
const COMMUNITY_SELECT = `
  SELECT c.id, c.name, c.slug, c.description, c.avatar, c.created_at,
         (SELECT COUNT(*) FROM community_members cm2 WHERE cm2.community_id = c.id) AS member_count
  FROM communities c`;

function commentsFor(postId) {
  return db
    .prepare(
      `SELECT c.id, c.text, c.created_at, u.id AS user_id, u.username, u.name, u.avatar
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ? ORDER BY c.created_at ASC, c.id ASC`
    )
    .all(postId)
    .map(commentDTO);
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

function matchRoute(pathname, pattern) {
  const names = [];
  const source = pattern.replace(/:([A-Za-z]+)/g, (_, name) => {
    names.push(name);
    return '([^/]+)';
  });
  const match = new RegExp(`^${source}$`).exec(pathname);
  if (!match) return null;
  const params = {};
  names.forEach((name, index) => {
    params[name] = decodeURIComponent(match[index + 1]);
  });
  return params;
}

async function handleApi(req, res, pathname, url) {
  const method = req.method;
  maybeCleanupRetention();

  // TESTE: rota de debug
  if (pathname === '/api/auth/debug') {
    return json(res, 200, { 
      msg: 'Debug route works', 
      pathname,
      hasBetterAuthHandler: typeof betterAuthHandler === 'function'
    });
  }

  // TESTE: rota para testar inicialização do Better Auth
  if (pathname === '/api/auth/test-init') {
    try {
      const { getAuth } = require('./lib/auth');
      const auth = await getAuth();
      return json(res, 200, { 
        msg: 'Better Auth initialized successfully',
        hasHandler: typeof auth.handler === 'function'
      });
    } catch (err) {
      console.error('[TEST-INIT] Error:', err);
      return json(res, 500, { 
        error: 'Better Auth init failed',
        message: err.message,
        stack: err.stack
      });
    }
  }

  // Better Auth handles all /api/auth/* routes
  if (pathname.startsWith('/api/auth/')) {
    console.log('[DEBUG] Better Auth route:', pathname);
    return betterAuthHandler(req, res);
  }

  console.log('[DEBUG] Legacy route:', pathname);

  if (method === 'GET' && pathname === '/api/config') {
    return json(res, 200, {
      app: { name: APP.name, slug: APP.slug, tagline: APP.tagline, version: APP_VERSION },
      interests: INTERESTS,
      identity: {
        mode: IDENTITY_MODE,
        simulation: IDENTITY_MODE === 'dev',
        configured: IDENTITY_MODE !== 'disabled',
      },
    });
  }

  // --- webhook de verificação (sem sessão, autenticado por HMAC) -------
  if (method === 'POST' && pathname === '/api/webhooks/identity') {
    return handleIdentityWebhook(req, res);
  }

  // --- auth (backwards compatibility proxies to Better Auth) -------------
  if (method === 'POST' && pathname === '/api/register') {
    // Forward to Better Auth sign-up endpoint
    req.url = '/api/auth/sign-up/email';
    return betterAuthHandler(req, res);
  }

  if (method === 'POST' && pathname === '/api/login') {
    // Forward to Better Auth sign-in endpoint
    req.url = '/api/auth/sign-in/email';
    return betterAuthHandler(req, res);
  }

  if (method === 'POST' && pathname === '/api/logout') {
    // Forward to Better Auth sign-out endpoint
    req.url = '/api/auth/sign-out';
    return betterAuthHandler(req, res);
  }

  if (method === 'POST' && pathname === '/api/auth/forgot-password') {
    // Forward to Better Auth forget-password endpoint
    req.url = '/api/auth/forget-password';
    return betterAuthHandler(req, res);
  }

  // /api/auth/reset-password is handled by Better Auth directly (same path)

  // Verificação de disponibilidade de username (pública, sem autenticação)
  if (method === 'GET' && pathname === '/api/username-available') {
    rateLimit(req, 'username-available', 60, 60 * 1000);
    const u = (url.searchParams.get('username') || '').toLowerCase();
    if (!/^[a-z0-9._]{3,24}$/.test(u)) {
      return json(res, 400, { available: false, error: 'Formato de usuário inválido.' });
    }
    const exists = db.prepare('SELECT 1 AS ok FROM users WHERE username = ?').get(u);
    return json(res, 200, { username: u, available: !exists });
  }

  const me = requireUser(req);

  /* Rotas de espaços, canais, mensagens e SSE. O módulo devolve `null`
   * quando o caminho não pertence ao chat. */
  const chatRoute = await handleChatRoutes({
    req,
    res,
    pathname,
    url,
    me,
    ctx: {
      db,
      readBody,
      cleanText,
      saveMessageMedia,
      validateMessageMediaItem,
      mapMessageMedia,
      removeUploadIfUnused,
      withTransaction,
      now,
      rateLimit,
      sseHub,
      cookieValue,
      isBlocked,
      isConversationMember,
      datingConversationAccess,
      authorizeConversationRecipient,
      ssePayloadForRecipient,
      mapPost,
      POST_SELECT,
      json,
    },
  });
  if (chatRoute) {
    if (chatRoute.handled) return undefined;
    return json(res, chatRoute.status, chatRoute.body);
  }

  if (method === 'POST' && pathname === '/api/uploads/video') {
    rateLimit(req, 'video-upload', 30, 60 * 60 * 1000);
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (contentType !== 'video/mp4' && contentType !== 'video/webm') {
      throw new HttpError(400, 'Formato de vídeo não suportado. Use MP4 ou WEBM.');
    }
    const declaredSize = Number(req.headers['content-length'] || 0);
    if (declaredSize > MAX_VIDEO_BYTES) {
      throw new HttpError(413, 'Vídeo muito grande (limite de 1 GB).');
    }
    const extension = contentType === 'video/webm' ? 'webm' : 'mp4';
    const filename = `video-${me.id}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
    const saved = await saveVideoStream(req, filename);
    return json(res, 201, saved);
  }

  if (method === 'GET' && pathname === '/api/me') {
    const unreadMessages = db
      .prepare(
        `SELECT COUNT(*) AS n FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
         WHERE m.sender_id != ? AND m.deleted_at IS NULL AND m.created_at > cm.last_read_at
           ${datingAccessFor(me) ? '' : "AND c.kind != 'dating'"}`
      )
      .get(me.id, me.id).n;
    resetInvalidThemePalette(me);
    const themeState = themeStateFor(me);
    const meStats = statsFor(me.id);
    return json(res, 200, {
      user: selfDTO(me),
      stats: meStats,
      badges: badgesFor(me, meStats),
      pendingFollowRequests: followRequestCount(me.id),
      unreadNotifications: unreadNotifications(me.id),
      unreadMessages,
      canCustomizeTheme: themeState.canCustomizeTheme,
      themePalette: themeState.themePalette,
    });
  }

  if (method === 'PATCH' && pathname === '/api/me/theme-palette') {
    const body = await readBody(req);
    const bodyKeys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : [];
    if (bodyKeys.length !== 1 || bodyKeys[0] !== 'palette') {
      throw new HttpError(400, 'Informe apenas a paleta de tema.');
    }
    const palette = body.palette;
    if (typeof palette !== 'string' || !THEME_PALETTE_PRESETS.has(palette)) {
      throw new HttpError(400, 'Paleta de tema inválida.');
    }

    resetInvalidThemePalette(me);
    const themeState = themeStateFor(me);
    if (!themeState.canCustomizeTheme) {
      throw new HttpError(403, 'A personalização de tema exige uma assinatura ativa.');
    }

    db.prepare('UPDATE users SET theme_palette = ? WHERE id = ?').run(palette, me.id);
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(me.id);
    const freshThemeState = themeStateFor(fresh);
    return json(res, 200, {
      user: selfDTO(fresh),
      canCustomizeTheme: freshThemeState.canCustomizeTheme,
      themePalette: freshThemeState.themePalette,
    });
  }

  if (method === 'PATCH' && pathname === '/api/me') {
    const body = await readBody(req);
    /* Username e user_id nunca podem ser alterados por esta rota: o perfil
       editado é sempre o do usuário autenticado. */
    if (Object.prototype.hasOwnProperty.call(body, 'username')) {
      throw new HttpError(400, 'O usuario nao pode ser alterado.');
    }
    if (Object.prototype.hasOwnProperty.call(body, 'user_id') || Object.prototype.hasOwnProperty.call(body, 'userId')) {
      throw new HttpError(400, 'O usuario da conta nao pode ser alterado.');
    }
    /* Assinatura é estado interno, gerenciado fora do perfil do cliente. */
    const subscriptionFields = [
      'subscription_status',
      'subscriptionStatus',
      'subscription_ends_at',
      'subscriptionEndsAt',
    ];
    if (subscriptionFields.some((field) => Object.prototype.hasOwnProperty.call(body, field))) {
      throw new HttpError(400, 'A assinatura não pode ser alterada pelo cliente.');
    }
    const name = body.name === undefined ? me.name : cleanText(body.name, 'Nome', { min: 1, max: 40, required: true, strict: true });
    const bio = body.bio === undefined ? me.bio : cleanText(body.bio, 'Bio', { min: 0, max: 150, strict: true, multiline: true });
    let avatar = me.avatar;
    if (body.avatar === null) {
      avatar = null;
    } else if (typeof body.avatar === 'string' && body.avatar) {
      avatar = saveImage(body.avatar, 'avatar');
    }
    let banner = me.banner || null;
    if (body.banner === null) {
      banner = null;
    } else if (typeof body.banner === 'string' && body.banner) {
      banner = saveImage(body.banner, 'banner');
    }
    let interests = parseJsonArray(me.interests, INTEREST_IDS);
    if (Array.isArray(body.interests)) {
      interests = [...new Set(body.interests.filter((item) => typeof item === 'string' && INTEREST_IDS.has(item)))].slice(0, 12);
    }
    /* Destaques são livres: nome escolhido pelo usuário + ícone do conjunto
       fechado da plataforma. A lista inteira é substituída pelo cliente. */
    let highlights = parseHighlights(me.highlights);
    if (body.highlights !== undefined) {
      highlights = sanitizeHighlightsInput(body.highlights);
    }
    let messagePolicy = me.message_policy || 'connections';
    if (body.messagePolicy !== undefined) {
      if (!['everyone', 'connections', 'nobody'].includes(body.messagePolicy)) {
        throw new HttpError(400, 'Política de mensagens inválida.');
      }
      messagePolicy = body.messagePolicy;
    }
    let isPrivate = Number(me.is_private) ? 1 : 0;
    if (body.isPrivate !== undefined) {
      if (typeof body.isPrivate !== 'boolean') {
        throw new HttpError(400, 'Privacidade do perfil inválida.');
      }
      isPrivate = body.isPrivate ? 1 : 0;
    }
    let birthDate = me.birth_date;
    if (!birthDate && body.birthDate !== undefined) {
      birthDate = cleanText(body.birthDate, 'Data de nascimento', { min: 10, max: 10, required: true });
      const age = ageFromBirthDate(birthDate);
      if (age === null) throw new HttpError(400, 'Data de nascimento inválida.');
      if (age < 13) throw new HttpError(403, 'É necessário ter pelo menos 13 anos.');
    }
    let gender = me.gender || null;
    if (body.gender !== undefined) {
      if (body.gender === null || body.gender === '') {
        gender = null;
      } else if (typeof body.gender === 'string') {
        gender = cleanText(body.gender, 'Gênero', { min: 1, max: 40, required: true, strict: true });
      } else {
        throw new HttpError(400, 'Gênero inválido.');
      }
    }
    let email = me.email || null;
    if (body.email !== undefined) {
      if (body.email === null || body.email === '') {
        email = null;
      } else if (typeof body.email === 'string') {
        const candidate = body.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(candidate)) {
          throw new HttpError(400, 'E-mail inválido.');
        }
        const taken = db
          .prepare('SELECT id FROM users WHERE lower(email) = ? AND id != ?')
          .get(candidate, me.id);
        if (taken) throw new HttpError(409, 'Este e-mail já está em uso.');
        email = candidate;
      } else {
        throw new HttpError(400, 'E-mail inválido.');
      }
    }
    let externalLink = me.external_link || null;
    if (body.externalLink !== undefined) {
      if (body.externalLink === null || body.externalLink === '') {
        externalLink = null;
      } else if (typeof body.externalLink === 'string') {
        const link = body.externalLink.trim();
        if (link && !/^https?:\/\//i.test(link)) {
          throw new HttpError(400, 'Link externo deve começar com http:// ou https://');
        }
        if (link && link.length > 200) {
          throw new HttpError(400, 'Link externo muito longo (máx. 200 caracteres).');
        }
        externalLink = link || null;
      }
    }
    const preferences = mergePreferences(me.preferences, body.preferences);
    /* Presença (bolinha de status) só aceita os quatro estados do catálogo. */
    let presence = PRESENCE_VALUES.has(me.presence) ? me.presence : DEFAULT_PRESENCE;
    if (body.presence !== undefined) {
      if (typeof body.presence !== 'string' || !PRESENCE_VALUES.has(body.presence)) {
        throw new HttpError(400, 'Status de presença inválido.');
      }
      presence = body.presence;
    }
    const oldAvatar = me.avatar;
    const oldBanner = me.banner || null;
    db.prepare(
      'UPDATE users SET name = ?, bio = ?, avatar = ?, banner = ?, interests = ?, highlights = ?, message_policy = ?, is_private = ?, birth_date = ?, gender = ?, email = ?, external_link = ?, preferences = ?, presence = ? WHERE id = ?'
    ).run(
      name,
      bio,
      avatar,
      banner,
      JSON.stringify(interests),
      JSON.stringify(highlights),
      messagePolicy,
      isPrivate,
      birthDate,
      gender,
      email,
      externalLink,
      JSON.stringify(preferences),
      presence,
      me.id
    );
    if (oldAvatar && oldAvatar !== avatar) removeUploadIfUnused(oldAvatar);
    if (oldBanner && oldBanner !== banner) removeUploadIfUnused(oldBanner);
    if (Number(me.is_private) === 1 && isPrivate === 0) {
      const pending = db.prepare('SELECT * FROM follow_requests WHERE target_id = ?').all(me.id);
      for (const request of pending) acceptFollowRequestRow(request);
    }
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(me.id);
    const freshStats = statsFor(me.id);
    return json(res, 200, {
      user: selfDTO(fresh),
      stats: freshStats,
      badges: badgesFor(fresh, freshStats),
      pendingFollowRequests: followRequestCount(me.id),
    });
  }

  // --- segurança: sessões e senha --------------------------------------
  if (method === 'GET' && pathname === '/api/sessions') {
    const currentToken = cookieValue(req, SESSION_COOKIE);
    const rows = db
      .prepare('SELECT token, created_at, user_agent FROM sessions WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC')
      .all(me.id, now() - SESSION_TTL);
    return json(res, 200, {
      sessions: rows.map((row) => ({
        id: sessionId(row.token),
        device: describeUserAgent(row.user_agent),
        createdAt: row.created_at,
        current: row.token === currentToken,
      })),
    });
  }

  const sessionMatch = matchRoute(pathname, '/api/sessions/:id');
  if (method === 'DELETE' && sessionMatch) {
    const currentToken = cookieValue(req, SESSION_COOKIE);
    const rows = db.prepare('SELECT token FROM sessions WHERE user_id = ?').all(me.id);
    const target = rows.find((row) => sessionId(row.token) === sessionMatch.id);
    if (!target) throw new HttpError(404, 'Sessão não encontrada.');
    if (target.token === currentToken) {
      throw new HttpError(400, 'Use "Sair" para encerrar a sessão atual.');
    }
    db.prepare('DELETE FROM sessions WHERE token = ?').run(target.token);
    return json(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/me/password') {
    rateLimit(req, 'password-change', 8, 60 * 60 * 1000);
    const body = await readBody(req);
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (!checkPassword(currentPassword, me.password_hash)) {
      throw new HttpError(401, 'Senha atual incorreta.');
    }
    const password = cleanText(newPassword, 'Nova senha', { min: 6, max: 100, required: true });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), me.id);
    /* Mantém apenas a sessão atual ativa após a troca. */
    const currentToken = cookieValue(req, SESSION_COOKIE);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(me.id, currentToken);
    return json(res, 200, { ok: true });
  }

  // --- feed / explore -------------------------------------------------
  if (method === 'GET' && pathname === '/api/feed') {
    const limit = Math.min(40, Math.max(1, Number(url.searchParams.get('limit')) || 18));
    const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
    const mediaType = url.searchParams.get('mediaType') || '';
    const clauses = [
      `(p.user_id = ? OR p.user_id IN (
         SELECT following_id FROM follows WHERE follower_id = ?
       ))`,
      'p.created_at < ?',
      `NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = ? AND b.blocked_id = p.user_id)
            OR (b.blocker_id = p.user_id AND b.blocked_id = ?)
       )`,
    ];
    const params = [me.id, me.id, me.id, before, me.id, me.id];
    const requestedMediaTypes = [
      ...new Set(
        mediaType
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value === 'video' || value === 'image'),
      ),
    ];
    if (requestedMediaTypes.length === 1) {
      clauses.push('p.media_type = ?');
      params.push(requestedMediaTypes[0]);
    } else if (requestedMediaTypes.length > 1) {
      clauses.push(`p.media_type IN (${requestedMediaTypes.map(() => '?').join(',')})`);
      params.push(...requestedMediaTypes);
    }
    params.push(limit);
    const rows = db
      .prepare(
        `${POST_SELECT}
         WHERE ${clauses.join(' AND ')}
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT ?`
      )
      .all(...params);
    const posts = withPreviews(rows.map(mapPost));
    withViewerState(posts, me.id);
    return json(res, 200, {
      posts,
      nextCursor: posts.length === limit ? posts[posts.length - 1].createdAt : null,
    });
  }

  if (method === 'GET' && pathname === '/api/explore') {
    const limit = Math.min(60, Math.max(1, Number(url.searchParams.get('limit')) || 24));
    const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
    const topic = url.searchParams.get('topic') || '';
    const q = (url.searchParams.get('q') || '').trim();
    const mediaType = url.searchParams.get('mediaType') || '';
    const clauses = [
      'p.created_at < ?',
      `NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = ? AND b.blocked_id = p.user_id)
            OR (b.blocker_id = p.user_id AND b.blocked_id = ?)
       )`,
      `(u.is_private = 0 OR p.user_id = ? OR EXISTS (
         SELECT 1 FROM follows f
         WHERE f.follower_id = ? AND f.following_id = p.user_id
       ))`,
    ];
    const params = [me.id, before, me.id, me.id, me.id, me.id];
    if (POST_TOPICS.includes(topic)) {
      clauses.push('p.topic = ?');
      params.push(topic);
    }
    if (q) {
      clauses.push('(p.caption LIKE ? OR u.username LIKE ? OR u.name LIKE ?)');
      const like = `%${q.replace(/[%_]/g, '')}%`;
      params.push(like, like, like);
    }
    const requestedMediaTypes = [
      ...new Set(
        mediaType
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value === 'video' || value === 'image'),
      ),
    ];
    if (requestedMediaTypes.length === 1) {
      clauses.push('p.media_type = ?');
      params.push(requestedMediaTypes[0]);
    } else if (requestedMediaTypes.length > 1) {
      clauses.push(`p.media_type IN (${requestedMediaTypes.map(() => '?').join(',')})`);
      params.push(...requestedMediaTypes);
    }
    params.push(limit);
    const rows = db
      .prepare(`${POST_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`)
      .all(...params);
    const posts = withPreviews(rows.map(mapPost));
    withViewerState(posts, me.id);

    const peopleRows = db
      .prepare(
        `SELECT u.*,
                (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) AS follower_count
         FROM users u
         WHERE u.id != ?
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
                OR (b.blocker_id = u.id AND b.blocked_id = ?)
           )
         ORDER BY follower_count DESC, u.id ASC
         LIMIT 12`
      )
      .all(me.id, me.id, me.id);
    const myInterests = parseJsonArray(me.interests, INTEREST_IDS);
    const people = peopleRows
      .map((row) => {
        const shared = parseJsonArray(row.interests, INTEREST_IDS).filter((id) => myInterests.includes(id));
        return {
          ...userDTO(row),
          isFollowing: isFollowing(me.id, row.id),
          followRequested: hasFollowRequest(me.id, row.id),
          isMe: false,
          followers: row.follower_count,
          sharedInterests: shared,
        };
      })
      .sort((a, b) => b.followers - a.followers || a.id - b.id)
      .slice(0, 6);

    /* Tópicos em alta são agregados apenas sobre o mesmo conteúdo público
       que o Explore permite visualizar. Não há números sintéticos: cada
       contagem corresponde a publicações reais e visíveis para a sessão. */
    const topicRows = db
      .prepare(
        `SELECT p.topic, COUNT(*) AS count
         FROM posts p
         JOIN users u ON u.id = p.user_id
         WHERE p.topic IN (${POST_TOPICS.map(() => '?').join(',')})
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.blocker_id = ? AND b.blocked_id = p.user_id)
                OR (b.blocker_id = p.user_id AND b.blocked_id = ?)
           )
           AND (u.is_private = 0 OR p.user_id = ? OR EXISTS (
             SELECT 1 FROM follows f
             WHERE f.follower_id = ? AND f.following_id = p.user_id
           ))
         GROUP BY p.topic
         ORDER BY count DESC, p.topic ASC
         LIMIT 8`
      )
      .all(...POST_TOPICS, me.id, me.id, me.id, me.id);
    const topics = topicRows.map((row) => ({
      id: row.topic,
      label: POST_TOPIC_LABELS[row.topic] || row.topic,
      count: row.count,
    }));

    return json(res, 200, {
      posts,
      people,
      topics,
      nextCursor: posts.length === limit ? posts[posts.length - 1].createdAt : null,
    });
  }

  if (method === 'GET' && pathname === '/api/search') {
    const q = (url.searchParams.get('q') || '').trim();
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const rows = q
      ? db
          .prepare(
            `SELECT * FROM users
             WHERE (username LIKE ? OR name LIKE ?)
               AND NOT EXISTS (
                 SELECT 1 FROM blocks b
                 WHERE (b.blocker_id = ? AND b.blocked_id = users.id)
                    OR (b.blocker_id = users.id AND b.blocked_id = ?)
               )
             ORDER BY username = ? DESC, username ASC
             LIMIT 20`
          )
          .all(like, like, me.id, me.id, q.toLowerCase())
      : db
          .prepare(
            `SELECT * FROM users
             WHERE NOT EXISTS (
               SELECT 1 FROM blocks b
               WHERE (b.blocker_id = ? AND b.blocked_id = users.id)
                  OR (b.blocker_id = users.id AND b.blocked_id = ?)
             )
             ORDER BY username ASC LIMIT 8`
          )
          .all(me.id, me.id);
    const users = rows.map((row) => ({
      ...userDTO(row),
      isFollowing: isFollowing(me.id, row.id),
      followRequested: hasFollowRequest(me.id, row.id),
      isCloseFriend: isCloseFriend(me.id, row.id),
      isMe: row.id === me.id,
      canMessage: canMessageTarget(me, row),
    }));
    return json(res, 200, { users });
  }

  if (method === 'GET' && pathname === '/api/suggestions') {
    const rows = db
      .prepare(
        `SELECT u.*,
                (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) AS follower_count
         FROM users u
         WHERE u.id != ?
           AND NOT EXISTS (
             SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = u.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
                OR (b.blocker_id = u.id AND b.blocked_id = ?)
           )
         ORDER BY follower_count DESC, u.created_at ASC
         LIMIT 20`
      )
      .all(me.id, me.id, me.id, me.id);
    const myInterests = parseJsonArray(me.interests, INTEREST_IDS);
    const users = rows
      .map((row) => {
        const shared = parseJsonArray(row.interests, INTEREST_IDS).filter((id) => myInterests.includes(id));
        return {
          ...userDTO(row),
          isFollowing: false,
          followRequested: hasFollowRequest(me.id, row.id),
          followers: row.follower_count,
          sharedInterests: shared,
        };
      })
      .sort((a, b) => b.sharedInterests.length - a.sharedInterests.length)
      .slice(0, 5);
    return json(res, 200, { users });
  }

  // --- communities ----------------------------------------------------
  if (method === 'GET' && pathname === '/api/communities') {
    const rows = db
      .prepare(
        `SELECT c.id, c.name, c.slug, c.description, c.avatar, c.created_at,
                (SELECT COUNT(*) FROM community_members cm2 WHERE cm2.community_id = c.id) AS member_count,
                EXISTS (
                  SELECT 1 FROM community_members cm3
                  WHERE cm3.community_id = c.id AND cm3.user_id = ?
                ) AS is_member
         FROM communities c
         ORDER BY member_count DESC, c.name ASC
         LIMIT 100`
      )
      .all(me.id);
    return json(res, 200, { communities: rows.map(communityDTO) });
  }

  const userCommunitiesMatch = matchRoute(pathname, '/api/users/:username/communities');
  if (method === 'GET' && userCommunitiesMatch) {
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(userCommunitiesMatch.username);
    if (!target) throw new HttpError(404, 'Perfil não encontrado.');
    if (target.id !== me.id && isBlocked(me.id, target.id)) {
      throw new HttpError(404, 'Perfil indisponível.');
    }
    const rows = db
      .prepare(
        `SELECT c.id, c.name, c.slug, c.description, c.avatar, c.created_at, cm.role,
                (SELECT COUNT(*) FROM community_members cm2 WHERE cm2.community_id = c.id) AS member_count,
                EXISTS (
                  SELECT 1 FROM community_members cm3
                  WHERE cm3.community_id = c.id AND cm3.user_id = ?
                ) AS is_member
         FROM communities c
         JOIN community_members cm ON cm.community_id = c.id
         WHERE cm.user_id = ?
         ORDER BY cm.created_at DESC, c.id DESC`
      )
      .all(me.id, target.id);
    return json(res, 200, { communities: rows.map(communityDTO) });
  }

  // --- community posts --------------------------------------------------
  const communitySlugMatch = matchRoute(pathname, '/api/communities/:slug');
  if (communitySlugMatch) {
    const slug = communitySlugMatch.slug;
    const community = db.prepare('SELECT * FROM communities WHERE slug = ?').get(slug);
    if (!community) throw new HttpError(404, 'Comunidade não encontrada.');

    // Verify membership for write operations
    const isMember = db.prepare(
      'SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?'
    ).get(community.id, me.id);

    // GET /api/communities/:slug/posts - list posts
    if (method === 'GET' && pathname.endsWith('/posts')) {
      const cursor = parseLimit(url.searchParams.get('cursor'));
      const limit = parseLimit(url.searchParams.get('limit'), 20, 50);
      let where = 'WHERE cp.community_id = ? AND cp.deleted_at IS NULL';
      const params = [community.id];
      if (cursor) {
        where += ' AND cp.created_at < ?';
        params.push(cursor);
      }
      const rows = db
        .prepare(
          `SELECT cp.*, u.username, u.name, u.avatar,
                  CASE WHEN EXISTS (SELECT 1 FROM identity_verifications iv WHERE iv.user_id = u.id AND iv.status = 'approved') THEN 1 ELSE 0 END AS verified,
                  (SELECT COUNT(*) FROM community_post_likes cpl WHERE cpl.post_id = cp.id) AS likes_count,
                  (SELECT COUNT(*) FROM community_post_reposts cpr WHERE cpr.post_id = cp.id) AS reposts_count,
                  (SELECT COUNT(*) FROM community_posts cpr WHERE cpr.reply_to_id = cp.id) AS replies_count,
                  EXISTS (SELECT 1 FROM community_post_likes cpl WHERE cpl.post_id = cp.id AND cpl.user_id = ?) AS liked,
                  EXISTS (SELECT 1 FROM community_post_reposts cpr WHERE cpr.post_id = cp.id AND cpr.user_id = ?) AS reposted
           FROM community_posts cp
           JOIN users u ON u.id = cp.user_id
           ${where}
           ORDER BY cp.created_at DESC, cp.id DESC
           LIMIT ?`
        )
        .all(...params, me.id, me.id, limit + 1);
      const hasMore = rows.length > limit;
      const posts = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? posts[posts.length - 1].created_at : null;

      // Fetch media for posts
      const postIds = posts.map((p) => p.id);
      let mediaByPost = {};
      if (postIds.length > 0) {
        const placeholders = postIds.map(() => '?').join(',');
        const mediaRows = db
          .prepare(
            `SELECT * FROM community_post_media WHERE post_id IN (${placeholders}) ORDER BY position`
          )
          .all(...postIds);
        for (const m of mediaRows) {
          mediaByPost[m.post_id] = mediaByPost[m.post_id] || [];
          mediaByPost[m.post_id].push({
            url: m.url,
            mediaType: m.media_type,
            mimeType: m.mime_type,
            sizeBytes: m.size_bytes,
            fileName: m.file_name,
          });
        }
      }

      return json(res, 200, {
        posts: posts.map((row) => ({
          id: row.id,
          communityId: row.community_id,
          userId: row.user_id,
          text: row.text,
          replyToId: row.reply_to_id,
          sharedPostId: row.shared_post_id,
          media: mediaByPost[row.id] || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at,
          user: {
            id: row.user_id,
            username: row.username,
            name: row.name,
            avatar: row.avatar,
            verified: !!row.verified,
          },
          likesCount: Number(row.likes_count || 0),
          repostsCount: Number(row.reposts_count || 0),
          repliesCount: Number(row.replies_count || 0),
          liked: !!row.liked,
          reposted: !!row.reposted,
        })),
        nextCursor,
      });
    }

    // GET /api/communities/:slug/posts/:id - get single post with replies
    const singlePostMatch = matchRoute(pathname, '/api/communities/:slug/posts/:id');
    if (singlePostMatch && method === 'GET') {
      const postId = parsePositiveId(singlePostMatch.id);
      if (!postId) return badRequest('ID inválido.');
      const post = db
        .prepare(
          `SELECT cp.*, u.username, u.name, u.avatar,
                  CASE WHEN EXISTS (SELECT 1 FROM identity_verifications iv WHERE iv.user_id = u.id AND iv.status = 'approved') THEN 1 ELSE 0 END AS verified,
                  (SELECT COUNT(*) FROM community_post_likes cpl WHERE cpl.post_id = cp.id) AS likes_count,
                  (SELECT COUNT(*) FROM community_post_reposts cpr WHERE cpr.post_id = cp.id) AS reposts_count,
                  (SELECT COUNT(*) FROM community_posts cpr WHERE cpr.reply_to_id = cp.id) AS replies_count,
                  EXISTS (SELECT 1 FROM community_post_likes cpl WHERE cpl.post_id = cp.id AND cpl.user_id = ?) AS liked,
                  EXISTS (SELECT 1 FROM community_post_reposts cpr WHERE cpr.post_id = cp.id AND cpr.user_id = ?) AS reposted
           FROM community_posts cp
           JOIN users u ON u.id = cp.user_id
           WHERE cp.id = ? AND cp.deleted_at IS NULL AND cp.community_id = ?`
        )
        .get(me.id, me.id, postId, community.id);
      if (!post) throw new HttpError(404, 'Post não encontrado.');

      // Fetch media
      const mediaRows = db.prepare('SELECT * FROM community_post_media WHERE post_id = ? ORDER BY position').all(postId);
      const media = mediaRows.map((m) => ({
        url: m.url,
        mediaType: m.media_type,
        mimeType: m.mime_type,
        sizeBytes: m.size_bytes,
        fileName: m.file_name,
      }));

      // Fetch replies
      const replies = db
        .prepare(
          `SELECT cp.*, u.username, u.name, u.avatar,
                  CASE WHEN EXISTS (SELECT 1 FROM identity_verifications iv WHERE iv.user_id = u.id AND iv.status = 'approved') THEN 1 ELSE 0 END AS verified,
                  (SELECT COUNT(*) FROM community_post_likes cpl WHERE cpl.post_id = cp.id) AS likes_count,
                  (SELECT COUNT(*) FROM community_post_reposts cpr WHERE cpr.post_id = cp.id) AS reposts_count,
                  (SELECT COUNT(*) FROM community_posts cpr WHERE cpr.reply_to_id = cp.id) AS replies_count,
                  EXISTS (SELECT 1 FROM community_post_likes cpl WHERE cpl.post_id = cp.id AND cpl.user_id = ?) AS liked,
                  EXISTS (SELECT 1 FROM community_post_reposts cpr WHERE cpr.post_id = cp.id AND cpr.user_id = ?) AS reposted
           FROM community_posts cp
           JOIN users u ON u.id = cp.user_id
           WHERE cp.reply_to_id = ? AND cp.deleted_at IS NULL
           ORDER BY cp.created_at ASC`
        )
        .all(me.id, me.id, postId);

      const replyMedia = {};
      for (const r of replies) {
        const mRows = db.prepare('SELECT * FROM community_post_media WHERE post_id = ? ORDER BY position').all(r.id);
        replyMedia[r.id] = mRows.map((m) => ({
          url: m.url,
          mediaType: m.media_type,
          mimeType: m.mime_type,
          sizeBytes: m.size_bytes,
          fileName: m.file_name,
        }));
      }

      return json(res, 200, {
        post: {
          id: post.id,
          communityId: post.community_id,
          userId: post.user_id,
          text: post.text,
          replyToId: post.reply_to_id,
          sharedPostId: post.shared_post_id,
          media,
          createdAt: post.created_at,
          updatedAt: post.updated_at,
          deletedAt: post.deleted_at,
          user: {
            id: post.user_id,
            username: post.username,
            name: post.name,
            avatar: post.avatar,
            verified: !!post.verified,
          },
          likesCount: Number(post.likes_count || 0),
          repostsCount: Number(post.reposts_count || 0),
          repliesCount: Number(post.replies_count || 0),
          liked: !!post.liked,
          reposted: !!post.reposted,
        },
        replies: replies.map((row) => ({
          id: row.id,
          communityId: row.community_id,
          userId: row.user_id,
          text: row.text,
          replyToId: row.reply_to_id,
          sharedPostId: row.shared_post_id,
          media: replyMedia[row.id] || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at,
          user: {
            id: row.user_id,
            username: row.username,
            name: row.name,
            avatar: row.avatar,
            verified: !!row.verified,
          },
          likesCount: Number(row.likes_count || 0),
          repostsCount: Number(row.reposts_count || 0),
          repliesCount: Number(row.replies_count || 0),
          liked: !!row.liked,
          reposted: !!row.reposted,
        })),
      });
    }

    // POST /api/communities/:slug/posts - create post
    if (method === 'POST' && pathname.endsWith('/posts')) {
      if (!isMember) throw new HttpError(403, 'Apenas membros podem postar nesta comunidade.');
      rateLimit(req, 'community-post', 30, 60 * 1000);
      const body = await readBody(req);
      if (!isPlainObject(body)) return badRequest('Corpo inválido.');
      const text = cleanText(body.text || '', 'Texto', { max: 280, multiline: true });
      const replyToId = body.replyToId ? parsePositiveId(body.replyToId) : null;
      const sharedPostId = body.sharedPostId ? parsePositiveId(body.sharedPostId) : null;
      const requestedMedia = body.media === undefined || body.media === null ? [] : body.media;
      if (!Array.isArray(requestedMedia)) return badRequest('Mídia inválida.');
      if (requestedMedia.length > 4) return badRequest('Máximo 4 anexos por post.');
      const mediaItems = requestedMedia.map(validateMessageMediaItem);
      const totalBytes = mediaItems.reduce((t, i) => t + i.sizeBytes, 0);
      if (totalBytes > 25 * 1024 * 1024) return badRequest('Anexos muito grandes (máx 25 MB).');
      if (!text && !replyToId && !sharedPostId && mediaItems.length === 0) {
        return badRequest('Escreva algo ou anexe um arquivo.');
      }

      const timestamp = now();
      const savedMedia = [];
      try {
        for (const item of mediaItems) {
          savedMedia.push({
            ...item,
            ...saveMessageMedia(item, `community-${community.id}`, me.id, { kind: 'community' }),
          });
        }
        const postId = withTransaction(() => {
          const result = db
            .prepare(
              `INSERT INTO community_posts (community_id, user_id, text, reply_to_id, shared_post_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run(community.id, me.id, text, replyToId, sharedPostId, timestamp);
          const id = Number(result.lastInsertRowid);
          for (const [pos, item] of savedMedia.entries()) {
            db.prepare(
              `INSERT INTO community_post_media (post_id, url, media_type, mime_type, size_bytes, file_name, position, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(id, item.url, item.mediaType, item.mimeType, item.sizeBytes, item.fileName, pos, timestamp);
          }
          // Notify parent post author if this is a reply (and not self-reply)
          if (replyToId) {
            const parentPost = db.prepare('SELECT user_id, community_id FROM community_posts WHERE id = ?').get(replyToId);
            if (parentPost && parentPost.user_id !== me.id) {
              db.prepare(
                `INSERT INTO notifications (user_id, actor_id, kind, entity_type, entity_id, created_at)
                 VALUES (?, ?, 'community_post_reply', 'community_post', ?, ?)`
              ).run(parentPost.user_id, me.id, id, timestamp);
            }
            // SSE: notify community members of new reply
            const recipientIds = db
              .prepare('SELECT user_id FROM community_members WHERE community_id = ?')
              .all(community.id)
              .map((row) => row.user_id);
            sseHub.publish(
              recipientIds,
              'community.post.replied',
              { scope: 'community', communityId: community.id, postId: replyToId, replyId: id, userId: me.id },
              (client) => {
                const membership = db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?').get(community.id, client.userId);
                return membership !== undefined;
              },
            );
          }
          for (const item of savedMedia) {
            require('node:fs').renameSync(item.stagedPath, item.finalPath);
          }
          return id;
        });
        const post = db
          .prepare(
            `SELECT cp.*, u.username, u.name, u.avatar
             FROM community_posts cp JOIN users u ON u.id = cp.user_id
             WHERE cp.id = ?`
          )
          .get(postId);
        const postDTO = {
          id: post.id,
          communityId: post.community_id,
          userId: post.user_id,
          text: post.text,
          replyToId: post.reply_to_id,
          sharedPostId: post.shared_post_id,
          media: savedMedia.map((m) => ({
            url: m.url,
            mediaType: m.mediaType,
            mimeType: m.mimeType,
            sizeBytes: m.sizeBytes,
            fileName: m.fileName,
          })),
          createdAt: post.created_at,
          updatedAt: post.updated_at,
          deletedAt: post.deleted_at,
          user: { id: post.user_id, username: post.username, name: post.name, avatar: post.avatar, verified: 0 },
          likesCount: 0,
          repostsCount: 0,
          repliesCount: 0,
          liked: false,
          reposted: false,
        };
        // SSE: notify community members
        const recipientIds = db
          .prepare('SELECT user_id FROM community_members WHERE community_id = ?')
          .all(community.id)
          .map((row) => row.user_id);
        sseHub.publish(
          recipientIds,
          'community.post.created',
          { scope: 'community', communityId: community.id, post: postDTO },
          (client) => {
            const membership = db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?').get(community.id, client.userId);
            return membership !== undefined;
          },
        );
        return json(res, 201, { post: postDTO });
      } catch (err) {
        for (const item of savedMedia) {
          require('node:fs').rmSync(item.stagedPath, { force: true });
          removeUploadIfUnused(item.url);
        }
        throw err;
      }
    }
  }

  // POST /api/community-posts/:id/like
  const cpLikeMatch = matchRoute(pathname, '/api/community-posts/:id/like');
  if (cpLikeMatch && method === 'POST') {
    const postId = parsePositiveId(cpLikeMatch.id);
    if (!postId) return badRequest('ID inválido.');
    const post = db.prepare('SELECT * FROM community_posts WHERE id = ? AND deleted_at IS NULL').get(postId);
    if (!post) throw new HttpError(404, 'Post não encontrado.');
    // Verify membership
    const isMember = db.prepare(
      'SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?'
    ).get(post.community_id, me.id);
    if (!isMember) throw new HttpError(403, 'Acesso negado.');
    const existing = db.prepare('SELECT 1 FROM community_post_likes WHERE post_id = ? AND user_id = ?').get(postId, me.id);
    if (existing) return json(res, 200, { liked: true });
    db.prepare('INSERT INTO community_post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)').run(postId, me.id, now());
    // Notify post author (if not self)
    if (post.user_id !== me.id) {
      db.prepare(
        `INSERT INTO notifications (user_id, actor_id, kind, entity_type, entity_id, created_at)
         VALUES (?, ?, 'community_post_like', 'community_post', ?, ?)`
      ).run(post.user_id, me.id, postId, now());
    }
    // SSE: notify community members
    const recipientIds = db
      .prepare('SELECT user_id FROM community_members WHERE community_id = ?')
      .all(post.community_id)
      .map((row) => row.user_id);
    sseHub.publish(
      recipientIds,
      'community.post.liked',
      { scope: 'community', communityId: post.community_id, postId, userId: me.id, liked: true },
      (client) => {
        const membership = db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?').get(post.community_id, client.userId);
        return membership !== undefined;
      },
    );
    return json(res, 200, { liked: true });
  }

  // DELETE /api/community-posts/:id/like
  if (cpLikeMatch && method === 'DELETE') {
    const postId = parsePositiveId(cpLikeMatch.id);
    if (!postId) return badRequest('ID inválido.');
    const post = db.prepare('SELECT * FROM community_posts WHERE id = ? AND deleted_at IS NULL').get(postId);
    if (!post) throw new HttpError(404, 'Post não encontrado.');
    db.prepare('DELETE FROM community_post_likes WHERE post_id = ? AND user_id = ?').run(postId, me.id);
    // SSE: notify community members
    const recipientIds = db
      .prepare('SELECT user_id FROM community_members WHERE community_id = ?')
      .all(post.community_id)
      .map((row) => row.user_id);
    sseHub.publish(
      recipientIds,
      'community.post.liked',
      { scope: 'community', communityId: post.community_id, postId, userId: me.id, liked: false },
      (client) => {
        const membership = db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?').get(post.community_id, client.userId);
        return membership !== undefined;
      },
    );
    return json(res, 200, { liked: false });
  }

  // POST /api/community-posts/:id/repost
  const cpRepostMatch = matchRoute(pathname, '/api/community-posts/:id/repost');
  if (cpRepostMatch && method === 'POST') {
    const postId = parsePositiveId(cpRepostMatch.id);
    if (!postId) return badRequest('ID inválido.');
    const post = db.prepare('SELECT * FROM community_posts WHERE id = ? AND deleted_at IS NULL').get(postId);
    if (!post) throw new HttpError(404, 'Post não encontrado.');
    const isMember = db.prepare(
      'SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?'
    ).get(post.community_id, me.id);
    if (!isMember) throw new HttpError(403, 'Acesso negado.');
    const existing = db.prepare('SELECT 1 FROM community_post_reposts WHERE post_id = ? AND user_id = ?').get(postId, me.id);
    if (existing) return json(res, 200, { reposted: true });
    db.prepare('INSERT INTO community_post_reposts (post_id, user_id, created_at) VALUES (?, ?, ?)').run(postId, me.id, now());
    // Notify post author (if not self)
    if (post.user_id !== me.id) {
      db.prepare(
        `INSERT INTO notifications (user_id, actor_id, kind, entity_type, entity_id, created_at)
         VALUES (?, ?, 'community_post_repost', 'community_post', ?, ?)`
      ).run(post.user_id, me.id, postId, now());
    }
    // SSE: notify community members
    const recipientIds = db
      .prepare('SELECT user_id FROM community_members WHERE community_id = ?')
      .all(post.community_id)
      .map((row) => row.user_id);
    sseHub.publish(
      recipientIds,
      'community.post.reposted',
      { scope: 'community', communityId: post.community_id, postId, userId: me.id, reposted: true },
      (client) => {
        const membership = db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?').get(post.community_id, client.userId);
        return membership !== undefined;
      },
    );
    return json(res, 200, { reposted: true });
  }

  // DELETE /api/community-posts/:id/repost
  if (cpRepostMatch && method === 'DELETE') {
    const postId = parsePositiveId(cpRepostMatch.id);
    if (!postId) return badRequest('ID inválido.');
    const post = db.prepare('SELECT * FROM community_posts WHERE id = ? AND deleted_at IS NULL').get(postId);
    if (!post) throw new HttpError(404, 'Post não encontrado.');
    db.prepare('DELETE FROM community_post_reposts WHERE post_id = ? AND user_id = ?').run(postId, me.id);
    // SSE: notify community members
    const recipientIds = db
      .prepare('SELECT user_id FROM community_members WHERE community_id = ?')
      .all(post.community_id)
      .map((row) => row.user_id);
    sseHub.publish(
      recipientIds,
      'community.post.reposted',
      { scope: 'community', communityId: post.community_id, postId, userId: me.id, reposted: false },
      (client) => {
        const membership = db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?').get(post.community_id, client.userId);
        return membership !== undefined;
      },
    );
    return json(res, 200, { reposted: false });
  }

  // DELETE /api/community-posts/:id - delete post
  const cpDeleteMatch = matchRoute(pathname, '/api/community-posts/:id');
  if (cpDeleteMatch && method === 'DELETE') {
    const postId = parsePositiveId(cpDeleteMatch.id);
    if (!postId) return badRequest('ID inválido.');
    const post = db.prepare('SELECT * FROM community_posts WHERE id = ? AND deleted_at IS NULL').get(postId);
    if (!post) throw new HttpError(404, 'Post não encontrado.');
    if (post.user_id !== me.id) throw new HttpError(403, 'Apenas o autor pode excluir o post.');
    const isMember = db.prepare(
      'SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?'
    ).get(post.community_id, me.id);
    if (!isMember) throw new HttpError(403, 'Acesso negado.');
    const timestamp = now();
    db.prepare('UPDATE community_posts SET deleted_at = ? WHERE id = ?').run(timestamp, postId);
    // SSE: notify community members
    const recipientIds = db
      .prepare('SELECT user_id FROM community_members WHERE community_id = ?')
      .all(post.community_id)
      .map((row) => row.user_id);
    sseHub.publish(
      recipientIds,
      'community.post.deleted',
      { scope: 'community', communityId: post.community_id, postId },
      (client) => {
        const membership = db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?').get(post.community_id, client.userId);
        return membership !== undefined;
      },
    );
    return json(res, 200, { ok: true });
  }

  // POST /api/communities/:slug/join - join community
  const joinMatch = matchRoute(pathname, '/api/communities/:slug/join');
  if (joinMatch && method === 'POST') {
    const slug = joinMatch.slug;
    const community = db.prepare('SELECT * FROM communities WHERE slug = ?').get(slug);
    if (!community) throw new HttpError(404, 'Comunidade não encontrada.');
    const existing = db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?').get(community.id, me.id);
    if (existing) return json(res, 200, { joined: true, member: true });
    db.prepare('INSERT INTO community_members (community_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
      .run(community.id, me.id, 'member', now());
    return json(res, 200, { joined: true, member: true });
  }

  // DELETE /api/communities/:slug/join - leave community
  if (joinMatch && method === 'DELETE') {
    const slug = joinMatch.slug;
    const community = db.prepare('SELECT * FROM communities WHERE slug = ?').get(slug);
    if (!community) throw new HttpError(404, 'Comunidade não encontrada.');
    // Prevent owner from leaving
    const isOwner = db.prepare('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? AND role = ?').get(community.id, me.id, 'owner');
    if (isOwner) throw new HttpError(400, 'O proprietário não pode sair da comunidade. Transfira a propriedade primeiro.');
    db.prepare('DELETE FROM community_members WHERE community_id = ? AND user_id = ?').run(community.id, me.id);
    return json(res, 200, { joined: false, member: false });
  }

  // --- shorts (videos curtos estilo Reels/TikTok) -----------------------
  // GET /api/shorts - list shorts (feed)
  if (method === 'GET' && pathname === '/api/shorts') {
    const cursor = parseLimit(url.searchParams.get('cursor'));
    const limit = parseLimit(url.searchParams.get('limit'), 20, 50);
    let where = 'WHERE s.status = ?';
    const params = ['ready'];
    if (cursor) {
      where += ' AND s.created_at < ?';
      params.push(cursor);
    }
    params.push(limit);
    const rows = db
      .prepare(
        `SELECT s.*, u.username, u.name, u.avatar,
                CASE WHEN EXISTS (SELECT 1 FROM identity_verifications iv WHERE iv.user_id = u.id AND iv.status = 'approved') THEN 1 ELSE 0 END AS verified,
                (SELECT COUNT(*) FROM shorts_likes sl WHERE sl.short_id = s.id) AS likes_count,
                (SELECT COUNT(*) FROM shorts_views sv WHERE sv.short_id = s.id) AS views_count,
                EXISTS (SELECT 1 FROM shorts_likes sl WHERE sl.short_id = s.id AND sl.user_id = ?) AS liked
         FROM shorts s
         JOIN users u ON u.id = s.user_id
         ${where}
         ORDER BY s.created_at DESC, s.id DESC
         LIMIT ?`
      )
      .all(me.id, ...params);
    return json(res, 200, { shorts: rows.map(shortDTO) });
  }

  // GET /api/shorts/:id - get single short
  const shortIdMatch = matchRoute(pathname, '/api/shorts/:id');
  if (method === 'GET' && shortIdMatch) {
    const id = parsePositiveId(shortIdMatch.id);
    if (!id) return badRequest('ID inválido.');
    const row = db
      .prepare(
        `SELECT s.*, u.username, u.name, u.avatar,
                CASE WHEN EXISTS (SELECT 1 FROM identity_verifications iv WHERE iv.user_id = u.id AND iv.status = 'approved') THEN 1 ELSE 0 END AS verified,
                (SELECT COUNT(*) FROM shorts_likes sl WHERE sl.short_id = s.id) AS likes_count,
                (SELECT COUNT(*) FROM shorts_views sv WHERE sv.short_id = s.id) AS views_count,
                EXISTS (SELECT 1 FROM shorts_likes sl WHERE sl.short_id = s.id AND sl.user_id = ?) AS liked
         FROM shorts s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.status = 'ready'`
      )
      .get(me.id, id);
    if (!row) throw new HttpError(404, 'Short não encontrado.');
    // Record view
    db.prepare('INSERT OR IGNORE INTO shorts_views (user_id, short_id, watched_at, watch_time) VALUES (?, ?, ?, ?)')
      .run(me.id, id, now(), 0);
    return json(res, 200, { short: shortDTO(row) });
  }

  // POST /api/shorts/presign - get presigned URL for direct upload
  if (method === 'POST' && pathname === '/api/shorts/presign') {
    rateLimit(req, 'shorts-presign', 30, 60 * 1000);
    const body = await readBody(req);
    const filename = cleanText(body.filename, 'Arquivo', { min: 1, max: 255, required: true });
    const contentType = cleanText(body.contentType, 'Tipo', { min: 1, max: 100, required: true });
    if (!contentType.startsWith('video/')) {
      return badRequest('Apenas arquivos de vídeo são permitidos.');
    }
    const videoId = crypto.randomUUID();
    const ext = path.extname(filename) || '.mp4';
    const objectKey = `shorts/${me.id}/${videoId}/source${ext}`;
    const uploadUrl = await presignPut(objectKey, 3600);
    // Create pending short record
    db.prepare(
      `INSERT INTO shorts (user_id, title, description, hls_manifest_url, thumbnail_url, duration, width, height, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?)`
    ).run(me.id, body.title || '', body.description || '', '', '', 0, 0, 0, now(), now());
    const shortId = db.prepare('SELECT last_insert_rowid() as id').get().id;
    // Enqueue transcode job
    await enqueueTranscode(shortId.toString(), objectKey, { isMinioSource: true });
    return json(res, 200, { uploadUrl, videoId: shortId, objectKey });
  }

  // GET /api/shorts/:id/manifest - get HLS manifest URL
  if (method === 'GET' && shortIdMatch && pathname.endsWith('/manifest')) {
    const id = parsePositiveId(shortIdMatch.id);
    if (!id) return badRequest('ID inválido.');
    const short = db.prepare('SELECT * FROM shorts WHERE id = ? AND status = ?').get(id, 'ready');
    if (!short) throw new HttpError(404, 'Short não encontrado ou ainda processando.');
    return json(res, 200, { manifestUrl: short.hls_manifest_url });
  }

  // POST /api/shorts/:id/like
  if (method === 'POST' && shortIdMatch && pathname.endsWith('/like')) {
    const id = parsePositiveId(shortIdMatch.id);
    if (!id) return badRequest('ID inválido.');
    const short = db.prepare('SELECT * FROM shorts WHERE id = ? AND status = ?').get(id, 'ready');
    if (!short) throw new HttpError(404, 'Short não encontrado.');
    const existing = db.prepare('SELECT 1 FROM shorts_likes WHERE short_id = ? AND user_id = ?').get(id, me.id);
    if (existing) return json(res, 200, { liked: true });
    db.prepare('INSERT INTO shorts_likes (short_id, user_id, created_at) VALUES (?, ?, ?)').run(id, me.id, now());
    return json(res, 200, { liked: true });
  }

  // DELETE /api/shorts/:id/like
  if (method === 'DELETE' && shortIdMatch && pathname.endsWith('/like')) {
    const id = parsePositiveId(shortIdMatch.id);
    if (!id) return badRequest('ID inválido.');
    db.prepare('DELETE FROM shorts_likes WHERE short_id = ? AND user_id = ?').run(id, me.id);
    return json(res, 200, { liked: false });
  }

  // POST /api/shorts/:id/view - record view progress
  if (method === 'POST' && shortIdMatch && pathname.endsWith('/view')) {
    const id = parsePositiveId(shortIdMatch.id);
    if (!id) return badRequest('ID inválido.');
    const short = db.prepare('SELECT * FROM shorts WHERE id = ? AND status = ?').get(id, 'ready');
    if (!short) throw new HttpError(404, 'Short não encontrado.');
    const body = await readBody(req);
    const watchTime = Math.max(0, Number(body.watchTime) || 0);
    db.prepare('INSERT OR REPLACE INTO shorts_views (user_id, short_id, watched_at, watch_time) VALUES (?, ?, ?, ?)')
      .run(me.id, id, now(), watchTime);
    return json(res, 200, { ok: true });
  }

  // DELETE /api/shorts/:id - delete own short
  if (method === 'DELETE' && shortIdMatch) {
    const id = parsePositiveId(shortIdMatch.id);
    if (!id) return badRequest('ID inválido.');
    const short = db.prepare('SELECT * FROM shorts WHERE id = ?').get(id);
    if (!short) throw new HttpError(404, 'Short não encontrado.');
    if (short.user_id !== me.id) throw new HttpError(403, 'Apenas o autor pode excluir.');
    await deleteHLS(id.toString());
    db.prepare('DELETE FROM shorts WHERE id = ?').run(id);
    return json(res, 200, { ok: true });
  }

  // --- users ----------------------------------------------------------
  const userMatch = matchRoute(pathname, '/api/users/:username');
  if (method === 'GET' && userMatch) {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(userMatch.username);
    if (!user) throw new HttpError(404, 'Perfil não encontrado.');
    if (user.id !== me.id && isBlocked(me.id, user.id)) {
      throw new HttpError(404, 'Perfil indisponível.');
    }
    const isMe = user.id === me.id;
    const isFollowingUser = isFollowing(me.id, user.id);
    const followRequested = hasFollowRequest(me.id, user.id);
    const canViewContent = canViewUserContent(me.id, user);
    const posts = canViewContent
      ? db
          .prepare(`${POST_SELECT} WHERE p.user_id = ? ORDER BY p.created_at DESC, p.id DESC`)
          .all(me.id, user.id)
          .map(mapPost)
      : [];
    const myInterests = parseJsonArray(me.interests, INTEREST_IDS);
    return json(res, 200, {
      user: {
        ...userDTO(user),
        messagePolicy: user.message_policy || 'connections',
        createdAt: user.created_at,
      },
      stats: statsFor(user.id),
      badges: badgesFor(user, statsFor(user.id)),
      isMe,
      isFollowing: isFollowingUser,
      followRequested,
      isCloseFriend: isCloseFriend(user.id, me.id),
      canViewContent,
      pendingFollowRequests: isMe ? followRequestCount(me.id) : 0,
      canMessage: canMessageTarget(me, user),
      sharedInterests: parseJsonArray(user.interests, INTEREST_IDS).filter((id) => myInterests.includes(id)),
      posts: withViewerState(withPreviews(posts), me.id),
    });
  }

  const followMatch = matchRoute(pathname, '/api/users/:username/follow');
  if (method === 'POST' && followMatch) {
    rateLimit(req, 'follow', 120, 60 * 1000);
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(followMatch.username);
    if (!target) throw new HttpError(404, 'Perfil não encontrado.');
    if (target.id === me.id) throw new HttpError(400, 'Você não pode seguir a si mesmo.');
    if (isBlocked(me.id, target.id)) throw new HttpError(403, 'Não é possível seguir este perfil.');
    const isPrivate = !!target.is_private;
    const following = isFollowing(me.id, target.id);
    if (following) {
      db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(me.id, target.id);
      return json(res, 200, {
        isFollowing: false,
        requested: false,
        cancelled: false,
        isPrivate,
        stats: statsFor(target.id),
      });
    }
    const pending = hasFollowRequest(me.id, target.id);
    if (pending) {
      db.prepare('DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?').run(me.id, target.id);
      return json(res, 200, {
        isFollowing: false,
        requested: false,
        cancelled: true,
        isPrivate,
        stats: statsFor(target.id),
      });
    }
    if (isPrivate) {
      db.prepare(
        'INSERT OR IGNORE INTO follow_requests (requester_id, target_id, created_at) VALUES (?, ?, ?)'
      ).run(me.id, target.id, now());
      notify(
        target.id,
        'follow_request',
        `${me.name} quer seguir você.`,
        '/?follow-requests=1'
      );
      return json(res, 200, {
        isFollowing: false,
        requested: true,
        cancelled: false,
        isPrivate,
        stats: statsFor(target.id),
      });
    }
    db.prepare('INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)').run(me.id, target.id, now());
    notify(target.id, 'follow', `${me.name} começou a seguir você.`, `/perfil/${encodeURIComponent(me.username)}`);
    return json(res, 200, {
      isFollowing: true,
      requested: false,
      cancelled: false,
      isPrivate,
      stats: statsFor(target.id),
    });
  }

  if (method === 'GET' && pathname === '/api/follow-requests') {
    const rows = db
      .prepare(
        `SELECT fr.id AS request_id, fr.created_at AS request_created_at,
                u.id AS user_id, u.username, u.name, u.bio, u.avatar, u.interests, u.is_private
         FROM follow_requests fr
         JOIN users u ON u.id = fr.requester_id
         WHERE fr.target_id = ?
         ORDER BY fr.created_at DESC`
      )
      .all(me.id);
    return json(res, 200, {
      requests: rows.map((row) => ({
        id: row.request_id,
        createdAt: row.request_created_at,
        user: userDTO({
          id: row.user_id,
          username: row.username,
          name: row.name,
          bio: row.bio,
          avatar: row.avatar,
          interests: row.interests,
          is_private: row.is_private,
        }),
      })),
      pendingFollowRequests: rows.length,
    });
  }

  const followRequestActionMatch = matchRoute(pathname, '/api/follow-requests/:id/:action');
  if (
    method === 'POST' &&
    followRequestActionMatch &&
    ['accept', 'reject'].includes(followRequestActionMatch.action)
  ) {
    rateLimit(req, 'follow-requests', 120, 60 * 1000);
    const requestId = Number(followRequestActionMatch.id);
    const request = db.prepare('SELECT * FROM follow_requests WHERE id = ?').get(requestId);
    if (!request) throw new HttpError(404, 'Solicitação não encontrada.');
    if (request.target_id !== me.id) {
      throw new HttpError(403, 'Sem permissão para responder esta solicitação.');
    }
    const accepted = followRequestActionMatch.action === 'accept';
    if (accepted) {
      acceptFollowRequestRow(request);
    } else {
      db.prepare('DELETE FROM follow_requests WHERE id = ?').run(requestId);
    }
    return json(res, 200, {
      ok: true,
      accepted,
      pendingFollowRequests: followRequestCount(me.id),
      stats: statsFor(me.id),
    });
  }

  if (method === 'GET' && pathname === '/api/close-friends') {
    const rows = db
      .prepare(
        `SELECT u.id, u.username, u.name, u.bio, u.avatar, u.interests, u.is_private, cf.created_at
         FROM close_friends cf JOIN users u ON u.id = cf.friend_id
         WHERE cf.owner_id = ?
         ORDER BY cf.created_at DESC`
      )
      .all(me.id);
    return json(res, 200, {
      friends: rows.map((row) => userDTO(row)),
      closeFriends: rows.map((row) => userDTO(row)),
    });
  }

  const closeFriendMatch = matchRoute(pathname, '/api/close-friends/:username');
  if (closeFriendMatch && (method === 'POST' || method === 'DELETE')) {
    rateLimit(req, 'close-friends', 60, 60 * 1000);
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(closeFriendMatch.username);
    if (!target) throw new HttpError(404, 'Perfil não encontrado.');
    if (target.id === me.id) throw new HttpError(400, 'Você não pode adicionar a si mesmo.');
    if (isBlocked(me.id, target.id)) throw new HttpError(403, 'Não é possível adicionar este perfil.');
    if (method === 'POST') {
      db.prepare('INSERT OR IGNORE INTO close_friends (owner_id, friend_id, created_at) VALUES (?, ?, ?)').run(
        me.id,
        target.id,
        now()
      );
      return json(res, 200, { ok: true, added: true, isCloseFriend: true });
    }
    db.prepare('DELETE FROM close_friends WHERE owner_id = ? AND friend_id = ?').run(me.id, target.id);
    return json(res, 200, { ok: true, added: false, isCloseFriend: false });
  }

  const followersMatch = matchRoute(pathname, '/api/users/:username/followers');
  if (method === 'GET' && followersMatch) {
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(followersMatch.username);
    if (!target) throw new HttpError(404, 'Perfil não encontrado.');
    if (target.id !== me.id && isBlocked(me.id, target.id)) throw new HttpError(404, 'Perfil indisponível.');
    if (!canViewUserContent(me.id, target)) {
      throw new HttpError(403, 'Este perfil é privado. Envie uma solicitação para seguir e ver o conteúdo.');
    }
    const rows = db
      .prepare(
        `SELECT u.* FROM follows f
         JOIN users u ON u.id = f.follower_id
         WHERE f.following_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
                OR (b.blocker_id = u.id AND b.blocked_id = ?)
           )
         ORDER BY f.created_at DESC
         LIMIT 100`
      )
      .all(target.id, me.id, me.id);
    return json(res, 200, {
      users: rows.map((row) => ({
        ...userDTO(row),
        isFollowing: isFollowing(me.id, row.id),
        followRequested: hasFollowRequest(me.id, row.id),
        isCloseFriend: isCloseFriend(me.id, row.id),
        isMe: row.id === me.id,
      })),
    });
  }

  const removeFollowerMatch = matchRoute(pathname, '/api/users/:username/followers/:follower');
  if (method === 'DELETE' && removeFollowerMatch) {
    rateLimit(req, 'follow', 120, 60 * 1000);
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(removeFollowerMatch.username);
    if (!target) throw new HttpError(404, 'Perfil não encontrado.');
    /* Remover seguidor é uma ação do dono do perfil: nobody else can edit it. */
    if (target.id !== me.id) throw new HttpError(403, 'Só é possível remover seguidores do próprio perfil.');
    const follower = db.prepare('SELECT * FROM users WHERE username = ?').get(removeFollowerMatch.follower);
    if (!follower) throw new HttpError(404, 'Usuário não encontrado.');
    const removed = db
      .prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?')
      .run(follower.id, target.id);
    if (removed.changes > 0) {
      db.prepare('DELETE FROM follow_requests WHERE requester_id = ? AND target_id = ?').run(
        follower.id,
        target.id
      );
    }
    return json(res, 200, {
      removed: removed.changes > 0,
      stats: statsFor(target.id),
    });
  }

  const followingMatch = matchRoute(pathname, '/api/users/:username/following');
  if (method === 'GET' && followingMatch) {
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(followingMatch.username);
    if (!target) throw new HttpError(404, 'Perfil não encontrado.');
    if (target.id !== me.id && isBlocked(me.id, target.id)) throw new HttpError(404, 'Perfil indisponível.');
    if (!canViewUserContent(me.id, target)) {
      throw new HttpError(403, 'Este perfil é privado. Envie uma solicitação para seguir e ver o conteúdo.');
    }
    const rows = db
      .prepare(
        `SELECT u.* FROM follows f
         JOIN users u ON u.id = f.following_id
         WHERE f.follower_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
                OR (b.blocker_id = u.id AND b.blocked_id = ?)
           )
         ORDER BY f.created_at DESC
         LIMIT 100`
      )
      .all(target.id, me.id, me.id);
    return json(res, 200, {
      users: rows.map((row) => ({
        ...userDTO(row),
        isFollowing: isFollowing(me.id, row.id),
        followRequested: hasFollowRequest(me.id, row.id),
        isCloseFriend: isCloseFriend(me.id, row.id),
        isMe: row.id === me.id,
      })),
    });
  }

  const removeFollowingMatch = matchRoute(pathname, '/api/users/:username/following/:following');
  if (method === 'DELETE' && removeFollowingMatch) {
    rateLimit(req, 'follow', 120, 60 * 1000);
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(removeFollowingMatch.username);
    if (!target) throw new HttpError(404, 'Perfil não encontrado.');
    /* Unfollow só vale para a própria conta: é quem está na lista "Seguindo". */
    if (target.id !== me.id) throw new HttpError(403, 'Só é possível remover pessoas da sua lista de seguindo.');
    const followed = db.prepare('SELECT * FROM users WHERE username = ?').get(removeFollowingMatch.following);
    if (!followed) throw new HttpError(404, 'Usuário não encontrado.');
    const removed = db
      .prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?')
      .run(target.id, followed.id);
    return json(res, 200, {
      removed: removed.changes > 0,
      stats: statsFor(target.id),
    });
  }

  const likesMatch = matchRoute(pathname, '/api/users/:username/likes');
  if (method === 'GET' && likesMatch) {
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(likesMatch.username);
    if (!target) throw new HttpError(404, 'Perfil não encontrado.');
    /* A lista de curtidas é um dado privado: assim como a aba "Curtidas" só
       aparece no próprio perfil, a rota só responde ao dono da conta. */
    if (target.id !== me.id) {
      throw new HttpError(403, 'As curtidas são privadas.');
    }
    /* Cada publicação curtida também passa pelo filtro de bloqueios e pela
       privacidade do autor, exatamente como no feed. */
    const rows = db
      .prepare(
        `${POST_SELECT}
         WHERE p.id IN (SELECT post_id FROM likes WHERE user_id = ?)
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.blocker_id = ? AND b.blocked_id = p.user_id)
                OR (b.blocker_id = p.user_id AND b.blocked_id = ?)
           )
           AND (
             u.is_private = 0
             OR p.user_id = ?
             OR EXISTS (
               SELECT 1 FROM follows f
               WHERE f.follower_id = ? AND f.following_id = p.user_id
             )
           )
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT 100`
      )
      .all(me.id, target.id, me.id, me.id, me.id, me.id);
    return json(res, 200, { posts: withViewerState(withPreviews(rows.map(mapPost)), me.id) });
  }

  if (method === 'GET' && pathname === '/api/blocks') {
    const rows = db
      .prepare(
        `SELECT u.id, u.username, u.name, u.bio, u.avatar, u.interests, b.created_at
         FROM blocks b JOIN users u ON u.id = b.blocked_id
         WHERE b.blocker_id = ?
         ORDER BY b.created_at DESC`
      )
      .all(me.id);
    return json(res, 200, {
      blockedUsers: rows.map((row) => ({
        user: userDTO(row),
        blockedAt: row.created_at,
      })),
    });
  }

  const blockMatch = matchRoute(pathname, '/api/users/:username/block');
  if (blockMatch && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
    rateLimit(req, 'blocks', 60, 60 * 1000);
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(blockMatch.username);
    if (!target) throw new HttpError(404, 'Perfil não encontrado.');
    if (target.id === me.id) throw new HttpError(400, 'Você não pode bloquear a si mesmo.');
    const currentlyBlocked = isBlocked(me.id, target.id);
    let shouldBlock;
    if (method === 'DELETE') {
      shouldBlock = false;
    } else if (method === 'PUT') {
      const body = await readBody(req);
      if (typeof body.blocked !== 'boolean') {
        throw new HttpError(400, 'Informe blocked como booleano.');
      }
      shouldBlock = body.blocked;
    } else {
      shouldBlock = !currentlyBlocked;
    }
    if (shouldBlock && !currentlyBlocked) {
      db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)').run(
        me.id,
        target.id,
        now()
      );
      blockRelationships(me.id, target.id);
      db.prepare('DELETE FROM dating_likes WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)').run(
        me.id,
        target.id,
        target.id,
        me.id
      );
    } else if (!shouldBlock && currentlyBlocked) {
      db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(me.id, target.id);
    }
    return json(res, 200, { blocked: shouldBlock });
  }

  // --- posts ----------------------------------------------------------
  if (method === 'POST' && pathname === '/api/posts') {
    rateLimit(req, 'posts', 30, 10 * 60 * 1000);
    const body = await readBody(req);
    const videoUrl = typeof body.videoUrl === 'string' && body.videoUrl.trim()
      ? requireVideoUpload(body.videoUrl, me.id)
      : null;
    const isVideo = !!videoUrl || (typeof body.video === 'string' && body.video.length > 0);
    const rawImages = Array.isArray(body.images)
      ? body.images.filter((value) => typeof value === 'string' && value.trim())
      : [];
    const singleImage =
      typeof body.image === 'string' && body.image.trim() ? body.image : null;
    if (isVideo && (rawImages.length || singleImage)) {
      throw new HttpError(400, 'Escolha um vídeo ou fotos, não os dois.');
    }
    if (rawImages.length > 10) throw new HttpError(400, 'Envie no máximo 10 fotos por publicação.');
    const imageSources = rawImages.length ? rawImages : singleImage ? [singleImage] : [];
    const totalImageSize = imageSources.reduce((sum, value) => sum + value.length, 0);
    if (totalImageSize > 34 * 1024 * 1024) {
      throw new HttpError(413, 'As fotos somam mais de 34 MB. Escolha arquivos menores.');
    }
    const caption = cleanText(body.caption, 'Legenda', { max: 2200 });
    const hasMedia = isVideo || imageSources.length > 0;
    if (!hasMedia && !caption) {
      throw new HttpError(400, 'Escreva uma legenda ou adicione uma mídia antes de publicar.');
    }
    const topic = POST_TOPICS.includes(body.topic) ? body.topic : 'cotidiano';
    const media = [];
    try {
      if (isVideo) {
        media.push({ url: videoUrl || saveVideo(body.video, 'post'), mediaType: 'video' });
      } else {
        for (const source of imageSources) {
          media.push({ url: saveImage(source, 'post'), mediaType: 'image' });
        }
      }
    } catch (error) {
      for (const item of media) removeUploadIfUnused(item.url);
      throw error;
    }
    const cover = media[0];
    let postId = null;
    try {
      const result = db
        .prepare('INSERT INTO posts (user_id, image, caption, media_type, topic, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(me.id, cover ? cover.url : '', caption, cover ? cover.mediaType : 'text', topic, now());
      postId = Number(result.lastInsertRowid);
      const insertMedia = db.prepare(
        'INSERT INTO post_media (post_id, url, media_type, position) VALUES (?, ?, ?, ?)'
      );
      media.forEach((item, index) => insertMedia.run(postId, item.url, item.mediaType, index));
    } catch (error) {
      if (postId) db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
      for (const item of media) removeUploadIfUnused(item.url);
      throw error;
    }
    const row = db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(me.id, postId);
    return json(res, 201, { post: withViewerState(withPreviews([row].map(mapPost)), me.id)[0] });
  }

  const postMatch = matchRoute(pathname, '/api/posts/:id');
  if (postMatch) {
    const postId = Number(postMatch.id);
    if (!Number.isInteger(postId)) throw new HttpError(400, 'Publicação inválida.');
    const row = db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(me.id, postId);
    if (!row) throw new HttpError(404, 'Publicação não encontrada.');
    if (row.user_id !== me.id && isBlocked(me.id, row.user_id)) {
      throw new HttpError(404, 'Publicação não encontrada.');
    }
    if (!canViewUserContent(me.id, { id: row.user_id, is_private: row.is_private })) {
      throw new HttpError(403, 'Este perfil é privado. Envie uma solicitação para seguir e ver o conteúdo.');
    }

    if (method === 'GET') {
      const post = withViewerState(withMedia([mapPost(row)]), me.id)[0];
      return json(res, 200, {
        post,
        comments: commentsFor(postId).filter((comment) => comment.user.id === me.id || !isBlocked(me.id, comment.user.id)),
        canDelete: row.user_id === me.id,
      });
    }

    if (method === 'DELETE') {
      if (row.user_id !== me.id) throw new HttpError(403, 'Você só pode apagar suas publicações.');
      const mediaUrls = db.prepare('SELECT url FROM post_media WHERE post_id = ?').all(postId).map((item) => item.url);
      db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
      for (const url of new Set([row.image, ...mediaUrls])) removeUploadIfUnused(url);
      return json(res, 200, { ok: true });
    }
  }

  const shareMatch = matchRoute(pathname, '/api/posts/:id/share');
  if (method === 'POST' && shareMatch) {
    rateLimit(req, 'shares', 60, 10 * 60 * 1000);
    const postId = Number(shareMatch.id);
    const post = db
      .prepare('SELECT p.*, u.username, u.is_private FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?')
      .get(postId);
    if (!post || (post.user_id !== me.id && isBlocked(me.id, post.user_id))) {
      throw new HttpError(404, 'Publicação não encontrada.');
    }
    if (!canViewUserContent(me.id, { id: post.user_id, is_private: post.is_private })) {
      throw new HttpError(403, 'Este perfil é privado. Envie uma solicitação para seguir e ver o conteúdo.');
    }
    db.prepare('INSERT OR IGNORE INTO shares (user_id, post_id, created_at) VALUES (?, ?, ?)').run(me.id, postId, now());
    const count = db.prepare('SELECT COUNT(*) AS n FROM shares WHERE post_id = ?').get(postId).n;
    return json(res, 200, {
      shares: count,
      link: `/publicacoes/${postId}`,
      post: withViewerState(
        [mapPost(db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(me.id, postId))],
        me.id,
      )[0],
    });
  }

  const likeMatch = matchRoute(pathname, '/api/posts/:id/like');
  if (method === 'POST' && likeMatch) {
    rateLimit(req, 'likes', 180, 60 * 1000);
    const postId = Number(likeMatch.id);
    const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);
    if (!post) throw new HttpError(404, 'Publicação não encontrada.');
    if (isBlocked(me.id, post.user_id)) throw new HttpError(404, 'Publicação não encontrada.');
    assertCanViewOwner(me.id, post.user_id);
    const liked = !!db
      .prepare('SELECT 1 AS ok FROM likes WHERE user_id = ? AND post_id = ?')
      .get(me.id, postId);
    if (liked) {
      db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(me.id, postId);
    } else {
      db.prepare('INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)').run(me.id, postId, now());
      notify(post.user_id, 'like', `${me.name} curtiu sua publicação.`, `/publicacoes/${postId}`);
    }
    const count = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?').get(postId).n;
    return json(res, 200, { liked: !liked, likes: count });
  }

  const repostMatch = matchRoute(pathname, '/api/posts/:id/repost');
  if (method === 'POST' && repostMatch) {
    rateLimit(req, 'reposts', 120, 60 * 1000);
    const postId = Number(repostMatch.id);
    const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);
    if (!post) throw new HttpError(404, 'Publicação não encontrada.');
    if (isBlocked(me.id, post.user_id)) throw new HttpError(404, 'Publicação não encontrada.');
    assertCanViewOwner(me.id, post.user_id);
    const reposted = !!db
      .prepare('SELECT 1 AS ok FROM reposts WHERE user_id = ? AND post_id = ?')
      .get(me.id, postId);
    if (reposted) {
      db.prepare('DELETE FROM reposts WHERE user_id = ? AND post_id = ?').run(me.id, postId);
    } else {
      db.prepare('INSERT OR IGNORE INTO reposts (user_id, post_id, created_at) VALUES (?, ?, ?)').run(me.id, postId, now());
    }
    const count = db.prepare('SELECT COUNT(*) AS n FROM reposts WHERE post_id = ?').get(postId).n;
    return json(res, 200, { reposted: !reposted, reposts: count });
  }

  const saveMatch = matchRoute(pathname, '/api/posts/:id/save');
  if (method === 'POST' && saveMatch) {
    rateLimit(req, 'saved-posts', 120, 60 * 1000);
    const postId = Number(saveMatch.id);
    const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);
    if (!post) throw new HttpError(404, 'Publicação não encontrada.');
    if (isBlocked(me.id, post.user_id)) throw new HttpError(404, 'Publicação não encontrada.');
    assertCanViewOwner(me.id, post.user_id);
    const saved = !!db
      .prepare('SELECT 1 AS ok FROM saved_posts WHERE user_id = ? AND post_id = ?')
      .get(me.id, postId);
    if (saved) {
      db.prepare('DELETE FROM saved_posts WHERE user_id = ? AND post_id = ?').run(me.id, postId);
    } else {
      db.prepare('INSERT OR IGNORE INTO saved_posts (user_id, post_id, created_at) VALUES (?, ?, ?)').run(me.id, postId, now());
    }
    const count = db.prepare('SELECT COUNT(*) AS n FROM saved_posts WHERE post_id = ?').get(postId).n;
    return json(res, 200, { saved: !saved, saves: count });
  }

  const commentsMatch = matchRoute(pathname, '/api/posts/:id/comments');
  if (commentsMatch) {
    const postId = Number(commentsMatch.id);
    const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);
    if (!post) throw new HttpError(404, 'Publicação não encontrada.');
    if (post.user_id !== me.id && isBlocked(me.id, post.user_id)) {
      throw new HttpError(404, 'Publicação não encontrada.');
    }
    assertCanViewOwner(me.id, post.user_id);

    if (method === 'GET') {
      return json(res, 200, { comments: commentsFor(postId) });
    }

    if (method === 'POST') {
      rateLimit(req, 'comments', 60, 5 * 60 * 1000);
      const body = await readBody(req);
      const text = cleanText(body.text, 'Comentário', { min: 1, max: 500, required: true });
      const result = db
        .prepare('INSERT INTO comments (post_id, user_id, text, created_at) VALUES (?, ?, ?, ?)')
        .run(postId, me.id, text, now());
      const comment = db
        .prepare(
          `SELECT c.id, c.text, c.created_at, u.id AS user_id, u.username, u.name, u.avatar
           FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
        )
        .get(Number(result.lastInsertRowid));
      const count = db.prepare('SELECT COUNT(*) AS n FROM comments WHERE post_id = ?').get(postId).n;
      notify(post.user_id, 'comment', `${me.name} comentou na sua publicação.`, `/publicacoes/${postId}`);
      return json(res, 201, { comment: commentDTO(comment), comments: count });
    }
  }

  const commentMatch = matchRoute(pathname, '/api/comments/:id');
  if (method === 'DELETE' && commentMatch) {
    const comment = db
      .prepare(
        `SELECT c.*, p.user_id AS post_owner FROM comments c
         JOIN posts p ON p.id = c.post_id WHERE c.id = ?`
      )
      .get(Number(commentMatch.id));
    if (!comment) throw new HttpError(404, 'Comentário não encontrado.');
    if (comment.user_id !== me.id && comment.post_owner !== me.id) {
      throw new HttpError(403, 'Sem permissão para apagar este comentário.');
    }
    db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
    return json(res, 200, { ok: true });
  }

  // --- stories --------------------------------------------------------
  if (method === 'GET' && pathname === '/api/stories') {
    db.prepare('DELETE FROM stories WHERE expires_at <= ?').run(now());
    const rows = db
      .prepare(
        `SELECT s.id, s.image, s.media_type, s.created_at, s.expires_at, s.audience, s.caption, s.mentions, u.id AS user_id, u.username, u.name, u.avatar,
                u.is_private,
                CASE WHEN sv.story_id IS NULL THEN 0 ELSE 1 END AS viewed
         FROM stories s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.user_id = ?
         WHERE s.expires_at > ?
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.blocker_id = ? AND b.blocked_id = s.user_id)
                OR (b.blocker_id = s.user_id AND b.blocked_id = ?)
           )
           AND (u.is_private = 0 OR s.user_id = ? OR EXISTS (
             SELECT 1 FROM follows f
             WHERE f.follower_id = ? AND f.following_id = s.user_id
           ))
           AND (
             s.audience = 'public'
             OR s.user_id = ?
             OR EXISTS (
               SELECT 1 FROM close_friends cf
               WHERE cf.owner_id = s.user_id AND cf.friend_id = ?
             )
           )
         ORDER BY s.created_at ASC`
      )
      .all(me.id, now(), me.id, me.id, me.id, me.id, me.id, me.id);

    const groups = new Map();
    for (const row of rows) {
      if (!groups.has(row.user_id)) {
        groups.set(row.user_id, {
          user: { id: row.user_id, username: row.username, name: row.name, avatar: row.avatar || null },
          isCloseFriend: isCloseFriend(row.user_id, me.id),
          stories: [],
        });
      }
      groups.get(row.user_id).stories.push({
        id: row.id,
        image: row.image,
        mediaType: row.media_type || 'image',
        audience: row.audience || 'public',
        caption: row.caption || '',
        mentions: parseJsonArray(row.mentions, null),
        createdAt: row.created_at,
        viewed: !!row.viewed,
      });
    }
    const list = [...groups.values()].map((group) => ({
      ...group,
      allViewed: group.stories.every((story) => story.viewed),
    }));
    list.sort((a, b) => {
      if (a.user.id === me.id) return -1;
      if (b.user.id === me.id) return 1;
      return Number(a.allViewed) - Number(b.allViewed);
    });
    return json(res, 200, { groups: list });
  }

  if (method === 'POST' && pathname === '/api/stories') {
    rateLimit(req, 'stories', 20, 10 * 60 * 1000);
    const body = await readBody(req);
    const closeFriendsOnly = body.closeFriends === true;
    const audience = closeFriendsOnly ? 'close_friends' : 'public';
    const caption = String(body.caption || '').trim().slice(0, 300);
    const rawMentionNames = new Set();
    if (Array.isArray(body.mentions)) {
      for (const value of body.mentions) {
        if (typeof value === 'string' && value.trim()) rawMentionNames.add(value.trim().replace(/^@/, ''));
      }
    }
    for (const match of caption.matchAll(/@([a-zA-Z0-9._]+)/g)) {
      rawMentionNames.add(match[1]);
    }
    const mentionUsers = [];
    for (const username of rawMentionNames) {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!user || user.id === me.id) continue;
      if (isBlocked(me.id, user.id)) continue;
      if (audience === 'close_friends' && !isCloseFriend(me.id, user.id)) continue;
      if (!canViewUserContent(user.id, me)) continue;
      mentionUsers.push(user);
    }
    const mentionUsernames = mentionUsers.map((user) => user.username);
    const videoUrl = typeof body.videoUrl === 'string' && body.videoUrl.trim()
      ? requireVideoUpload(body.videoUrl, me.id)
      : null;
    const isVideo = !!videoUrl || (typeof body.video === 'string' && body.video.length > 0);
    const image = videoUrl || (isVideo ? saveVideo(body.video, 'story') : saveImage(body.image, 'story'));
    const timestamp = now();
    let result;
    try {
      result = db
        .prepare(
          'INSERT INTO stories (user_id, image, media_type, audience, caption, mentions, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          me.id,
          image,
          isVideo ? 'video' : 'image',
          audience,
          caption,
          JSON.stringify(mentionUsernames),
          timestamp,
          timestamp + 24 * 60 * 60 * 1000
        );
    } catch (error) {
      removeUploadIfUnused(image);
      throw error;
    }
    for (const user of mentionUsers) {
      notify(user.id, 'mention', `${me.name} mencionou você em um story.`, `/perfil/${encodeURIComponent(me.username)}`);
    }
    return json(res, 201, {
      story: {
        id: Number(result.lastInsertRowid),
        image,
        mediaType: isVideo ? 'video' : 'image',
        audience,
        caption,
        mentions: mentionUsernames,
        createdAt: timestamp,
        viewed: true,
      },
    });
  }

  const storyViewMatch = matchRoute(pathname, '/api/stories/:id/view');
  if (method === 'POST' && storyViewMatch) {
    const storyId = Number(storyViewMatch.id);
    const story = db
      .prepare('SELECT s.id, s.user_id, s.audience, u.is_private FROM stories s JOIN users u ON u.id = s.user_id WHERE s.id = ?')
      .get(storyId);
    if (!story) throw new HttpError(404, 'Story não encontrado.');
    assertCanViewOwner(me.id, story.user_id);
    if (
      story.audience === 'close_friends' &&
      story.user_id !== me.id &&
      !isCloseFriend(story.user_id, me.id)
    ) {
      throw new HttpError(403, 'Este story é apenas para melhores amigos.');
    }
    db.prepare('INSERT OR IGNORE INTO story_views (story_id, user_id, viewed_at) VALUES (?, ?, ?)').run(
      storyId,
      me.id,
      now()
    );
    return json(res, 200, { ok: true });
  }

  const storyMatch = matchRoute(pathname, '/api/stories/:id');
  if (method === 'DELETE' && storyMatch) {
    const storyId = Number(storyMatch.id);
    const story = db.prepare('SELECT id, user_id, image FROM stories WHERE id = ?').get(storyId);
    if (!story) throw new HttpError(404, 'Story não encontrado.');
    if (story.user_id !== me.id) throw new HttpError(403, 'Você só pode apagar seus stories.');
    db.prepare('DELETE FROM stories WHERE id = ?').run(storyId);
    removeUploadIfUnused(story.image);
    return json(res, 200, { ok: true });
  }

  // --- interações com stories -----------------------------------------
  const storyReactionMatch = matchRoute(pathname, '/api/stories/:id/react');
  if (method === 'POST' && storyReactionMatch) {
    rateLimit(req, 'story-reactions', 120, 60 * 1000);
    const storyId = Number(storyReactionMatch.id);
    const story = db
      .prepare('SELECT s.id, s.user_id, s.audience, u.is_private FROM stories s JOIN users u ON u.id = s.user_id WHERE s.id = ?')
      .get(storyId);
    if (!story) throw new HttpError(404, 'Story não encontrado.');
    assertCanViewOwner(me.id, story.user_id);
    if (story.audience === 'close_friends' && story.user_id !== me.id && !isCloseFriend(story.user_id, me.id)) {
      throw new HttpError(403, 'Este story é apenas para melhores amigos.');
    }
    const body = await readBody(req);
    const emoji = String(body.emoji || '').trim();
    const allowedEmojis = ['❤️', '😂', '😮', '😢', '👏', '🔥', '😍', '💯'];
    if (!allowedEmojis.includes(emoji)) throw new HttpError(400, 'Reação inválida.');
    db.prepare(
      'INSERT INTO story_reactions (story_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(story_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at'
    ).run(storyId, me.id, emoji, now());
    if (story.user_id !== me.id) {
      notify(story.user_id, 'story_reaction', `${me.name} reagiu ${emoji} ao seu story.`, `/perfil/${encodeURIComponent(me.username)}`);
    }
    return json(res, 200, { ok: true, emoji });
  }

  const storyViewsMatch = matchRoute(pathname, '/api/stories/:id/views');
  if (method === 'GET' && storyViewsMatch) {
    const storyId = Number(storyViewsMatch.id);
    const story = db.prepare('SELECT id, user_id FROM stories WHERE id = ?').get(storyId);
    if (!story) throw new HttpError(404, 'Story não encontrado.');
    if (story.user_id !== me.id) throw new HttpError(403, 'Apenas o autor vê as visualizações.');
    const rows = db
      .prepare(
        `SELECT u.id, u.username, u.name, u.avatar, u.interests, u.is_private, sv.viewed_at
         FROM story_views sv JOIN users u ON u.id = sv.user_id
         WHERE sv.story_id = ?
         ORDER BY sv.viewed_at DESC`
      )
      .all(storyId);
    return json(res, 200, {
      users: rows.map((row) => ({ ...userDTO(row), viewedAt: row.viewed_at })),
    });
  }

  const storyReplyMatch = matchRoute(pathname, '/api/stories/:id/reply');
  if (method === 'POST' && storyReplyMatch) {
    rateLimit(req, 'story-replies', 60, 60 * 1000);
    const storyId = Number(storyReplyMatch.id);
    const story = db
      .prepare('SELECT s.id, s.user_id, s.audience, u.is_private FROM stories s JOIN users u ON u.id = s.user_id WHERE s.id = ?')
      .get(storyId);
    if (!story) throw new HttpError(404, 'Story não encontrado.');
    if (story.user_id === me.id) throw new HttpError(400, 'Você não pode responder ao próprio story.');
    assertCanViewOwner(me.id, story.user_id);
    if (story.audience === 'close_friends' && !isCloseFriend(story.user_id, me.id)) {
      throw new HttpError(403, 'Este story é apenas para melhores amigos.');
    }
    const storyOwner = db.prepare('SELECT * FROM users WHERE id = ?').get(story.user_id);
    if (!storyOwner || !canMessageTarget(me, storyOwner)) {
      throw new HttpError(403, 'Este perfil não aceita mensagens suas no momento.');
    }
    const body = await readBody(req);
    const text = cleanText(body.text, 'Resposta', { min: 1, max: 500, required: true });
    let conversation = db
      .prepare(
        `SELECT c.* FROM conversations c
         JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
         JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
         WHERE c.kind = 'social'
         LIMIT 1`
      )
      .get(me.id, story.user_id);
    if (!conversation) {
      const timestamp = now();
      const result = db
        .prepare("INSERT INTO conversations (kind, created_at, updated_at) VALUES ('social', ?, ?)")
        .run(timestamp, timestamp);
      conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(Number(result.lastInsertRowid));
      addConversationMember(conversation.id, me.id);
      addConversationMember(conversation.id, story.user_id);
    } else {
      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now(), conversation.id);
    }
    const storyReplyAt = now();
    const storyReplyResult = db
      .prepare('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)')
      .run(conversation.id, me.id, `Respondeu ao seu story: ${text}`, storyReplyAt);
    const storyReplyMessageId = Number(storyReplyResult.lastInsertRowid);
    sseHub.publish(
      conversationMembers(conversation.id).map((member) => member.user_id),
      'message.created',
      {
        scope: 'conversation',
        conversationId: conversation.id,
        message: {
          id: storyReplyMessageId,
          body: `Respondeu ao seu story: ${text}`,
          sharedPostId: null,
          sharedPost: null,
          media: [],
          createdAt: storyReplyAt,
          editedAt: null,
          deletedAt: null,
          mine: true,
          sender: {
            id: me.id,
            username: me.username,
            name: me.name,
            avatar: me.avatar || null,
            verified: isVerifiedUser(me.id),
          },
        },
      },
      (client) => authorizeConversationRecipient(client, conversation.id),
      ssePayloadForRecipient,
    );
    notify(story.user_id, 'story_reply', `${me.name} respondeu ao seu story.`, `/mensagens?conversa=${conversation.id}`);
    return json(res, 201, { ok: true, conversationId: conversation.id });
  }

  // --- conversas / mensagens -----------------------------------------
  if (method === 'GET' && pathname === '/api/conversations') {
    /* Uma consulta monta conversa, leitura, última mensagem e não lidas.
       Isso evita o N+1 que bloqueava a worker PostgreSQL em cada polling. */
    const rows = db
      .prepare(
        `SELECT c.*, cm.last_read_at,
                lm.id AS last_id, lm.sender_id AS last_sender_id,
                lm.body AS last_body, lm.shared_post_id AS last_shared_post_id,
                lm.created_at AS last_created_at,
                last_sender.username AS last_sender_username,
                last_sender.name AS last_sender_name,
                last_sender.avatar AS last_sender_avatar,
                CASE WHEN EXISTS (
                  SELECT 1 FROM identity_verifications last_verified
                  WHERE last_verified.user_id = lm.sender_id AND last_verified.status = 'approved'
                ) THEN 1 ELSE 0 END AS last_sender_verified,
                (SELECT COUNT(*) FROM messages unread
                 WHERE unread.conversation_id = c.id
                   AND unread.sender_id != ?
                   AND unread.deleted_at IS NULL
                   AND unread.created_at > cm.last_read_at) AS unread_count
         FROM conversations c
         JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
         LEFT JOIN messages lm ON lm.id = (
           SELECT candidate.id FROM messages candidate
           WHERE candidate.conversation_id = c.id AND candidate.deleted_at IS NULL
           ORDER BY candidate.created_at DESC, candidate.id DESC
           LIMIT 1
         )
         LEFT JOIN users last_sender ON last_sender.id = lm.sender_id
         ORDER BY c.updated_at DESC
         LIMIT 50`
      )
      .all(me.id, me.id);
    if (!rows.length) return json(res, 200, { conversations: [] });

    const conversationIds = rows.map((row) => row.id);
    const placeholders = conversationIds.map(() => '?').join(',');
    const memberRows = db
      .prepare(
        `SELECT cm.conversation_id, cm.user_id, u.*
         FROM conversation_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.conversation_id IN (${placeholders}) AND cm.user_id != ?`
      )
      .all(...conversationIds, me.id);
    const membersByConversation = new Map();
    for (const member of memberRows) {
      const members = membersByConversation.get(member.conversation_id) || [];
      members.push(member);
      membersByConversation.set(member.conversation_id, members);
    }

    const blockRows = db
      .prepare('SELECT blocker_id, blocked_id FROM blocks WHERE blocker_id = ? OR blocked_id = ?')
      .all(me.id, me.id);
    const blockedUserIds = new Set(
      blockRows.map((block) => (block.blocker_id === me.id ? block.blocked_id : block.blocker_id)),
    );

    const datingAccessByUser = batchDatingConversationAccess(me, memberRows);
    const conversations = [];
    for (const row of rows) {
      const others = membersByConversation.get(row.id) || [];
      if (!others.length) continue;
      const other = others[0];
      if (blockedUserIds.has(other.user_id)) continue;
      if (row.kind === 'dating' && !datingAccessByUser.has(other.user_id)) continue;
      conversations.push({
        id: row.id,
        kind: row.kind,
        matchId: row.match_id,
        other: userDTO({
          ...other,
          id: other.user_id,
        }),
        lastMessage: row.last_id
          ? {
              id: row.last_id,
              body: row.last_body,
              sharedPostId: row.last_shared_post_id,
              createdAt: row.last_created_at,
              mine: row.last_sender_id === me.id,
              sender: {
                id: row.last_sender_id,
                username: row.last_sender_username,
                name: row.last_sender_name,
                avatar: row.last_sender_avatar || null,
                verified: !!row.last_sender_verified,
              },
            }
          : null,
        unread: Number(row.unread_count || 0),
        updatedAt: row.updated_at,
      });
    }
    return json(res, 200, { conversations });
  }

  if (method === 'POST' && pathname === '/api/conversations') {
    rateLimit(req, 'conversations', 30, 10 * 60 * 1000);
    const body = await readBody(req);
    const username = cleanText(body.username, 'Usuário', { min: 1, max: 40, required: true }).toLowerCase();
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!target) throw new HttpError(404, 'Perfil não encontrado.');
    if (target.id === me.id) throw new HttpError(400, 'Você não pode conversar consigo mesmo.');
    if (isBlocked(me.id, target.id)) throw new HttpError(403, 'Conversa indisponível.');
    if (!canMessageTarget(me, target)) {
      throw new HttpError(403, 'Este perfil não aceita mensagens suas no momento.');
    }
    let conversation = db
      .prepare(
        `SELECT c.* FROM conversations c
         JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
         JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
         WHERE c.kind = 'social'
         LIMIT 1`
      )
      .get(me.id, target.id);
    if (!conversation) {
      const timestamp = now();
      const result = db
        .prepare("INSERT INTO conversations (kind, created_at, updated_at) VALUES ('social', ?, ?)")
        .run(timestamp, timestamp);
      conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(Number(result.lastInsertRowid));
      addConversationMember(conversation.id, me.id);
      addConversationMember(conversation.id, target.id);
      notify(target.id, 'message', `${me.name} iniciou uma conversa com você.`, `/mensagens?conversa=${conversation.id}`);
    }
    return json(res, 200, {
      conversation: {
        id: conversation.id,
        kind: 'social',
        other: userDTO(target),
      },
    });
  }

  const conversationMatch = matchRoute(pathname, '/api/conversations/:id');
  if (method === 'GET' && conversationMatch) {
    const conversationId = Number(conversationMatch.id);
    if (!isConversationMember(conversationId, me.id)) {
      throw new HttpError(404, 'Conversa não encontrada.');
    }
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
    const members = conversationMembers(conversationId);
    const other = members.find((member) => member.user_id !== me.id);
    if (!other) throw new HttpError(404, 'Conversa não encontrada.');
    if (isBlocked(me.id, other.user_id)) throw new HttpError(404, 'Conversa indisponível.');
    let canSend = true;
    let reason = null;
    if (conversation.kind === 'dating') {
      if (!datingAccessFor(me)) {
        throw new HttpError(403, 'O Namoro exige verificação de identidade e idade aprovada.', 'dating_locked');
      }
      const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(conversation.match_id);
      if (!match || match.ended_at) {
        canSend = false;
        reason = 'match_ended';
      } else if (!datingConversationAccess(me, other.user_id)) {
        canSend = false;
        reason = 'dating_locked';
      }
    } else {
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(other.user_id);
      if (!socialSendAllowed(me, target)) {
        canSend = false;
        reason = 'messaging_policy';
      }
    }
    const rows = db
      .prepare(
        `SELECT m.id, m.sender_id, m.body, m.shared_post_id, m.created_at,
                m.edited_at, m.deleted_at,
                sender.username AS sender_username,
                sender.name AS sender_name,
                sender.avatar AS sender_avatar,
                CASE WHEN EXISTS (
                  SELECT 1 FROM identity_verifications sender_verified
                  WHERE sender_verified.user_id = m.sender_id AND sender_verified.status = 'approved'
                ) THEN 1 ELSE 0 END AS sender_verified
         FROM messages m
         JOIN users sender ON sender.id = m.sender_id
         WHERE m.conversation_id = ? AND m.deleted_at IS NULL
         ORDER BY m.id DESC LIMIT 200`
      )
      .all(conversationId);
    /* Mais recentes primeiro no banco; exibição permanece em ordem crescente. */
    rows.reverse();
    const messageIds = rows.map((row) => row.id);
    const mediaByMessage = new Map();
    if (messageIds.length) {
      const placeholders = messageIds.map(() => '?').join(',');
      const mediaRows = db
        .prepare(
          `SELECT message_id, url, media_type, mime_type, size_bytes, file_name
           FROM message_media
           WHERE message_id IN (${placeholders})
           ORDER BY message_id, position, id`
        )
        .all(...messageIds);
      for (const media of mediaRows) {
        const items = mediaByMessage.get(media.message_id) || [];
        items.push(mapMessageMedia(media));
        mediaByMessage.set(media.message_id, items);
      }
    }
    const sharedIds = [...new Set(rows.map((row) => row.shared_post_id).filter(Boolean))];
    const sharedPosts = new Map();
    if (sharedIds.length) {
      const placeholders = sharedIds.map(() => '?').join(',');
      const postRows = db
        .prepare(`${POST_SELECT} WHERE p.id IN (${placeholders})`)
        .all(me.id, ...sharedIds);
      for (const post of postRows.map(mapPost)) sharedPosts.set(post.id, post);
    }
    return json(res, 200, {
      conversation: { id: conversation.id, kind: conversation.kind, matchId: conversation.match_id, canSend, reason },
      other: userDTO({
        ...other,
        id: other.user_id,
      }),
      messages: rows.map((row) => ({
        id: row.id,
        body: row.body,
        sharedPost: row.shared_post_id ? sharedPosts.get(row.shared_post_id) || null : null,
        sharedPostId: row.shared_post_id,
        media: mediaByMessage.get(row.id) || [],
        createdAt: row.created_at,
        editedAt: row.edited_at || null,
        deletedAt: row.deleted_at || null,
        mine: row.sender_id === me.id,
        sender: {
          id: row.sender_id,
          username: row.sender_username,
          name: row.sender_name,
          avatar: row.sender_avatar || null,
          verified: !!row.sender_verified,
        },
      })),
    });
  }

  const messagesMatch = matchRoute(pathname, '/api/conversations/:id/messages');
  if (method === 'POST' && messagesMatch) {
    rateLimit(req, 'messages', 90, 60 * 1000);
    const conversationId = Number(messagesMatch.id);
    if (!isConversationMember(conversationId, me.id)) {
      throw new HttpError(404, 'Conversa não encontrada.');
    }
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
    const other = conversationMembers(conversationId).find((member) => member.user_id !== me.id);
    if (!other) throw new HttpError(404, 'Conversa não encontrada.');
    if (isBlocked(me.id, other.user_id)) throw new HttpError(403, 'Conversa indisponível.');
    if (conversation.kind === 'dating') {
      if (!datingConversationAccess(me, other.user_id)) {
        throw new HttpError(403, 'O Namoro exige verificação de identidade e idade aprovada para as duas pessoas.', 'dating_locked');
      }
      const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(conversation.match_id);
      if (!match || match.ended_at) throw new HttpError(403, 'Este match foi encerrado.');
    } else {
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(other.user_id);
      if (!socialSendAllowed(me, target)) {
        throw new HttpError(403, 'Este perfil não aceita mensagens suas no momento.');
      }
    }
    const body = await readBody(req);
    const text = cleanText(body.text, 'Mensagem', { max: 2000 });
    let sharedPostId = null;
    if (body.sharedPostId !== undefined && body.sharedPostId !== null) {
      sharedPostId = Number(body.sharedPostId);
      const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(sharedPostId);
      if (!post || isBlocked(me.id, post.user_id)) throw new HttpError(404, 'Publicação não encontrada.');
    }

    const requestedMedia = body.media === undefined || body.media === null ? [] : body.media;
    if (!Array.isArray(requestedMedia)) throw messageMediaError('Anexos inválidos.');
    if (requestedMedia.length > MESSAGE_MEDIA_MAX_ITEMS) {
      throw messageMediaError(`Envie no máximo ${MESSAGE_MEDIA_MAX_ITEMS} anexos por mensagem.`);
    }
    const mediaItems = requestedMedia.map(validateMessageMediaItem);
    const totalMediaBytes = mediaItems.reduce((total, item) => total + item.sizeBytes, 0);
    if (totalMediaBytes > MESSAGE_MEDIA_MAX_BYTES) {
      throw messageMediaError('Anexos grandes demais (limite total de 25 MB).', 413);
    }
    if (!text && !sharedPostId && mediaItems.length === 0) {
      throw new HttpError(400, 'Escreva uma mensagem ou anexe um arquivo.');
    }

    const timestamp = now();
    const savedMedia = [];
    try {
      for (const item of mediaItems) {
        savedMedia.push({
          ...item,
          ...saveMessageMedia(item, conversationId, me.id),
        });
      }

      const messageId = withTransaction(() => {
        const result = db
          .prepare(
            'INSERT INTO messages (conversation_id, sender_id, body, shared_post_id, created_at) VALUES (?, ?, ?, ?, ?)'
          )
          .run(conversationId, me.id, text, sharedPostId, timestamp);
        const id = Number(result.lastInsertRowid);
        for (const [position, item] of savedMedia.entries()) {
          db.prepare(
            `INSERT INTO message_media
             (message_id, url, media_type, mime_type, size_bytes, file_name, position, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            id,
            item.url,
            item.mediaType,
            item.mimeType,
            item.sizeBytes,
            item.fileName,
            position,
            timestamp
          );
        }
        db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(timestamp, conversationId);
        db.prepare('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?').run(
          timestamp,
          conversationId,
          me.id
        );

        /* Renomeia dentro da transação: falha no move causa rollback do banco.
         * Crash antes do COMMIT deixa arquivo sem referência, removido na
         * próxima limpeza após confirmar ausência em message_media. */
        for (const item of savedMedia) {
          fs.renameSync(item.stagedPath, item.finalPath);
        }

        notify(
          other.user_id,
          'message',
          sharedPostId ? `${me.name} compartilhou uma publicação com você.` : `${me.name} enviou uma mensagem.`,
          `/mensagens?conversa=${conversationId}`
        );
        return id;
      });

      const messageDTO = {
        id: messageId,
        body: text,
        sharedPostId,
        sharedPost: null,
        media: savedMedia.map(mapMessageMedia),
        createdAt: timestamp,
        editedAt: null,
        deletedAt: null,
        mine: true,
        sender: {
          id: me.id,
          username: me.username,
          name: me.name,
          avatar: me.avatar || null,
          verified: isVerifiedUser(me.id),
        },
      };
      if (sharedPostId) {
        const sharedPost = db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(me.id, sharedPostId);
        if (sharedPost) messageDTO.sharedPost = mapPost(sharedPost);
      }
      sseHub.publish(
        conversationMembers(conversationId).map((member) => member.user_id),
        'message.created',
        {
          scope: 'conversation',
          conversationId,
          message: messageDTO,
        },
        (client) => authorizeConversationRecipient(client, conversationId),
        ssePayloadForRecipient,
      );

      return json(res, 201, { message: messageDTO });
    } catch (error) {
      /* Depois do rollback, confirma message_media antes de apagar arquivo final. */
      for (const item of savedMedia) {
        fs.rmSync(item.stagedPath, { force: true });
        removeUploadIfUnused(item.url);
      }
      throw error;
    }
  }

  const readMatch = matchRoute(pathname, '/api/conversations/:id/read');
  if (method === 'POST' && readMatch) {
    const conversationId = Number(readMatch.id);
    if (!isConversationMember(conversationId, me.id)) throw new HttpError(404, 'Conversa não encontrada.');
    const conversation = db.prepare('SELECT kind FROM conversations WHERE id = ?').get(conversationId);
    if (!conversation) throw new HttpError(404, 'Conversa não encontrada.');
    const other = conversationMembers(conversationId).find((member) => member.user_id !== me.id);
    if (!other) throw new HttpError(404, 'Conversa não encontrada.');
    if (isBlocked(me.id, other.user_id)) throw new HttpError(404, 'Conversa indisponível.');
    if (conversation.kind === 'dating' && !datingConversationAccess(me, other.user_id)) {
      throw new HttpError(403, 'O Namoro exige verificação de identidade e idade aprovada para as duas pessoas.', 'dating_locked');
    }
    db.prepare('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?').run(
      now(),
      conversationId,
      me.id
    );
    return json(res, 200, { ok: true });
  }

  // --- notificações globais (exclui menções de servidor) ---
  if (method === 'GET' && pathname === '/api/notifications') {
    const rows = db
      .prepare(
        `SELECT id, kind, text, link, created_at, read_at FROM notifications
         WHERE user_id = ? AND kind != ? ORDER BY created_at DESC LIMIT 30`
      )
      .all(me.id, 'server_mention');
    return json(res, 200, {
      notifications: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        text: row.text,
        link: row.link,
        createdAt: row.created_at,
        read: !!row.read_at,
      })),
      unread: unreadNotifications(me.id),
    });
  }

  if (method === 'POST' && pathname === '/api/notifications/read') {
    db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now(), me.id);
    return json(res, 200, { ok: true });
  }

  // --- denúncias / moderação -----------------------------------------
  if (method === 'POST' && pathname === '/api/problem-reports') {
    rateLimit(req, 'problem-reports', 8, 60 * 60 * 1000);
    const body = await readBody(req);
    const category = String(body.category || '').trim();
    if (!PROBLEM_CATEGORIES.has(category)) {
      throw new HttpError(400, 'Categoria de problema inválida.');
    }
    const title = cleanText(body.title, 'Resumo', { min: 3, max: 120, required: true });
    const details = cleanText(body.details || '', 'Detalhes', { max: 2000 });
    const context = cleanText(body.context || '', 'Contexto', { max: 300 });
    const result = db
      .prepare(
        'INSERT INTO problem_reports (reporter_id, category, title, details, context, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(me.id, category, title, details, context, now());
    return json(res, 201, { report: { id: Number(result.lastInsertRowid), status: 'open' } });
  }

  if (method === 'POST' && pathname === '/api/reports') {
    rateLimit(req, 'reports', 10, 60 * 60 * 1000);
    const body = await readBody(req);
    const targetType = body.targetType;
    if (!['user', 'post', 'story', 'message'].includes(targetType)) {
      throw new HttpError(400, 'Tipo de denúncia inválido.');
    }
    const targetId = Number(body.targetId);
    if (!Number.isInteger(targetId) || targetId <= 0) throw new HttpError(400, 'Alvo inválido.');
    const reason = cleanText(body.reason, 'Motivo', { min: 3, max: 80, required: true });
    const details = cleanText(body.details || '', 'Detalhes', { max: 1000 });
    const tables = { user: 'users', post: 'posts', story: 'stories', message: 'messages' };
    const exists = db.prepare(`SELECT 1 AS ok FROM ${tables[targetType]} WHERE id = ?`).get(targetId);
    if (!exists) throw new HttpError(404, 'Conteúdo não encontrado.');
    if (targetType === 'user' && targetId === me.id) throw new HttpError(400, 'Você não pode denunciar a si mesmo.');
    const result = db
      .prepare(
        'INSERT INTO reports (reporter_id, target_type, target_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(me.id, targetType, targetId, reason, details, now());
    return json(res, 201, { report: { id: Number(result.lastInsertRowid), status: 'open' } });
  }

  if (method === 'GET' && pathname === '/api/moderation/reports') {
    requireAdmin(req);
    const rows = db
      .prepare(
        `SELECT r.*, u.username AS reporter_username
         FROM reports r JOIN users u ON u.id = r.reporter_id
         WHERE r.status IN ('open', 'reviewing')
         ORDER BY r.created_at ASC LIMIT 100`
      )
      .all();
    return json(res, 200, { reports: rows });
  }

  const reportMatch = matchRoute(pathname, '/api/moderation/reports/:id');
  if (method === 'PATCH' && reportMatch) {
    requireAdmin(req);
    const body = await readBody(req);
    if (!['reviewing', 'resolved', 'dismissed'].includes(body.status)) {
      throw new HttpError(400, 'Status de moderação inválido.');
    }
    const report = db.prepare('SELECT id FROM reports WHERE id = ?').get(Number(reportMatch.id));
    if (!report) throw new HttpError(404, 'Denúncia não encontrada.');
    db.prepare('UPDATE reports SET status = ?, reviewed_at = ? WHERE id = ?').run(body.status, now(), report.id);
    return json(res, 200, { ok: true });
  }

  // --- relatos de problemas técnicos ----------------------------------
  if (method === 'GET' && pathname === '/api/moderation/problem-reports') {
    requireAdmin(req);
    const rows = db
      .prepare(
        `SELECT p.*, u.username AS reporter_username
         FROM problem_reports p JOIN users u ON u.id = p.reporter_id
         WHERE p.status IN ('open', 'reviewing')
         ORDER BY p.created_at ASC LIMIT 100`
      )
      .all();
    return json(res, 200, { reports: rows });
  }

  const problemReportMatch = matchRoute(pathname, '/api/moderation/problem-reports/:id');
  if (method === 'PATCH' && problemReportMatch) {
    requireAdmin(req);
    const body = await readBody(req);
    if (!['reviewing', 'resolved', 'dismissed'].includes(body.status)) {
      throw new HttpError(400, 'Status de moderação inválido.');
    }
    const report = db.prepare('SELECT id FROM problem_reports WHERE id = ?').get(Number(problemReportMatch.id));
    if (!report) throw new HttpError(404, 'Relato não encontrado.');
    db.prepare('UPDATE problem_reports SET status = ?, reviewed_at = ? WHERE id = ?').run(
      body.status,
      now(),
      report.id
    );
    return json(res, 200, { ok: true });
  }

  // --- namoro ---------------------------------------------------------
  if (await dating.handle({ req, res, pathname, url, me, ctx: datingContext })) return;

  throw new HttpError(404, 'Rota não encontrada.');
}

/* ------------------------------------------------------------------ */
/* Static files                                                        */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.rtf': 'application/rtf',
};

function serveFile(res, filePath, cacheControl = 'no-cache', options = {}) {
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      json(res, 404, { error: 'Arquivo não encontrado.' });
      return;
    }
    const headers = {
      'Content-Type': options.contentType || MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    };
    if (options.contentDisposition) {
      headers['Content-Disposition'] = options.contentDisposition;
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
}

function resolveInside(base, relative) {
  const target = path.normalize(path.join(base, relative));
  const normalizedBase = path.normalize(base);
  if (target.toLowerCase() !== normalizedBase.toLowerCase() && !target.toLowerCase().startsWith(normalizedBase.toLowerCase() + path.sep)) {
    return null;
  }
  return target;
}

function getChannel(db, channelId) {
  return db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(channelId);
}

function isChannelMember(db, channelId, userId) {
  return !!db
    .prepare('SELECT 1 AS ok FROM chat_channel_members WHERE channel_id = ? AND user_id = ?')
    .get(channelId, userId);
}

function getSpaceMembership(db, spaceId, userId) {
  return db
    .prepare('SELECT role FROM chat_space_members WHERE space_id = ? AND user_id = ?')
    .get(spaceId, userId);
}

/** Anexos de mensagem (DM e canal) só podem ser lidos por membros elegíveis. */
function getMessageUploadAccess(req, url) {
  const user = currentUser(req);
  if (!user) return { allowed: false };

  // 1) Tentar mensagem direta (message_media)
  const dmRow = db
    .prepare(
      `SELECT mm.media_type, mm.mime_type, mm.file_name, m.conversation_id, c.kind, c.match_id
       FROM message_media mm
       JOIN messages m ON m.id = mm.message_id
       JOIN conversations c ON c.id = m.conversation_id
       WHERE mm.url = ? AND m.deleted_at IS NULL
       LIMIT 1`
    )
    .get(url);
  if (dmRow) {
    if (!isConversationMember(dmRow.conversation_id, user.id)) return { allowed: false };
    const members = conversationMembers(dmRow.conversation_id);
    const other = members.find((member) => member.user_id !== user.id);
    if (other) {
      if (isBlocked(user.id, other.user_id)) return { allowed: false };
      if (dmRow.kind === 'dating') {
        if (!datingConversationAccess(user, other.user_id)) return { allowed: false };
        const match = db.prepare('SELECT ended_at FROM matches WHERE id = ?').get(dmRow.match_id);
        if (!match || match.ended_at) return { allowed: false };
      }
    }
    return {
      allowed: true,
      mediaType: dmRow.media_type,
      mimeType: dmRow.mime_type,
      fileName: dmRow.file_name,
    };
  }

  // 2) Tentar mensagem de canal (chat_message_media)
  const chRow = db
    .prepare(
      `SELECT cmm.media_type, cmm.mime_type, cmm.file_name, cm.channel_id, c.space_id
       FROM chat_message_media cmm
       JOIN chat_messages cm ON cm.id = cmm.message_id
       JOIN chat_channels c ON c.id = cm.channel_id
       WHERE cmm.url = ? AND cm.deleted_at IS NULL
       LIMIT 1`
    )
    .get(url);
  if (chRow) {
    // Precisa ser membro do canal E do espaço
    const channel = getChannel(db, chRow.channel_id);
    if (!channel) return { allowed: false };
    if (!isChannelMember(db, chRow.channel_id, user.id)) return { allowed: false };
    if (!getSpaceMembership(db, channel.space_id, user.id)) return { allowed: false };
    return {
      allowed: true,
      mediaType: chRow.media_type,
      mimeType: chRow.mime_type,
      fileName: chRow.file_name,
    };
  }

  return { allowed: false };
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

function svgDoc(width, height, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${inner}</svg>`;
}

function linear(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`)
    .join('')}</linearGradient>`;
}

function sceneSunset() {
  return svgDoc(
    1080,
    1080,
    `<defs>${linear('sky', [[0, '#050505'], [0.55, '#242424'], [1, '#FF6A00']])}</defs>
     <rect width="1080" height="1080" fill="url(#sky)"/>
     <circle cx="540" cy="610" r="150" fill="#FF8C00" opacity="0.95"/>
     <path d="M0 790 L250 600 L470 770 L670 640 L890 800 L1080 700 L1080 1080 L0 1080Z" fill="#242424"/>
     <path d="M0 880 L310 760 L570 890 L830 780 L1080 860 L1080 1080 L0 1080Z" fill="#101010"/>`
  );
}

function sceneMountain() {
  return svgDoc(
    1080,
    1080,
    `<defs>${linear('sky', [[0, '#050505'], [0.6, '#242424'], [1, '#A1A1AA']])}
      ${linear('snow', [[0, '#FFFFFF'], [1, '#A1A1AA']])}</defs>
     <rect width="1080" height="1080" fill="url(#sky)"/>
     <circle cx="790" cy="250" r="80" fill="#FFFFFF" opacity="0.85"/>
     <path d="M0 1080 L330 420 L560 760 L720 520 L1080 1080Z" fill="#242424"/>
     <path d="M330 420 L420 570 L350 540 L300 590 L250 540 L210 560Z" fill="url(#snow)"/>
     <path d="M720 520 L790 630 L735 600 L700 640 L660 600 L620 615Z" fill="url(#snow)" opacity="0.9"/>
     <path d="M0 1080 L260 780 L520 920 L780 820 L1080 980 L1080 1080Z" fill="#101010"/>`
  );
}

function sceneOcean() {
  return svgDoc(
    1080,
    1080,
    `<defs>${linear('sea', [[0, '#FF8C00'], [0.42, '#FF6A00'], [1, '#101010']])}</defs>
     <rect width="1080" height="1080" fill="url(#sea)"/>
     <circle cx="540" cy="380" r="110" fill="#FFFFFF" opacity="0.85"/>
     <path d="M0 560 Q180 500 360 560 T720 560 T1080 560 L1080 1080 L0 1080Z" fill="#242424" opacity="0.55"/>
     <path d="M0 680 Q220 600 440 680 T880 680 T1320 680 L1320 1080 L0 1080Z" fill="#101010" opacity="0.75"/>
     <path d="M0 830 Q260 740 520 830 T1040 830 T1560 830 L1560 1080 L0 1080Z" fill="#050505"/>`
  );
}

function sceneForest() {
  return svgDoc(
    1080,
    1080,
    `<defs>${linear('fog', [[0, '#A1A1AA'], [0.45, '#242424'], [1, '#050505']])}</defs>
     <rect width="1080" height="1080" fill="url(#fog)"/>
     <g fill="#101010" opacity="0.9">
       <path d="M180 900 L300 430 L420 900Z"/><path d="M380 900 L520 350 L660 900Z"/>
       <path d="M650 900 L760 470 L870 900Z"/><path d="M810 900 L930 390 L1050 900Z"/>
     </g>
     <g fill="#242424">
       <path d="M120 940 L240 560 L360 940Z"/><path d="M470 940 L600 520 L730 940Z"/>
       <path d="M740 940 L860 600 L980 940Z"/>
     </g>
     <rect y="940" width="1080" height="140" fill="#050505"/>`
  );
}

function sceneCity() {
  return svgDoc(
    1080,
    1080,
    `<defs>${linear('night', [[0, '#050505'], [0.6, '#101010'], [1, '#242424']])}</defs>
     <rect width="1080" height="1080" fill="url(#night)"/>
     <circle cx="820" cy="220" r="90" fill="#FFFFFF" opacity="0.9"/>
     <g fill="#050505">
       <rect x="60" y="560" width="150" height="520"/><rect x="240" y="440" width="130" height="640"/>
       <rect x="400" y="620" width="170" height="460"/><rect x="600" y="380" width="140" height="700"/>
       <rect x="770" y="520" width="120" height="560"/><rect x="910" y="650" width="140" height="430"/>
     </g>
     <g fill="#FF8C00" opacity="0.9">
       <rect x="85" y="600" width="28" height="28"/><rect x="140" y="600" width="28" height="28"/>
       <rect x="265" y="490" width="26" height="26"/><rect x="315" y="490" width="26" height="26"/>
       <rect x="265" y="550" width="26" height="26"/><rect x="430" y="670" width="30" height="30"/>
       <rect x="490" y="670" width="30" height="30"/><rect x="630" y="430" width="28" height="28"/>
       <rect x="680" y="430" width="28" height="28"/><rect x="630" y="500" width="28" height="28"/>
       <rect x="800" y="580" width="26" height="26"/><rect x="850" y="580" width="26" height="26"/>
     </g>`
  );
}

function sceneDesert() {
  return svgDoc(
    1080,
    1080,
    `<defs>${linear('dune', [[0, '#FFFFFF'], [0.5, '#FF8C00'], [1, '#FF4500']])}</defs>
     <rect width="1080" height="1080" fill="url(#dune)"/>
     <circle cx="300" cy="300" r="100" fill="#FFFFFF" opacity="0.9"/>
     <path d="M0 700 Q270 560 540 700 T1080 700 L1080 1080 L0 1080Z" fill="#242424"/>
     <path d="M0 830 Q300 690 620 840 T1200 810 L1200 1080 L0 1080Z" fill="#101010"/>
     <path d="M0 950 Q360 850 720 960 T1320 940 L1320 1080 L0 1080Z" fill="#050505"/>`
  );
}

function sceneAbstract() {
  return svgDoc(
    1080,
    1080,
    `<defs>${linear('art', [[0, '#050505'], [0.5, '#FF6A00'], [1, '#FF8C00']], 0, 0, 1, 1)}</defs>
     <rect width="1080" height="1080" fill="url(#art)"/>
     <circle cx="380" cy="420" r="230" fill="#FFFFFF" opacity="0.16"/>
     <circle cx="720" cy="640" r="300" fill="#050505" opacity="0.2"/>
     <circle cx="700" cy="330" r="120" fill="#FFFFFF" opacity="0.28"/>
     <path d="M0 860 Q270 700 540 860 T1080 860 L1080 1080 L0 1080Z" fill="#050505" opacity="0.35"/>`
  );
}

function sceneCoffee() {
  return svgDoc(
    1080,
    1080,
    `<defs>${linear('table', [[0, '#242424'], [1, '#050505']])}</defs>
     <rect width="1080" height="1080" fill="url(#table)"/>
     <circle cx="540" cy="540" r="330" fill="#FFFFFF"/>
     <circle cx="540" cy="540" r="250" fill="#101010"/>
     <circle cx="540" cy="540" r="190" fill="#050505" opacity="0.55"/>
     <path d="M540 350 C610 430 610 650 540 730 C470 650 470 430 540 350Z" fill="#FF8C00" opacity="0.65"/>
     <circle cx="845" cy="700" r="70" fill="#FFFFFF" opacity="0.9"/>`
  );
}

function sceneWaves() {
  return svgDoc(
    1080,
    1080,
    `<defs>${linear('wave', [[0, '#FF8C00'], [0.5, '#FF6A00'], [1, '#050505']])}</defs>
     <rect width="1080" height="1080" fill="url(#wave)"/>
     <path d="M0 560 C240 440 420 680 660 560 C840 470 960 560 1080 520 L1080 1080 L0 1080Z" fill="#FF4500" opacity="0.65"/>
     <path d="M0 700 C260 580 440 820 700 700 C880 620 980 700 1080 670 L1080 1080 L0 1080Z" fill="#242424" opacity="0.8"/>
     <path d="M0 850 C280 740 500 950 760 850 C920 790 1000 850 1080 830 L1080 1080 L0 1080Z" fill="#101010"/>`
  );
}

function avatarSvg(initials, from, to) {
  return svgDoc(
    400,
    400,
    `<defs>${linear('a', [[0, from], [1, to]], 0, 0, 1, 1)}</defs>
     <rect width="400" height="400" fill="url(#a)"/>
     <circle cx="200" cy="200" r="200" fill="url(#a)"/>
     <text x="200" y="212" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="140" font-weight="700" fill="#FFFFFF" opacity="0.95">${initials}</text>`
  );
}

function storySvg(title, subtitle, from, to) {
  return svgDoc(
    1080,
    1920,
    `<defs>${linear('s', [[0, from], [0.55, to], [1, '#050505']])}
      ${linear('glow', [[0, '#FFFFFF'], [1, '#FFFFFF']])}</defs>
     <rect width="1080" height="1920" fill="url(#s)"/>
     <circle cx="240" cy="380" r="260" fill="#FFFFFF" opacity="0.12"/>
     <circle cx="860" cy="1420" r="340" fill="#FFFFFF" opacity="0.1"/>
     <circle cx="540" cy="900" r="300" fill="url(#glow)" opacity="0.08"/>
     <text x="90" y="980" font-family="Arial, Helvetica, sans-serif" font-size="96" font-weight="700" fill="#FFFFFF">${title}</text>
     <text x="94" y="1070" font-family="Arial, Helvetica, sans-serif" font-size="44" fill="#FFFFFF" opacity="0.8">${subtitle}</text>`
  );
}

function writeSeedImage(filename, content) {
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), content);
}

function seedIfEmpty() {
  if (!SEED_DEMO) return false;
  const existing = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (existing > 0) return false;

  writeSeedImage('seed-sunset.svg', sceneSunset());
  writeSeedImage('seed-mountain.svg', sceneMountain());
  writeSeedImage('seed-ocean.svg', sceneOcean());
  writeSeedImage('seed-forest.svg', sceneForest());
  writeSeedImage('seed-city.svg', sceneCity());
  writeSeedImage('seed-desert.svg', sceneDesert());
  writeSeedImage('seed-abstract.svg', sceneAbstract());
  writeSeedImage('seed-coffee.svg', sceneCoffee());
  writeSeedImage('seed-waves.svg', sceneWaves());

  writeSeedImage('avatar-vibe.svg', avatarSvg('V', '#FF8C00', '#FF4500'));
  writeSeedImage('avatar-ana.svg', avatarSvg('AS', '#FF6A00', '#FF8C00'));
  writeSeedImage('avatar-bruno.svg', avatarSvg('BL', '#242424', '#050505'));
  writeSeedImage('avatar-carla.svg', avatarSvg('CN', '#A1A1AA', '#242424'));
  writeSeedImage('avatar-diego.svg', avatarSvg('DA', '#101010', '#242424'));

  writeSeedImage('story-ana.svg', storySvg('Bom dia', 'luz de domingo', '#FF8C00', '#FF4500'));
  writeSeedImage('story-bruno.svg', storySvg('Na trilha', 'subindo sem pressa', '#242424', '#050505'));
  writeSeedImage('story-carla.svg', storySvg('Estúdio', 'novas camadas hoje', '#FF6A00', '#FF4500'));

  const password = hashPassword(DEMO_PASSWORD);
  const t = now();

  const seedUsers = [
    { username: 'vibra', name: 'Vibra', bio: 'Seu cantinho visual. Compartilhe o que te inspira.', avatar: '/uploads/avatar-vibe.svg', birthDate: '1997-05-14', interests: ['fotografia', 'cafe', 'musica', 'viagens', 'tecnologia'], highlights: [{ id: 'vibra-fotos', label: 'Fotos', icon: 'camera' }, { id: 'vibra-cafe', label: 'Café', icon: 'coffee' }, { id: 'vibra-viagens', label: 'Viagens', icon: 'plane' }, { id: 'vibra-musica', label: 'Música', icon: 'music' }] },
    { username: 'ana.souza', name: 'Ana Souza', bio: 'Fotografia, café e fins de tarde.', avatar: '/uploads/avatar-ana.svg', birthDate: '1996-08-22', interests: ['fotografia', 'cafe', 'arte', 'natureza', 'viagens', 'musica'], highlights: [{ id: 'ana-fotos', label: 'Fotos', icon: 'camera' }, { id: 'ana-arte', label: 'Arte', icon: 'palette' }, { id: 'ana-cafe', label: 'Café', icon: 'coffee' }] },
    { username: 'bruno.dev', name: 'Bruno Lima', bio: 'Código, trilhas e céu aberto.', avatar: '/uploads/avatar-bruno.svg', birthDate: '1994-03-09', interests: ['tecnologia', 'trilhas', 'games', 'musica', 'natureza', 'corrida'], highlights: [{ id: 'bruno-trilhas', label: 'Trilhas', icon: 'plane' }, { id: 'bruno-games', label: 'Games', icon: 'gamepad' }, { id: 'bruno-corrida', label: 'Corrida', icon: 'dumbbell' }] },
    { username: 'carla.arte', name: 'Carla Nunes', bio: 'Ilustração, cor e experimentação.', avatar: '/uploads/avatar-carla.svg', birthDate: '1998-11-02', interests: ['arte', 'design', 'filmes', 'musica', 'livros', 'fotografia'], highlights: [{ id: 'carla-arte', label: 'Arte', icon: 'palette' }, { id: 'carla-filmes', label: 'Filmes', icon: 'crown' }] },
    { username: 'diego.foto', name: 'Diego Alves', bio: 'Luz natural, sempre.', avatar: '/uploads/avatar-diego.svg', birthDate: '1992-01-17', interests: ['fotografia', 'praia', 'viagens', 'cinema', 'musica', 'culinaria'], highlights: [{ id: 'diego-fotos', label: 'Fotos', icon: 'camera' }, { id: 'diego-praia', label: 'Praia', icon: 'plane' }] },
  ];

  const insertUser = db.prepare(
    `INSERT INTO users (username, name, bio, avatar, password_hash, created_at, birth_date, interests, points, highlights)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const userIds = [];
  for (const user of seedUsers) {
    const result = insertUser.run(
      user.username,
      user.name,
      user.bio,
      user.avatar,
      password,
      t - 30 * 24 * 60 * 60 * 1000,
      user.birthDate,
      JSON.stringify(user.interests),
      0,
      JSON.stringify(user.highlights)
    );
    userIds.push(Number(result.lastInsertRowid));
  }

  const followPairs = [
    [0, 1], [0, 2], [0, 3],
    [1, 0], [1, 3],
    [2, 0], [2, 1], [2, 3],
    [3, 0], [3, 1], [3, 4],
    [4, 0], [4, 2],
  ];
  const insertFollow = db.prepare('INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)');
  for (const [follower, following] of followPairs) {
    insertFollow.run(userIds[follower], userIds[following], t - 20 * 24 * 60 * 60 * 1000);
  }

  const postDefs = [
    { user: 1, image: 'seed-sunset.svg', caption: 'Fim de tarde que valeu a semana. #luznatural', minutes: 35, topic: 'fotografia' },
    { user: 2, image: 'seed-mountain.svg', caption: 'Domingo de trilha. O silêncio lá em cima compensa tudo.', minutes: 120, topic: 'natureza' },
    { user: 3, image: 'seed-abstract.svg', caption: 'Estudo de cor #12. Camadas, contraste e um pouco de caos.', minutes: 260, topic: 'arte' },
    { user: 4, image: 'seed-ocean.svg', caption: 'O som do mar como trilha sonora do dia.', minutes: 420, topic: 'natureza' },
    { user: 0, image: 'seed-city.svg', caption: 'Luzes da cidade. A noite tem outra paleta.', minutes: 600, topic: 'fotografia' },
    { user: 1, image: 'seed-desert.svg', caption: 'Texturas que parecem pintura.', minutes: 900, topic: 'viagens' },
    { user: 2, image: 'seed-forest.svg', caption: 'Silêncio na mata.', minutes: 1200, topic: 'natureza' },
    { user: 3, image: 'seed-waves.svg', caption: 'Água, movimento e luz.', minutes: 1500, topic: 'arte' },
    { user: 4, image: 'seed-coffee.svg', caption: 'Pausa obrigatória no meio da tarde.', minutes: 1800, topic: 'gastronomia' },
  ];

  const insertPost = db.prepare(
    'INSERT INTO posts (user_id, image, caption, topic, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const postIds = [];
  for (const post of postDefs) {
    const result = insertPost.run(
      userIds[post.user],
      `/uploads/${post.image}`,
      post.caption,
      post.topic,
      t - post.minutes * 60 * 1000
    );
    postIds.push(Number(result.lastInsertRowid));
  }

  const likeDefs = [
    [1, 2, 0], [0, 2, 3], [0, 1, 4], [0, 1, 2, 3], [1, 3], [0, 2], [0, 1], [0, 2, 4], [0, 1, 3],
  ];
  const insertLike = db.prepare('INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)');
  likeDefs.forEach((users, index) => {
    for (const user of users) {
      insertLike.run(userIds[user], postIds[index], t - (index + 1) * 60 * 1000);
    }
  });

  const commentDefs = [
    [[2, 'Que luz incrível!'], [0, 'Registro perfeito.']],
    [[3, 'Vista linda. Onde foi?'], [1, 'Vale cada passo.']],
    [[0, 'As cores ficaram ótimas.'], [4, 'Preciso ver esse estudo de perto.']],
    [[0, 'Mar cura tudo.'], [1, 'Fotografia impecável.']],
    [[2, 'A cidade rende boas fotos.']],
    [[3, 'Parece outro planeta.']],
    [[0, 'Que paz.']],
    [[1, 'Laranja favorito.']],
    [[0, 'Café sempre.']],
  ];
  const insertComment = db.prepare('INSERT INTO comments (post_id, user_id, text, created_at) VALUES (?, ?, ?, ?)');
  commentDefs.forEach((comments, index) => {
    comments.forEach(([user, text], offset) => {
      insertComment.run(postIds[index], userIds[user], text, t - (index + 1) * 60 * 1000 + offset * 1000);
    });
  });

  const storyDefs = [
    { user: 1, image: 'story-ana.svg', minutes: 60 },
    { user: 2, image: 'story-bruno.svg', minutes: 120 },
    { user: 3, image: 'story-carla.svg', minutes: 180 },
  ];
  const insertStory = db.prepare('INSERT INTO stories (user_id, image, created_at, expires_at) VALUES (?, ?, ?, ?)');
  const storyIds = [];
  for (const story of storyDefs) {
    const created = t - story.minutes * 60 * 1000;
    const result = insertStory.run(userIds[story.user], `/uploads/${story.image}`, created, created + 24 * 60 * 60 * 1000);
    storyIds.push(Number(result.lastInsertRowid));
  }
  db.prepare('INSERT OR IGNORE INTO story_views (story_id, user_id, viewed_at) VALUES (?, ?, ?)').run(
    storyIds[2],
    userIds[0],
    t - 30 * 60 * 1000
  );

  /* --- verificação e perfis de namoro ------------------------------- */
  const insertVerification = db.prepare(
    `INSERT INTO identity_verifications
     (user_id, provider, status, is_simulation, provider_ref, submitted_at, reviewed_at, expires_at)
     VALUES (?, 'dev-simulation', 'approved', 1, ?, ?, ?, ?)`
  );
  for (const userId of userIds) {
    insertVerification.run(
      userId,
      `seed_${userId}`,
      t - 45 * 24 * 60 * 60 * 1000,
      t - 44 * 24 * 60 * 60 * 1000,
      t + 300 * 24 * 60 * 60 * 1000
    );
  }

  const datingDefs = [
    {
      user: 0,
      bio: 'Fotografia, café e conversas que rendem. Procuro alguém para dividir fins de tarde e planos pequenos.',
      photo: 'seed-city.svg',
      interests: ['fotografia', 'cafe', 'musica', 'viagens', 'tecnologia'],
      goals: ['relacionamento', 'interesses', 'hobbies'],
      ageMin: 24,
      ageMax: 38,
      distance: 50,
    },
    {
      user: 1,
      bio: 'Fotógrafa por escolha, curiosa por natureza. Meu programa favorito é perder a hora conversando.',
      photo: 'seed-sunset.svg',
      interests: ['fotografia', 'cafe', 'arte', 'natureza', 'viagens', 'musica'],
      goals: ['relacionamento', 'interesses'],
      ageMin: 26,
      ageMax: 38,
      distance: 50,
    },
    {
      user: 2,
      bio: 'Desenvolvedor, trilhas no fim de semana e um café forte antes de qualquer coisa.',
      photo: 'seed-mountain.svg',
      interests: ['tecnologia', 'trilhas', 'games', 'musica', 'natureza', 'corrida'],
      goals: ['amizade', 'hobbies', 'interesses'],
      ageMin: 27,
      ageMax: 38,
      distance: 50,
    },
    {
      user: 3,
      bio: 'Ilustradora. Vivo entre tintas, séries e playlists. Busco alguém com humor e curiosidade.',
      photo: 'seed-abstract.svg',
      interests: ['arte', 'design', 'filmes', 'musica', 'livros', 'fotografia'],
      goals: ['paquera', 'relacionamento', 'interesses'],
      ageMin: 24,
      ageMax: 35,
      distance: 50,
    },
    {
      user: 4,
      bio: 'Fotógrafo de luz natural. Gosto de estrada, mar e domingo sem relógio.',
      photo: 'seed-ocean.svg',
      interests: ['fotografia', 'praia', 'viagens', 'cinema', 'musica', 'culinaria'],
      goals: ['relacionamento', 'interesses'],
      ageMin: 28,
      ageMax: 42,
      distance: 100,
    },
  ];

  const insertDating = db.prepare(
    `INSERT INTO dating_profiles
     (user_id, bio, photos, interests, goals, age_min, age_max, distance_km, active, paused, radar_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 1, ?, ?)`
  );
  for (const profile of datingDefs) {
    insertDating.run(
      userIds[profile.user],
      profile.bio,
      JSON.stringify([`/uploads/${profile.photo}`]),
      JSON.stringify(profile.interests),
      JSON.stringify(profile.goals),
      profile.ageMin,
      profile.ageMax,
      profile.distance,
      t - 20 * 24 * 60 * 60 * 1000,
      t - 2 * 24 * 60 * 60 * 1000
    );
  }

  const answerDefs = [
    {
      user: 0,
      values: {
        q_objetivos: ['relacionamento', 'interesses', 'hobbies'],
        q_interesses: ['fotografia', 'cafe', 'musica', 'viagens', 'tecnologia'],
        q_fim_de_semana: 'cultura',
        q_conversa: 4,
        q_planejamento: 4,
        q_grupos: 'intimo',
        q_pessoas_novas: 4,
        q_rotina: 'equilibrada',
        q_atividade: 'leve',
        q_viagem: 'cidade',
      },
    },
    {
      user: 1,
      values: {
        q_objetivos: ['relacionamento', 'interesses'],
        q_interesses: ['fotografia', 'cafe', 'arte', 'natureza', 'viagens', 'musica'],
        q_fim_de_semana: 'cultura',
        q_conversa: 5,
        q_planejamento: 4,
        q_grupos: 'intimo',
        q_pessoas_novas: 4,
        q_rotina: 'calma',
        q_atividade: 'leve',
        q_viagem: 'cidade',
      },
    },
    {
      user: 2,
      values: {
        q_objetivos: ['amizade', 'hobbies', 'interesses'],
        q_interesses: ['tecnologia', 'trilhas', 'games', 'musica', 'natureza', 'corrida'],
        q_fim_de_semana: 'natureza',
        q_conversa: 3,
        q_planejamento: 5,
        q_grupos: 'medio',
        q_pessoas_novas: 3,
        q_rotina: 'equilibrada',
        q_atividade: 'frequente',
        q_viagem: 'natureza',
      },
    },
    {
      user: 3,
      values: {
        q_objetivos: ['paquera', 'relacionamento', 'interesses'],
        q_interesses: ['arte', 'design', 'filmes', 'musica', 'livros', 'fotografia'],
        q_fim_de_semana: 'cultura',
        q_conversa: 5,
        q_planejamento: 3,
        q_grupos: 'intimo',
        q_pessoas_novas: 4,
        q_rotina: 'agitada',
        q_atividade: 'frequente',
        q_viagem: 'cidade',
      },
    },
    {
      user: 4,
      values: {
        q_objetivos: ['relacionamento', 'interesses'],
        q_interesses: ['fotografia', 'praia', 'viagens', 'cinema', 'musica', 'culinaria'],
        q_fim_de_semana: 'natureza',
        q_conversa: 4,
        q_planejamento: 2,
        q_grupos: 'medio',
        q_pessoas_novas: 4,
        q_rotina: 'calma',
        q_atividade: 'leve',
        q_viagem: 'praia',
      },
    },
  ];
  const insertAnswer = db.prepare(
    'INSERT INTO compatibility_answers (user_id, question_id, answer, updated_at) VALUES (?, ?, ?, ?)'
  );
  for (const entry of answerDefs) {
    for (const [questionId, value] of Object.entries(entry.values)) {
      insertAnswer.run(userIds[entry.user], questionId, JSON.stringify(value), t - 2 * 24 * 60 * 60 * 1000);
    }
  }

  const insertDatingLike = db.prepare(
    'INSERT INTO dating_likes (from_user_id, to_user_id, action, created_at) VALUES (?, ?, ?, ?)'
  );
  insertDatingLike.run(userIds[1], userIds[0], 'like', t - 2 * 24 * 60 * 60 * 1000);
  insertDatingLike.run(userIds[0], userIds[1], 'like', t - 36 * 60 * 60 * 1000);

  const sorted = [userIds[0], userIds[1]].sort((a, b) => a - b);
  const matchResult = db
    .prepare('INSERT INTO matches (user_a, user_b, created_at) VALUES (?, ?, ?)')
    .run(sorted[0], sorted[1], t - 36 * 60 * 60 * 1000);
  const matchId = Number(matchResult.lastInsertRowid);
  const dateConversation = db
    .prepare("INSERT INTO conversations (kind, match_id, created_at, updated_at) VALUES ('dating', ?, ?, ?)")
    .run(matchId, t - 36 * 60 * 60 * 1000, t - 3 * 60 * 60 * 1000);
  const dateConversationId = Number(dateConversation.lastInsertRowid);
  const insertMember = db.prepare(
    'INSERT INTO conversation_members (conversation_id, user_id, last_read_at, created_at) VALUES (?, ?, ?, ?)'
  );
  insertMember.run(dateConversationId, userIds[0], t - 4 * 60 * 60 * 1000, t - 36 * 60 * 60 * 1000);
  insertMember.run(dateConversationId, userIds[1], t - 2 * 60 * 60 * 1000, t - 36 * 60 * 60 * 1000);
  const insertMessage = db.prepare(
    'INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)'
  );
  insertMessage.run(dateConversationId, userIds[1], 'Adorei seu perfil. Esse café ainda rende uma boa conversa?', t - 24 * 60 * 60 * 1000);
  insertMessage.run(dateConversationId, userIds[0], 'Rende sim. E o próximo fim de tarde combina com uma câmera na mão.', t - 20 * 60 * 60 * 1000);
  insertMessage.run(dateConversationId, userIds[1], 'Fechado. Me conta qual lugar você escolheria primeiro.', t - 3 * 60 * 60 * 1000);
  db.prepare('INSERT INTO location_consents (match_id, user_id, enabled, updated_at) VALUES (?, ?, 1, ?)').run(
    matchId,
    userIds[0],
    t - 30 * 60 * 60 * 1000
  );
  db.prepare('INSERT INTO location_consents (match_id, user_id, enabled, updated_at) VALUES (?, ?, 1, ?)').run(
    matchId,
    userIds[1],
    t - 30 * 60 * 60 * 1000
  );

  const insertLocation = db.prepare(
    'INSERT INTO location_snapshots (user_id, lat, lng, accuracy, updated_at) VALUES (?, ?, ?, ?, ?)'
  );
  insertLocation.run(userIds[0], -23.5505, -46.6333, 35, t - 8 * 60 * 1000);
  insertLocation.run(userIds[1], -23.565, -46.642, 45, t - 12 * 60 * 1000);
  insertLocation.run(userIds[2], -23.6, -46.7, 60, t - 20 * 60 * 1000);
  insertLocation.run(userIds[3], -23.58, -46.68, 50, t - 25 * 60 * 1000);
  insertLocation.run(userIds[4], -23.15, -46.63, 80, t - 40 * 60 * 1000);

  const insertRadarPrefs = db.prepare(
    'INSERT INTO radar_prefs (user_id, alerts_enabled, threshold_m, updated_at) VALUES (?, ?, ?, ?)'
  );
  insertRadarPrefs.run(userIds[0], 1, 5000, t - 2 * 24 * 60 * 60 * 1000);
  insertRadarPrefs.run(userIds[1], 0, 1000, t - 2 * 24 * 60 * 60 * 1000);

  /* --- conversa social de exemplo ---------------------------------- */
  const socialConversation = db
    .prepare("INSERT INTO conversations (kind, created_at, updated_at) VALUES ('social', ?, ?)")
    .run(t - 5 * 60 * 60 * 1000, t - 25 * 60 * 1000);
  const socialId = Number(socialConversation.lastInsertRowid);
  insertMember.run(socialId, userIds[0], t - 45 * 60 * 1000, t - 5 * 60 * 60 * 1000);
  insertMember.run(socialId, userIds[2], t - 30 * 60 * 1000, t - 5 * 60 * 60 * 1000);
  insertMessage.run(socialId, userIds[2], 'Ei! Vi que você curtiu a foto da trilha. Já conhece aquele caminho?', t - 2 * 60 * 60 * 1000);
  insertMessage.run(socialId, userIds[0], 'Ainda não. Me manda o nome quando puder.', t - 70 * 60 * 1000);
  insertMessage.run(socialId, userIds[2], 'Vou mandar. Vale ir cedo, antes do sol apertar.', t - 25 * 60 * 1000);

  const insertNotification = db.prepare(
    'INSERT INTO notifications (user_id, kind, text, link, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  insertNotification.run(
    userIds[0],
    'message',
    'Bruno Lima enviou uma mensagem.',
    `/mensagens?conversa=${socialId}`,
    t - 25 * 60 * 1000
  );
  insertNotification.run(
    userIds[0],
    'match',
    'Você e Ana Souza deram match. A conversa está aberta.',
    `/mensagens?conversa=${dateConversationId}`,
    t - 36 * 60 * 60 * 1000
  );
  insertNotification.run(
    userIds[0],
    'verification',
    'Sua verificação de identidade está aprovada (simulação local).',
    null,
    t - 44 * 24 * 60 * 60 * 1000
  );

  console.log('Dados de demonstração criados (ambiente não produtivo).');
  return true;
}

const seededDemo = seedIfEmpty();
try { cleanupRetention(); } catch (e) { console.warn('cleanupRetention skipped:', e.message); }
cleanupStagingDirectory(true);

if (SEED_ONLY) {
  console.log(seededDemo ? 'Seed de demonstração concluído.' : 'Banco já contém usuários; nada foi alterado.');
  db.close();
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    securityHeaders(res);
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const url = new URL(req.url, 'http://localhost');

    if (pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && pathname !== '/api/webhooks/identity') {
        assertSameOrigin(req);
      }
      await handleApi(req, res, pathname, url);
      return;
    }

    if (pathname.startsWith('/uploads/')) {
      const file = resolveInside(UPLOAD_DIR, pathname.slice('/uploads/'.length));
      if (!file) return json(res, 403, { error: 'Acesso negado.' });
      const url = `/uploads/${path.basename(file)}`;
      const isMessageAttachment = path.basename(file).startsWith('message-');
      if (isMessageAttachment) {
        const access = getMessageUploadAccess(req, url);
        if (!access.allowed) {
          return json(res, 404, { error: 'Arquivo não encontrado.' });
        }
        const isFile = access.mediaType === 'file';
        const safeFileName = sanitizeMessageFileName(access.fileName || path.basename(file));
        return serveFile(res, file, 'private, no-store', {
          contentType: access.mimeType || 'application/octet-stream',
          contentDisposition: isFile
            ? `attachment; filename="${safeFileName.replace(/"/g, '')}"`
            : undefined,
        });
      }
      return serveFile(res, file, 'public, max-age=31536000, immutable');
    }

    return json(res, 404, { error: 'Rota não encontrada.' });
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    if (error instanceof HttpError) {
      return json(res, error.status, {
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
        ...(error.details ? { details: error.details } : {}),
      });
    }
    console.error(error);
    return json(res, 500, { error: 'Erro interno do servidor.' });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${PORT} já está em uso. Rode com outra porta: set PORT=8080 && npm start`);
    process.exit(1);
  }
  throw error;
});

/* Attach WebSocket to HTTP server (after server is created) */
wsHub.attach(server, (token) => {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM users WHERE id = (SELECT user_id FROM sessions WHERE token = ? AND created_at > ?)').get(token, Date.now() - SESSION_TTL);
  return row || null;
});

/* Start ping interval for WebSocket connections */
wsHub.startPingInterval(30000);

server.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' || HOST === '::' ? '127.0.0.1' : HOST;
  const urlHost = displayHost.includes(':') ? `[${displayHost}]` : displayHost;
  console.log('');
  console.log(`  ${APP.name} - rede social local`);
  console.log(`  http://${urlHost}:${PORT}`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1') {
    console.log(`  Escutando em ${HOST}:${PORT}`);
  }
  console.log('');
  console.log(`  Dados de demonstração: ${SEED_DEMO ? 'habilitados' : 'desabilitados'}`);
  console.log(
    `  Verificação de identidade: ${
      IDENTITY_MODE === 'dev'
        ? 'simulação de desenvolvimento'
        : IDENTITY_MODE === 'webhook'
          ? 'webhook'
          : 'desabilitada'
    }`
  );
  if (COOKIE_SECURE) console.log('  Cookies de sessão: Secure');
  console.log('');
});

function shutdown() {
  sseHub.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  /* Streams SSE podem manter `server.close()` pendente. Fecha após o limite. */
  setTimeout(() => {
    db.close();
    process.exit(0);
  }, 2_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
