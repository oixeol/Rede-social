'use strict';

/**
 * Rotas de espaços, canais e paginação de mensagens.
 *
 * A API Node.js continua sendo a autoridade de autorização. Este módulo
 * consulta memberships a cada rota e devolve `null` quando o caminho não
 * pertence ao chat, permitindo que o roteador principal siga adiante.
 */

/* ---------------------------------------------------------------- */
/* Helpers de slug e validação                                      */
/* ---------------------------------------------------------------- */

function slugify(value) {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'espaco';
}

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

function parsePositiveId(value, label = 'ID') {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

function parseLimit(limitParam, def = 50, maxLimit = 100) {
  if (limitParam === null) return def;
  const raw = String(limitParam).trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > maxLimit) return null;
  return n;
}

function isPlainObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function memberDTO(row) {
  return {
    userId: row.user_id,
    username: row.username,
    name: row.name,
    avatar: row.avatar || null,
    role: row.role,
    joinedAt: row.created_at,
  };
}

function spaceDTO(row, memberCount, role, onlineCount = 0) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    avatar: row.avatar || null,
    ownerId: row.created_by,
    memberCount,
    onlineCount,
    role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function channelDTO(row, lastReadAt = 0, lastMessage = null, unreadCount = 0) {
  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    slug: row.slug,
    topic: row.topic || '',
    visibility: row.visibility,
    type: row.type || 'text',
    position: row.position,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastReadAt: lastReadAt || 0,
    lastMessage,
    unreadCount: unreadCount || 0,
  };
}

function senderDTO(row) {
  return {
    id: row.sender_id,
    username: row.sender_username,
    name: row.sender_name,
    avatar: row.sender_avatar || null,
    verified: !!row.sender_verified,
  };
}

function mediaDTO(row) {
  return {
    url: row.url,
    mediaType: row.media_type,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes || 0),
    fileName: row.file_name,
  };
}

function channelMessageDTO(row, media, meId) {
  return {
    id: row.id,
    channelId: row.channel_id,
    senderId: row.sender_id,
    body: row.body || '',
    sharedPostId: row.shared_post_id || null,
    media,
    createdAt: row.created_at,
    editedAt: row.edited_at || null,
    deletedAt: row.deleted_at || null,
    sender: senderDTO(row),
    mine: row.sender_id === meId,
  };
}

function dmMessageDTO(row, media, sharedPost, meId) {
  return {
    id: row.id,
    body: row.body || '',
    sharedPostId: row.shared_post_id || null,
    sharedPost: sharedPost || null,
    media,
    createdAt: row.created_at,
    editedAt: row.edited_at || null,
    deletedAt: row.deleted_at || null,
    mine: row.sender_id === meId,
    sender: senderDTO(row),
  };
}

function getSpaceMembership(db, spaceId, userId) {
  return db
    .prepare('SELECT role FROM chat_space_members WHERE space_id = ? AND user_id = ?')
    .get(spaceId, userId);
}

function getSpace(db, spaceId, userId) {
  return db
    .prepare(
      `SELECT s.*, sm.role
       FROM chat_spaces s
       JOIN chat_space_members sm ON sm.space_id = s.id AND sm.user_id = ?
       WHERE s.id = ?`
    )
    .get(userId, spaceId);
}

function getChannel(db, channelId) {
  return db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(channelId);
}

function isChannelMember(db, channelId, userId) {
  return !!db
    .prepare('SELECT 1 AS ok FROM chat_channel_members WHERE channel_id = ? AND user_id = ?')
    .get(channelId, userId);
}

function accessibleChannel(db, channelId, userId) {
  const channel = getChannel(db, channelId);
  if (!channel) return null;
  if (!isChannelMember(db, channelId, userId)) return null;
  if (!getSpaceMembership(db, channel.space_id, userId)) return null;
  return channel;
}

function canManageChannel(db, channel, userId) {
  const membership = getSpaceMembership(db, channel.space_id, userId);
  if (!membership) return false;
  return channel.created_by === userId || membership.role === 'owner' || membership.role === 'moderator';
}

function uniqueSpaceSlug(db, baseSlug) {
  let slug = baseSlug;
  let suffix = 2;
  while (db.prepare('SELECT 1 AS ok FROM chat_spaces WHERE slug = ?').get(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function uniqueChannelSlug(db, spaceId, baseSlug) {
  let slug = baseSlug;
  let suffix = 2;
  while (
    db
      .prepare('SELECT 1 AS ok FROM chat_channels WHERE space_id = ? AND slug = ?')
      .get(spaceId, slug)
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

/* ---------------------------------------------------------------- */
/* Roteador principal                                               */
/* ---------------------------------------------------------------- */

async function handleChatRoutes({ req, res, pathname, url, me, ctx }) {
  const {
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
  } = ctx;
  const method = req.method;

  /* ---------- SSE autenticado ---------- */
  if (method === 'GET' && pathname === '/api/events') {
    const sessionToken = cookieValue(req, 'vibra_session');
    sseHub.subscribe(req, res, me.id, sessionToken);
    return { handled: true };
  }

  /* ---------- helpers comuns ---------- */
  function badRequest(msg) {
    return { status: 400, body: { error: msg } };
  }
  function notFound(msg = 'Não encontrado.') {
    return { status: 404, body: { error: msg } };
  }
  function forbidden(msg) {
    return { status: 403, body: { error: msg } };
  }

  /* ---------- espaços ---------- */
  if (method === 'GET' && pathname === '/api/spaces') {
    const rows = db
      .prepare(
        `SELECT s.*, sm.role,
               (SELECT COUNT(*) FROM chat_space_members csm WHERE csm.space_id = s.id) AS member_count,
               (SELECT COUNT(*) FROM chat_space_members csm WHERE csm.space_id = s.id AND csm.presence = 'online') AS online_count
         FROM chat_spaces s
         JOIN chat_space_members sm ON sm.space_id = s.id AND sm.user_id = ?
         ORDER BY s.updated_at DESC, s.id DESC`
      )
      .all(me.id);
    const spaces = rows.map((row) => spaceDTO(row, row.member_count, row.role, row.online_count));
    return { status: 200, body: { spaces } };
  }

  /* ---- /api/spaces/notifications (GET) - notificações de menções em servidores ---- */
  if (method === 'GET' && pathname === '/api/spaces/notifications') {
    const rows = db
      .prepare(
        `SELECT id, kind, text, link, created_at, read_at FROM notifications
         WHERE user_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 50`
      )
      .all(me.id, 'server_mention');
    const unread = db
      .prepare(
        'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND kind = ? AND read_at IS NULL'
      )
      .get(me.id, 'server_mention').n;
    return json(res, 200, {
      notifications: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        text: row.text,
        link: row.link,
        createdAt: row.created_at,
        read: !!row.read_at,
      })),
      unread,
    });
  }

  if (method === 'POST' && pathname === '/api/spaces/notifications/read') {
    db.prepare(
      'UPDATE notifications SET read_at = ? WHERE user_id = ? AND kind = ? AND read_at IS NULL'
    ).run(now(), me.id, 'server_mention');
    return json(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/spaces') {
    rateLimit(req, 'space-create', 10, 60 * 1000);
    const body = await readBody(req);
    if (!isPlainObject(body)) return badRequest('Corpo inválido.');
    const name = cleanText(body.name, 'Nome', { min: 2, max: 80, required: true, strict: true });
    const description = cleanText(body.description || '', 'Descrição', { max: 500, multiline: true });
    const slug = uniqueSpaceSlug(db, slugify(name));
    const timestamp = now();
    const space = withTransaction(() => {
      const result = db
        .prepare(
          `INSERT INTO chat_spaces (name, slug, description, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(name, slug, description, me.id, timestamp, timestamp);
      const spaceId = Number(result.lastInsertRowid);
      db.prepare(
        'INSERT INTO chat_space_members (space_id, user_id, role, created_at) VALUES (?, ?, ?, ?)'
      ).run(spaceId, me.id, 'owner', timestamp);
      return db.prepare('SELECT * FROM chat_spaces WHERE id = ?').get(spaceId);
    });
    return { status: 201, body: { space: spaceDTO(space, 1, 'owner', 1) } };
  }

  /* ---- /api/spaces/:id/invite (POST) - gerar código de convite ---- */
  const spaceInviteMatch = matchRoute(pathname, '/api/spaces/:id/invite');
  if (spaceInviteMatch && method === 'POST') {
    const spaceId = parsePositiveId(spaceInviteMatch.id);
    if (!spaceId) return badRequest('ID de espaço inválido.');
    const space = getSpace(db, spaceId, me.id);
    if (!space) return notFound('Espaço não encontrado.');
    const canManage = space.role === 'owner' || space.role === 'moderator';
    if (!canManage) return forbidden('Apenas o dono ou moderadores podem gerar convites.');
    rateLimit(req, 'space-create-invite', 20, 60 * 1000);

    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1 para evitar confusão
    let code = '';
    let attempts = 0;
    const maxAttempts = 10;
    const nowMs = now();
    const expiresAt = nowMs + 60 * 60 * 1000; // 1 hora

    // Gerar código único que não exista ativo (não expirado e não usado)
    while (attempts < maxAttempts) {
      code = '';
      for (let i = 0; i < 5; i++) {
        code += charset[Math.floor(Math.random() * charset.length)];
      }
      const existing = db
        .prepare('SELECT 1 FROM space_invites WHERE code = ? AND (expires_at > ? OR used_at IS NOT NULL)')
        .get(code, nowMs);
      if (!existing) break;
      attempts++;
    }
    if (attempts >= maxAttempts) {
      return { status: 500, body: { error: 'Não foi possível gerar código único. Tente novamente.' } };
    }

    const invite = withTransaction(() => {
      db.prepare(
        `INSERT INTO space_invites (code, space_id, created_by, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(code, spaceId, me.id, expiresAt, nowMs);
      return db.prepare('SELECT * FROM space_invites WHERE code = ?').get(code);
    });

    // Limpar convites expirados há mais de 1h (tornam códigos reutilizáveis)
    db.prepare('DELETE FROM space_invites WHERE expires_at < ?').run(nowMs - 60 * 60 * 1000);

    return {
      status: 201,
      body: {
        invite: {
          code: invite.code,
          spaceId: invite.space_id,
          expiresAt: invite.expires_at,
          createdAt: invite.created_at,
        },
      },
    };
  }

  /* ---- /api/spaces/join (POST) - entrar com código de convite ---- */
  if (method === 'POST' && pathname === '/api/spaces/join') {
    rateLimit(req, 'space-join', 30, 60 * 1000);
    const body = await readBody(req);
    if (!isPlainObject(body)) return badRequest('Corpo inválido.');
    const code = String(body.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) {
      return badRequest('Código de convite inválido. Use 5 caracteres alfanuméricos.');
    }

    const nowMs = now();
    const invite = db
      .prepare(
        `SELECT si.*, cs.name AS space_name
         FROM space_invites si
         JOIN chat_spaces cs ON cs.id = si.space_id
         WHERE si.code = ? AND si.expires_at > ? AND si.used_at IS NULL`
      )
      .get(code, nowMs);

    if (!invite) {
      return { status: 404, body: { error: 'Código de convite inválido ou expirado.' } };
    }

    const spaceId = invite.space_id;

    // Verificar se já é membro
    const existingMember = db
      .prepare('SELECT 1 FROM chat_space_members WHERE space_id = ? AND user_id = ?')
      .get(spaceId, me.id);
    if (existingMember) {
      return { status: 200, body: { spaceId, alreadyMember: true } };
    }

    // Adicionar como membro
    withTransaction(() => {
      db.prepare(
        'INSERT INTO chat_space_members (space_id, user_id, role, created_at) VALUES (?, ?, ?, ?)'
      ).run(spaceId, me.id, 'member', nowMs);

      // Adicionar aos canais públicos de texto
      const publicChannels = db
        .prepare("SELECT id FROM chat_channels WHERE space_id = ? AND visibility = 'public' AND type = 'text'")
        .all(spaceId);
      for (const channel of publicChannels) {
        db.prepare(
          `INSERT OR IGNORE INTO chat_channel_members
           (channel_id, user_id, last_read_at, created_at) VALUES (?, ?, 0, ?)`
        ).run(channel.id, me.id, nowMs);
      }

      // Marcar convite como usado
      db.prepare('UPDATE space_invites SET used_at = ? WHERE id = ?').run(nowMs, invite.id);
    });

    return { status: 200, body: { spaceId, alreadyMember: false } };
  }

  /* ---- /api/spaces/:id/members (GET/POST) ---- */
  const spaceMembersMatch = matchRoute(pathname, '/api/spaces/:id/members');
  if (spaceMembersMatch) {
    const spaceId = parsePositiveId(spaceMembersMatch.id);
    if (!spaceId) return badRequest('ID de espaço inválido.');
    const space = getSpace(db, spaceId, me.id);
    if (!space) return notFound('Espaço não encontrado.');
    const canManage = space.role === 'owner' || space.role === 'moderator';

    if (method === 'GET') {
      const members = db
        .prepare(
          `SELECT u.*, sm.role, sm.created_at
           FROM chat_space_members sm
           JOIN users u ON u.id = sm.user_id
           WHERE sm.space_id = ?
           ORDER BY sm.created_at ASC, sm.user_id ASC`
        )
        .all(spaceId);
      return { status: 200, body: { members: members.map(memberDTO) } };
    }

    if (method === 'POST') {
      if (!canManage) return forbidden('Apenas o dono ou moderadores podem adicionar membros.');
      rateLimit(req, 'space-add-member', 30, 60 * 1000);
      const body = await readBody(req);
      if (!isPlainObject(body)) return badRequest('Corpo inválido.');
      const username = cleanText(body.username, 'Usuário', { min: 1, max: 40, required: true }).toLowerCase();
      const target = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!target) return notFound('Usuário não encontrado.');
      const existing = db
        .prepare('SELECT * FROM chat_space_members WHERE space_id = ? AND user_id = ?')
        .get(spaceId, target.id);
      if (existing) {
        return { status: 200, body: { member: { userId: target.id, role: existing.role } } };
      }
      const timestamp = now();
      withTransaction(() => {
        db.prepare(
          'INSERT INTO chat_space_members (space_id, user_id, role, created_at) VALUES (?, ?, ?, ?)'
        ).run(spaceId, target.id, 'member', timestamp);
        const publicChannels = db
          .prepare("SELECT id FROM chat_channels WHERE space_id = ? AND visibility = 'public'")
          .all(spaceId);
        for (const channel of publicChannels) {
          db.prepare(
            `INSERT OR IGNORE INTO chat_channel_members
             (channel_id, user_id, last_read_at, created_at) VALUES (?, ?, 0, ?)`
          ).run(channel.id, target.id, timestamp);
        }
      });
      return { status: 201, body: { member: { userId: target.id, role: 'member' } } };
    }
  }

  /* ---- /api/spaces/:id/channels (POST) ---- */
  const spaceChannelsMatch = matchRoute(pathname, '/api/spaces/:id/channels');
  if (spaceChannelsMatch && method === 'POST') {
    const spaceId = parsePositiveId(spaceChannelsMatch.id);
    if (!spaceId) return badRequest('ID de espaço inválido.');
    const space = getSpace(db, spaceId, me.id);
    if (!space) return notFound('Espaço não encontrado.');
    const canManage = space.role === 'owner' || space.role === 'moderator';
    if (!canManage) return forbidden('Apenas o dono ou moderadores podem criar canais.');
    rateLimit(req, 'channel-create', 20, 60 * 1000);
    const body = await readBody(req);
    if (!isPlainObject(body)) return badRequest('Corpo inválido.');
    const name = cleanText(body.name, 'Nome', { min: 1, max: 60, required: true, strict: true });
    const topic = cleanText(body.topic || '', 'Tópico', { max: 200, multiline: true });
    const visibility = body.visibility === 'private' ? 'private' : body.visibility === 'public' ? 'public' : 'public';
    if (body.visibility !== undefined && body.visibility !== 'private' && body.visibility !== 'public') {
      return badRequest('Visibilidade deve ser "public" ou "private".');
    }
    const type = body.type === 'voice' ? 'voice' : 'text';
    if (body.type !== undefined && body.type !== 'text' && body.type !== 'voice') {
      return badRequest('Tipo deve ser "text" ou "voice".');
    }
    const slug = uniqueChannelSlug(db, spaceId, slugify(name));
    const timestamp = now();
    const channel = withTransaction(() => {
      const position = Number(
        db.prepare('SELECT MAX(position) AS p FROM chat_channels WHERE space_id = ?').get(spaceId).p || -1
      ) + 1;
      const result = db
        .prepare(
          `INSERT INTO chat_channels
           (space_id, name, slug, topic, visibility, type, position, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(spaceId, name, slug, topic, visibility, type, position, me.id, timestamp, timestamp);
      const channelId = Number(result.lastInsertRowid);
      if (visibility === 'public' && type === 'text') {
        const members = db
          .prepare('SELECT user_id FROM chat_space_members WHERE space_id = ?')
          .all(spaceId);
        for (const member of members) {
          db.prepare(
            `INSERT OR IGNORE INTO chat_channel_members
             (channel_id, user_id, last_read_at, created_at) VALUES (?, ?, 0, ?)`
          ).run(channelId, member.user_id, timestamp);
        }
      } else if (type === 'text') {
        db.prepare(
          `INSERT INTO chat_channel_members
           (channel_id, user_id, last_read_at, created_at) VALUES (?, ?, 0, ?)`
        ).run(channelId, me.id, timestamp);
      }
      return db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(channelId);
    });
    const recipientIds = db
      .prepare('SELECT user_id FROM chat_channel_members WHERE channel_id = ?')
      .all(channel.id)
      .map((row) => row.user_id);
    sseHub.publish(
      recipientIds,
      'channel.created',
      { scope: 'space', spaceId, channel: channelDTO(channel) },
      (client) => accessibleChannel(db, channel.id, client.userId) !== null,
    );
    return { status: 201, body: { channel: channelDTO(channel) } };
  }

  /* ---- /api/spaces/:id (GET/PATCH/DELETE) ---- */
  const spaceMatch = matchRoute(pathname, '/api/spaces/:id');
  if (spaceMatch) {
    const spaceId = parsePositiveId(spaceMatch.id);
    if (!spaceId) return badRequest('ID de espaço inválido.');
    const space = getSpace(db, spaceId, me.id);
    if (!space) return notFound('Espaço não encontrado.');
    const isOwner = space.role === 'owner';
    const canManage = isOwner || space.role === 'moderator';

    if (method === 'GET') {
      const memberRows = db
        .prepare(
          `SELECT u.*, sm.role, sm.created_at
           FROM chat_space_members sm
           JOIN users u ON u.id = sm.user_id
           WHERE sm.space_id = ?
           ORDER BY sm.created_at ASC, sm.user_id ASC`
        )
        .all(spaceId);
      const channelRows = db
        .prepare(
          `SELECT c.*, ccm.last_read_at
           FROM chat_channels c
           JOIN chat_channel_members ccm ON ccm.channel_id = c.id AND ccm.user_id = ?
           WHERE c.space_id = ?
           ORDER BY c.position ASC, c.id ASC`
        )
        .all(me.id, spaceId);
      const channels = channelRows.map((channel) => {
        const last = db
          .prepare(
            `SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar,
                    CASE WHEN EXISTS (
                      SELECT 1 FROM identity_verifications iv
                      WHERE iv.user_id = u.id AND iv.status = 'approved'
                    ) THEN 1 ELSE 0 END AS sender_verified
             FROM chat_messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.channel_id = ? AND m.deleted_at IS NULL
             ORDER BY m.id DESC LIMIT 1`
          )
          .get(channel.id);
        const lastMessage = last
          ? {
              id: last.id,
              body: last.body || '',
              senderId: last.sender_id,
              createdAt: last.created_at,
            }
          : null;
        const unreadCount = db
          .prepare(
            `SELECT COUNT(*) AS n FROM chat_messages
             WHERE channel_id = ? AND sender_id != ? AND deleted_at IS NULL AND created_at > ?`
          )
          .get(channel.id, me.id, channel.last_read_at || 0).n;
        return channelDTO(channel, channel.last_read_at, lastMessage, unreadCount);
      });
      const onlineCount = memberRows.filter((m) => m.presence === 'online').length;
      return {
        status: 200,
        body: {
          space: spaceDTO(space, memberRows.length, space.role, onlineCount),
          channels,
          members: memberRows.map(memberDTO),
        },
      };
    }

    if (method === 'PATCH') {
      if (!canManage) return forbidden('Apenas o dono ou moderadores podem editar o espaço.');
      rateLimit(req, 'space-update', 20, 60 * 1000);
      const body = await readBody(req);
      if (!isPlainObject(body)) return badRequest('Corpo inválido.');
      const updates = [];
      const params = [];
      if (body.name !== undefined) {
        const name = cleanText(body.name, 'Nome', { min: 2, max: 80, required: true, strict: true });
        updates.push('name = ?');
        params.push(name);
      }
      if (body.description !== undefined) {
        const description = cleanText(body.description || '', 'Descrição', { max: 500, multiline: true });
        updates.push('description = ?');
        params.push(description);
      }
      if (updates.length === 0) return badRequest('Nenhum campo para atualizar.');
      updates.push('updated_at = ?');
      params.push(now());
      params.push(spaceId);
      db.prepare(`UPDATE chat_spaces SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      const updated = db.prepare('SELECT * FROM chat_spaces WHERE id = ?').get(spaceId);
      const memberCount = db
        .prepare('SELECT COUNT(*) AS n FROM chat_space_members WHERE space_id = ?')
        .get(spaceId).n;
      const onlineCount = db
        .prepare('SELECT COUNT(*) AS n FROM chat_space_members WHERE space_id = ? AND presence = \'online\'')
        .get(spaceId).n;
      return { status: 200, body: { space: spaceDTO(updated, memberCount, space.role, onlineCount) } };
    }

    if (method === 'DELETE') {
      if (!isOwner) return forbidden('Apenas o dono pode excluir o espaço.');
      rateLimit(req, 'space-delete', 5, 60 * 1000);
      db.prepare('DELETE FROM chat_spaces WHERE id = ?').run(spaceId);
      return { status: 200, body: { ok: true } };
    }
  }

  /* ---------- canais ---------- */
  /* ---- /api/channels/:id/messages (GET/POST) ---- */
  const channelMessagesMatch = matchRoute(pathname, '/api/channels/:id/messages');
  if (channelMessagesMatch) {
    const channelId = parsePositiveId(channelMessagesMatch.id);
    if (!channelId) return badRequest('ID de canal inválido.');
    const channel = accessibleChannel(db, channelId, me.id);
    if (!channel) return notFound('Canal não encontrado.');

    if (method === 'GET') {
      rateLimit(req, 'channel-messages-read', 120, 60 * 1000);
      const before = url.searchParams.get('before');
      const cursor = before === null ? null : parsePositiveId(before);
      if (before !== null && cursor === null) return badRequest('Cursor inválido.');
      const limit = parseLimit(url.searchParams.get('limit'));
      if (limit === null) return badRequest('Limite inválido.');
      const params = [channelId];
      let sql =
        `SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar,
                CASE WHEN EXISTS (
                  SELECT 1 FROM identity_verifications iv
                  WHERE iv.user_id = u.id AND iv.status = 'approved'
                ) THEN 1 ELSE 0 END AS sender_verified
         FROM chat_messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.channel_id = ? AND m.deleted_at IS NULL`;
      if (cursor !== null) {
        sql += ' AND m.id < ?';
        params.push(cursor);
      }
      sql += ' ORDER BY m.id DESC LIMIT ?';
      params.push(limit + 1);
      const raw = db.prepare(sql).all(...params);
      const hasMore = raw.length > limit;
      const page = raw.slice(0, limit).reverse();
      const nextCursor = hasMore && page.length ? page[0].id : null;
      const messageIds = page.map((row) => row.id);
      const mediaByMessage = new Map();
      if (messageIds.length) {
        const placeholders = messageIds.map(() => '?').join(',');
        const mediaRows = db
          .prepare(
            `SELECT * FROM chat_message_media
             WHERE message_id IN (${placeholders})
             ORDER BY message_id, position, id`
          )
          .all(...messageIds);
        for (const media of mediaRows) {
          const items = mediaByMessage.get(media.message_id) || [];
          items.push(mediaDTO(media));
          mediaByMessage.set(media.message_id, items);
        }
      }
      const messages = page.map((row) =>
        channelMessageDTO(row, mediaByMessage.get(row.id) || [], me.id)
      );
      return { status: 200, body: { messages, nextCursor } };
    }

    if (method === 'POST') {
      rateLimit(req, 'channel-messages', 60, 60 * 1000);
      const body = await readBody(req);
      if (!isPlainObject(body)) return badRequest('Corpo inválido.');
      const text = cleanText(body.text || '', 'Mensagem', { max: 2000, multiline: true });
      let sharedPostId = null;
      if (body.sharedPostId !== undefined && body.sharedPostId !== null) {
        sharedPostId = parsePositiveId(body.sharedPostId);
        if (!sharedPostId) return badRequest('Publicação inválida.');
        const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(sharedPostId);
        if (!post || isBlocked(me.id, post.user_id)) {
          return notFound('Publicação não encontrada.');
        }
      }
      const requestedMedia = body.media === undefined || body.media === null ? [] : body.media;
      if (!Array.isArray(requestedMedia)) return badRequest('Anexos inválidos.');
      if (requestedMedia.length > 4) return badRequest('Envie no máximo 4 anexos por mensagem.');
      const mediaItems = requestedMedia.map(validateMessageMediaItem);
      const totalBytes = mediaItems.reduce((total, item) => total + item.sizeBytes, 0);
      if (totalBytes > 25 * 1024 * 1024) {
        return { status: 413, body: { error: 'Anexos grandes demais (limite total de 25 MB).' } };
      }
      if (!text && !sharedPostId && mediaItems.length === 0) {
        return badRequest('Escreva uma mensagem ou anexe um arquivo.');
      }

      const timestamp = now();
      const savedMedia = [];
      try {
        for (const item of mediaItems) {
          savedMedia.push({
            ...item,
            ...saveMessageMedia(item, channelId, me.id, { kind: 'channel' }),
          });
        }
        const messageId = withTransaction(() => {
          const result = db
            .prepare(
              `INSERT INTO chat_messages
               (channel_id, sender_id, body, shared_post_id, created_at)
               VALUES (?, ?, ?, ?, ?)`
            )
            .run(channelId, me.id, text, sharedPostId, timestamp);
          const id = Number(result.lastInsertRowid);
          for (const [position, item] of savedMedia.entries()) {
            db.prepare(
              `INSERT INTO chat_message_media
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
          db.prepare('UPDATE chat_channels SET updated_at = ? WHERE id = ?').run(timestamp, channelId);
          db.prepare(
            'UPDATE chat_channel_members SET last_read_at = ? WHERE channel_id = ? AND user_id = ?'
          ).run(timestamp, channelId, me.id);
          for (const item of savedMedia) {
            require('node:fs').renameSync(item.stagedPath, item.finalPath);
          }
          return id;
        });

        // Parse @username mentions and create server_mention notifications
        const mentionRegex = /@([a-zA-Z0-9._]+)/g;
        const mentionedUsernames = new Set();
        let match;
        while ((match = mentionRegex.exec(text)) !== null) {
          const username = match[1].toLowerCase();
          if (username !== me.username.toLowerCase()) {
            mentionedUsernames.add(username);
          }
        }

        if (mentionedUsernames.size > 0) {
          const placeholders = Array.from(mentionedUsernames).map(() => '?').join(',');
          const mentionedUsers = db
            .prepare(`SELECT id, username, name FROM users WHERE lower(username) IN (${placeholders})`)
            .all(...Array.from(mentionedUsernames));
          const channelMemberIds = new Set(
            db
              .prepare('SELECT user_id FROM chat_channel_members WHERE channel_id = ?')
              .all(channelId)
              .map((row) => row.user_id)
          );
          const notificationTimestamp = now();
          const link = `/mensagens?espaco=${channel.space_id}&canal=${channelId}`;
          for (const targetUser of mentionedUsers) {
            if (!channelMemberIds.has(targetUser.id)) continue;
            db.prepare(
              'INSERT INTO notifications (user_id, kind, text, link, created_at) VALUES (?, ?, ?, ?, ?)'
            ).run(targetUser.id, 'server_mention', `${me.name} mencionou você em #${channel.name}`, link, notificationTimestamp);
            sseHub.publish(
              [targetUser.id],
              'server.mention',
              { spaceId: channel.space_id, channelId, messageId, mentionedBy: me.id },
              (client) => accessibleChannel(db, channelId, client.userId) !== null,
            );
          }
        }

        const message = db
          .prepare(
            `SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar,
                    CASE WHEN EXISTS (
                      SELECT 1 FROM identity_verifications iv
                      WHERE iv.user_id = u.id AND iv.status = 'approved'
                    ) THEN 1 ELSE 0 END AS sender_verified
             FROM chat_messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.id = ?`
          )
          .get(messageId);
        const dto = channelMessageDTO(
          message,
          savedMedia.map((item) => ({
            url: item.url,
            media_type: item.mediaType,
            mime_type: item.mimeType,
            size_bytes: item.sizeBytes,
            file_name: item.fileName,
          })),
          me.id
        );
        const recipientIds = db
          .prepare('SELECT user_id FROM chat_channel_members WHERE channel_id = ?')
          .all(channelId)
          .map((row) => row.user_id);
        sseHub.publish(
          recipientIds,
          'message.created',
          { scope: 'channel', spaceId: channel.space_id, channelId, message: dto },
          (client) => accessibleChannel(db, channelId, client.userId) !== null,
          (client, payload) => ({
            ...payload,
            message: { ...payload.message, mine: client.userId === me.id },
          }),
        );
        return { status: 201, body: { message: dto } };
      } catch (error) {
        for (const item of savedMedia) {
          require('node:fs').rmSync(item.stagedPath, { force: true });
          removeUploadIfUnused(item.url);
        }
        throw error;
      }
    }
  }

  /* ---- /api/channels/:id/read (POST) ---- */
  const channelReadMatch = matchRoute(pathname, '/api/channels/:id/read');
  if (channelReadMatch && method === 'POST') {
    const channelId = parsePositiveId(channelReadMatch.id);
    if (!channelId) return badRequest('ID de canal inválido.');
    const channel = accessibleChannel(db, channelId, me.id);
    if (!channel) return notFound('Canal não encontrado.');
    db.prepare(
      'UPDATE chat_channel_members SET last_read_at = ? WHERE channel_id = ? AND user_id = ?'
    ).run(now(), channelId, me.id);
    return { status: 200, body: { ok: true } };
  }

  /* ---- /api/channels/:id/members (POST) ---- */
  const channelMembersMatch = matchRoute(pathname, '/api/channels/:id/members');
  if (channelMembersMatch && method === 'POST') {
    const channelId = parsePositiveId(channelMembersMatch.id);
    if (!channelId) return badRequest('ID de canal inválido.');
    const channel = accessibleChannel(db, channelId, me.id);
    if (!channel) return notFound('Canal não encontrado.');
    if (!canManageChannel(db, channel, me.id)) {
      return forbidden('Sem permissão para gerenciar este canal.');
    }
    rateLimit(req, 'channel-add-member', 30, 60 * 1000);
    const body = await readBody(req);
    if (!isPlainObject(body)) return badRequest('Corpo inválido.');
    const username = cleanText(body.username, 'Usuário', { min: 1, max: 40, required: true }).toLowerCase();
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!target) return notFound('Usuário não encontrado.');
    if (!getSpaceMembership(db, channel.space_id, target.id)) {
      return notFound('Usuário não é membro do espaço.');
    }
    const existing = db
      .prepare('SELECT 1 AS ok FROM chat_channel_members WHERE channel_id = ? AND user_id = ?')
      .get(channelId, target.id);
    if (existing) return { status: 200, body: { member: { userId: target.id } } };
    db.prepare(
      `INSERT INTO chat_channel_members
       (channel_id, user_id, last_read_at, created_at) VALUES (?, ?, 0, ?)`
    ).run(channelId, target.id, now());
    return { status: 201, body: { member: { userId: target.id } } };
  }

  /* ---------- remoção de membros ---------- */
  const deleteSpaceMemberMatch = matchRoute(pathname, '/api/spaces/:spaceId/members/:userId');
  if (deleteSpaceMemberMatch && method === 'DELETE') {
    const spaceId = parsePositiveId(deleteSpaceMemberMatch.spaceId);
    const targetUserId = parsePositiveId(deleteSpaceMemberMatch.userId);
    if (!spaceId || !targetUserId) return badRequest('IDs inválidos.');
    const space = getSpace(db, spaceId, me.id);
    if (!space) return notFound('Espaço não encontrado.');
    const targetMembership = getSpaceMembership(db, spaceId, targetUserId);
    if (!targetMembership) return notFound('Membro não encontrado.');

    const isOwner = space.role === 'owner';
    const isMod = space.role === 'moderator';
    if (!isOwner && !isMod) {
      return forbidden('Apenas proprietários e moderadores podem remover membros.');
    }
    /* Proprietário do espaço permanece vinculado ao espaço. */
    if (targetUserId === space.created_by || targetMembership.role === 'owner') {
      return forbidden('O proprietário do espaço não pode ser removido.');
    }
    /* Moderador remove apenas membros comuns; dono remove qualquer um. */
    if (isMod && !isOwner && targetMembership.role === 'moderator' && targetUserId !== me.id) {
      return forbidden('Moderadores não podem remover outros moderadores.');
    }
    rateLimit(req, 'space-remove-member', 30, 60 * 1000);

    withTransaction(() => {
      db.prepare(
        `DELETE FROM chat_channel_members
         WHERE user_id = ? AND channel_id IN (SELECT id FROM chat_channels WHERE space_id = ?)`
      ).run(targetUserId, spaceId);
      db.prepare('DELETE FROM chat_space_members WHERE space_id = ? AND user_id = ?').run(spaceId, targetUserId);
    });
    return { status: 200, body: { ok: true } };
  }

  const deleteChannelMemberMatch = matchRoute(pathname, '/api/channels/:channelId/members/:userId');
  if (deleteChannelMemberMatch && method === 'DELETE') {
    const channelId = parsePositiveId(deleteChannelMemberMatch.channelId);
    const targetUserId = parsePositiveId(deleteChannelMemberMatch.userId);
    if (!channelId || !targetUserId) return badRequest('IDs inválidos.');
    const channel = accessibleChannel(db, channelId, me.id);
    if (!channel) return notFound('Canal não encontrado.');
    const existing = isChannelMember(db, channelId, targetUserId);
    if (!existing) return notFound('Membro não encontrado.');
    if (!canManageChannel(db, channel, me.id)) {
      return forbidden('Apenas o criador do canal ou administradores do espaço podem remover membros.');
    }
    const requesterRole = getSpaceMembership(db, channel.space_id, me.id)?.role || null;
    const isSpaceAdmin = requesterRole === 'owner' || requesterRole === 'moderator';
    const isSelfRemoval = targetUserId === me.id;
    /* Criador do canal só sai por si mesmo; administradores podem removê-lo. */
    if (targetUserId === channel.created_by && !isSelfRemoval && !isSpaceAdmin) {
      return forbidden('O criador do canal não pode ser removido.');
    }
    /* Criador sem papel administrativo não remove dono/moderador do espaço. */
    if (!isSpaceAdmin) {
      const targetRole = getSpaceMembership(db, channel.space_id, targetUserId)?.role || null;
      if (targetRole === 'owner' || targetRole === 'moderator') {
        return forbidden('Donos e moderadores do espaço não podem ser removidos do canal.');
      }
    }
    rateLimit(req, 'channel-remove-member', 30, 60 * 1000);
    db.prepare('DELETE FROM chat_channel_members WHERE channel_id = ? AND user_id = ?').run(channelId, targetUserId);
    return { status: 200, body: { ok: true } };
  }

  /* ---- /api/channels/:id (GET) ---- */
  const channelMatch = matchRoute(pathname, '/api/channels/:id');
  if (channelMatch && method === 'GET') {
    const channelId = parsePositiveId(channelMatch.id);
    if (!channelId) return badRequest('ID de canal inválido.');
    const channel = accessibleChannel(db, channelId, me.id);
    if (!channel) return notFound('Canal não encontrado.');
    const last = db
      .prepare(
        `SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar,
                CASE WHEN EXISTS (
                  SELECT 1 FROM identity_verifications iv
                  WHERE iv.user_id = u.id AND iv.status = 'approved'
                ) THEN 1 ELSE 0 END AS sender_verified
         FROM chat_messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.channel_id = ? AND m.deleted_at IS NULL
         ORDER BY m.id DESC LIMIT 1`
      )
      .get(channelId);
    const lastMessage = last
      ? {
          id: last.id,
          body: last.body || '',
          senderId: last.sender_id,
          createdAt: last.created_at,
        }
      : null;
    const unreadCount = db
      .prepare(
        `SELECT COUNT(*) AS n FROM chat_messages
         WHERE channel_id = ? AND sender_id != ? AND deleted_at IS NULL AND created_at > (SELECT last_read_at FROM chat_channel_members WHERE channel_id = ? AND user_id = ?)`
      )
      .get(channelId, me.id, channelId, me.id).n;
    return { status: 200, body: { channel: channelDTO(channel, 0, lastMessage, unreadCount) } };
  }

  /* ---------- edição/remoção de mensagem de canal ---------- */
  /* Aceita `/api/channel-messages/:id` e `/api/channels/:channelId/messages/:messageId`. */
  const channelMessageMatch = matchRoute(pathname, '/api/channel-messages/:id');
  const nestedChannelMessageMatch = matchRoute(pathname, '/api/channels/:channelId/messages/:messageId');
  const channelMessageRoute = channelMessageMatch || nestedChannelMessageMatch;
  if (channelMessageRoute && (method === 'PATCH' || method === 'DELETE')) {
    const messageId = parsePositiveId(channelMessageRoute.messageId || channelMessageRoute.id);
    if (!messageId) return badRequest('ID de mensagem inválido.');
    let parentChannelId = null;
    if (nestedChannelMessageMatch) {
      parentChannelId = parsePositiveId(nestedChannelMessageMatch.channelId);
      if (!parentChannelId) return badRequest('ID de canal inválido.');
    }
    const message = db
      .prepare(
        `SELECT m.*, c.space_id
         FROM chat_messages m
         JOIN chat_channels c ON c.id = m.channel_id
         WHERE m.id = ?`
      )
      .get(messageId);
    if (!message || message.sender_id !== me.id || message.deleted_at) {
      return notFound('Mensagem não encontrada.');
    }
    if (parentChannelId !== null && parentChannelId !== message.channel_id) {
      return notFound('Mensagem não encontrada.');
    }
    const channel = accessibleChannel(db, message.channel_id, me.id);
    if (!channel) return notFound('Mensagem não encontrada.');

    if (method === 'PATCH') {
      const body = await readBody(req);
      if (!isPlainObject(body)) return badRequest('Corpo inválido.');
      const text = cleanText(body.text || '', 'Mensagem', { max: 2000, multiline: true });
      const mediaCount = db
        .prepare('SELECT COUNT(*) AS n FROM chat_message_media WHERE message_id = ?')
        .get(messageId).n;
      if (!text && !message.shared_post_id && !mediaCount) {
        return badRequest('Mensagem vazia.');
      }
      const timestamp = now();
      const changes = db.prepare(
        'UPDATE chat_messages SET body = ?, edited_at = ? WHERE id = ? AND sender_id = ? AND deleted_at IS NULL'
      ).run(text, timestamp, messageId, me.id).changes;
      if (changes === 0) return notFound('Mensagem não encontrada.');
      const updated = db
        .prepare(
          `SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar,
                  CASE WHEN EXISTS (
                    SELECT 1 FROM identity_verifications iv
                    WHERE iv.user_id = u.id AND iv.status = 'approved'
                  ) THEN 1 ELSE 0 END AS sender_verified
           FROM chat_messages m
           JOIN users u ON u.id = m.sender_id
           WHERE m.id = ?`
        )
        .get(messageId);
      const media = db
        .prepare('SELECT * FROM chat_message_media WHERE message_id = ? ORDER BY position, id')
        .all(messageId)
        .map(mediaDTO);
      const dto = channelMessageDTO(updated, media, me.id);
      const recipientIds = db
        .prepare('SELECT user_id FROM chat_channel_members WHERE channel_id = ?')
        .all(message.channel_id)
        .map((row) => row.user_id);
      sseHub.publish(
        recipientIds,
        'message.updated',
        { scope: 'channel', spaceId: message.space_id, channelId: message.channel_id, message: dto },
        (client) => accessibleChannel(db, message.channel_id, client.userId) !== null,
        (client, payload) => ({
          ...payload,
          message: { ...payload.message, mine: client.userId === me.id },
        }),
      );
      return { status: 200, body: { message: dto } };
    }

    const timestamp = now();
    let removedMedia = [];
    withTransaction(() => {
      const changes = db.prepare(
        "UPDATE chat_messages SET deleted_at = ?, body = '', shared_post_id = NULL WHERE id = ? AND sender_id = ? AND deleted_at IS NULL"
      ).run(timestamp, messageId, me.id).changes;
      if (changes === 0) return;
      removedMedia = db
        .prepare('SELECT url FROM chat_message_media WHERE message_id = ?')
        .all(messageId);
      db.prepare('DELETE FROM chat_message_media WHERE message_id = ?').run(messageId);
    });
    const updated = db
      .prepare(
        `SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar,
                CASE WHEN EXISTS (
                  SELECT 1 FROM identity_verifications iv
                  WHERE iv.user_id = u.id AND iv.status = 'approved'
                ) THEN 1 ELSE 0 END AS sender_verified
         FROM chat_messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.id = ?`
      )
      .get(messageId);
    const dto = channelMessageDTO(updated, [], me.id);
    for (const media of removedMedia) {
      removeUploadIfUnused(media.url);
    }
    const recipientIds = db
      .prepare('SELECT user_id FROM chat_channel_members WHERE channel_id = ?')
      .all(message.channel_id)
      .map((row) => row.user_id);
    sseHub.publish(
      recipientIds,
      'message.deleted',
      { scope: 'channel', spaceId: message.space_id, channelId: message.channel_id, messageId },
      (client) => accessibleChannel(db, message.channel_id, client.userId) !== null,
    );
    return { status: 200, body: { ok: true, message: dto } };
  }

  /* ---------- paginação estável de mensagens diretas ---------- */
  const dmMessagesMatch = matchRoute(pathname, '/api/conversations/:id/messages');
  if (method === 'GET' && dmMessagesMatch) {
    const conversationId = parsePositiveId(dmMessagesMatch.id);
    if (!conversationId) return badRequest('ID de conversa inválido.');
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
    if (!conversation || !isConversationMember(conversationId, me.id)) {
      return notFound('Conversa não encontrada.');
    }
    const other = db
      .prepare(
        `SELECT cm.user_id, u.*
         FROM conversation_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.conversation_id = ? AND cm.user_id != ?`
      )
      .get(conversationId, me.id);
    if (!other) return notFound('Conversa não encontrada.');
    if (isBlocked(me.id, other.user_id)) {
      return notFound('Conversa indisponível.');
    }
    if (
      conversation.kind === 'dating' &&
      (!datingConversationAccess(me, other.user_id) ||
        !db.prepare('SELECT 1 AS ok FROM matches WHERE id = ? AND ended_at IS NULL').get(conversation.match_id))
    ) {
      return notFound('Conversa indisponível.');
    }

    rateLimit(req, 'dm-messages-read', 120, 60 * 1000);
    const before = url.searchParams.get('before');
    const cursor = before === null ? null : parsePositiveId(before);
    if (before !== null && cursor === null) return badRequest('Cursor inválido.');
    const limit = parseLimit(url.searchParams.get('limit'));
    if (limit === null) return badRequest('Limite inválido.');
    const params = [conversationId];
    let sql =
      `SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar,
              CASE WHEN EXISTS (
                SELECT 1 FROM identity_verifications iv
                WHERE iv.user_id = u.id AND iv.status = 'approved'
              ) THEN 1 ELSE 0 END AS sender_verified
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? AND m.deleted_at IS NULL`;
    if (cursor !== null) {
      sql += ' AND m.id < ?';
      params.push(cursor);
    }
    sql += ' ORDER BY m.id DESC LIMIT ?';
    params.push(limit + 1);
    const raw = db.prepare(sql).all(...params);
    const hasMore = raw.length > limit;
    const page = raw.slice(0, limit).reverse();
    const nextCursor = hasMore && page.length ? page[0].id : null;
    const messageIds = page.map((row) => row.id);
    const mediaByMessage = new Map();
    if (messageIds.length) {
      const placeholders = messageIds.map(() => '?').join(',');
      const mediaRows = db
        .prepare(
          `SELECT * FROM message_media
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
    const sharedIds = [...new Set(page.map((row) => row.shared_post_id).filter(Boolean))];
    const sharedPosts = new Map();
    if (sharedIds.length) {
      const placeholders = sharedIds.map(() => '?').join(',');
      const postRows = db.prepare(`${POST_SELECT} WHERE p.id IN (${placeholders})`).all(me.id, ...sharedIds);
      for (const post of postRows.map(mapPost)) sharedPosts.set(post.id, post);
    }
    const messages = page.map((row) =>
      dmMessageDTO(row, mediaByMessage.get(row.id) || [], sharedPosts.get(row.shared_post_id) || null, me.id)
    );
    return { status: 200, body: { messages, nextCursor } };
  }

  /* ---------- edição/remoção de mensagem direta ---------- */
  /* Aceita `/api/conversation-messages/:id` e `/api/conversations/:id/messages/:messageId`. */
  const dmMessageMatch = matchRoute(pathname, '/api/conversation-messages/:id');
  const nestedDmMessageMatch = matchRoute(pathname, '/api/conversations/:conversationId/messages/:messageId');
  const dmMessageRoute = dmMessageMatch || nestedDmMessageMatch;
  if (dmMessageRoute && (method === 'PATCH' || method === 'DELETE')) {
    const messageId = parsePositiveId(dmMessageRoute.messageId || dmMessageRoute.id);
    if (!messageId) return badRequest('ID de mensagem inválido.');
    let parentConversationId = null;
    if (nestedDmMessageMatch) {
      parentConversationId = parsePositiveId(nestedDmMessageMatch.conversationId);
      if (!parentConversationId) return badRequest('ID de conversa inválido.');
    }
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!message || message.sender_id !== me.id || message.deleted_at) {
      return notFound('Mensagem não encontrada.');
    }
    if (parentConversationId !== null && parentConversationId !== message.conversation_id) {
      return notFound('Mensagem não encontrada.');
    }
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(message.conversation_id);
    if (!conversation || !isConversationMember(conversation.id, me.id)) {
      return notFound('Mensagem não encontrada.');
    }
    const other = db
      .prepare(
        `SELECT cm.user_id FROM conversation_members cm
         WHERE cm.conversation_id = ? AND cm.user_id != ?`
      )
      .get(conversation.id, me.id);
    if (!other || isBlocked(me.id, other.user_id)) {
      return notFound('Mensagem não encontrada.');
    }
    if (conversation.kind === 'dating') {
      const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(conversation.match_id);
      if (!match || match.ended_at || !datingConversationAccess(me, other.user_id)) {
        return notFound('Mensagem não encontrada.');
      }
    }

    if (method === 'PATCH') {
      const body = await readBody(req);
      if (!isPlainObject(body)) return badRequest('Corpo inválido.');
      const text = cleanText(body.text || '', 'Mensagem', { max: 2000, multiline: true });
      const mediaCount = db
        .prepare('SELECT COUNT(*) AS n FROM message_media WHERE message_id = ?')
        .get(messageId).n;
      if (!text && !message.shared_post_id && !mediaCount) {
        return badRequest('Mensagem vazia.');
      }
      const timestamp = now();
      const changes = db.prepare(
        'UPDATE messages SET body = ?, edited_at = ? WHERE id = ? AND sender_id = ? AND deleted_at IS NULL'
      ).run(text, timestamp, messageId, me.id).changes;
      if (changes === 0) return notFound('Mensagem não encontrada.');
      const updated = db
        .prepare(
          `SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar,
                  CASE WHEN EXISTS (
                    SELECT 1 FROM identity_verifications iv
                    WHERE iv.user_id = u.id AND iv.status = 'approved'
                  ) THEN 1 ELSE 0 END AS sender_verified
           FROM messages m
           JOIN users u ON u.id = m.sender_id
           WHERE m.id = ?`
        )
        .get(messageId);
      const media = db
        .prepare('SELECT * FROM message_media WHERE message_id = ? ORDER BY position, id')
        .all(messageId)
        .map(mapMessageMedia);
      let sharedPost = null;
      if (updated.shared_post_id) {
        const post = db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(me.id, updated.shared_post_id);
        sharedPost = post ? mapPost(post) : null;
      }
      const dto = dmMessageDTO(updated, media, sharedPost, me.id);
      const recipientIds = db
        .prepare('SELECT user_id FROM conversation_members WHERE conversation_id = ?')
        .all(conversation.id)
        .map((row) => row.user_id);
      sseHub.publish(
        recipientIds,
        'message.updated',
        { scope: 'conversation', conversationId: conversation.id, message: dto },
        (client) => authorizeConversationRecipient(client, conversation.id),
        ssePayloadForRecipient,
      );
      return { status: 200, body: { message: dto } };
    }

    const timestamp = now();
    let removedMedia = [];
    withTransaction(() => {
      const changes = db.prepare(
        "UPDATE messages SET deleted_at = ?, body = '', shared_post_id = NULL WHERE id = ? AND sender_id = ? AND deleted_at IS NULL"
      ).run(timestamp, messageId, me.id).changes;
      if (changes === 0) return;
      removedMedia = db
        .prepare('SELECT url FROM message_media WHERE message_id = ?')
        .all(messageId);
      db.prepare('DELETE FROM message_media WHERE message_id = ?').run(messageId);
    });
    const updated = db
      .prepare(
        `SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar,
                CASE WHEN EXISTS (
                  SELECT 1 FROM identity_verifications iv
                  WHERE iv.user_id = u.id AND iv.status = 'approved'
                ) THEN 1 ELSE 0 END AS sender_verified
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.id = ?`
      )
      .get(messageId);
    const dto = dmMessageDTO(updated, [], null, me.id);
    for (const media of removedMedia) {
      removeUploadIfUnused(media.url);
    }
    const recipientIds = db
      .prepare('SELECT user_id FROM conversation_members WHERE conversation_id = ?')
      .all(conversation.id)
      .map((row) => row.user_id);
    sseHub.publish(
      recipientIds,
      'message.deleted',
      { scope: 'conversation', conversationId: conversation.id, messageId },
      (client) => authorizeConversationRecipient(client, conversation.id),
      ssePayloadForRecipient,
    );
    return { status: 200, body: { ok: true, message: dto } };
  }

  /* ---- /api/channels/:id/voice/join (POST) - join voice channel ---- */
  const voiceJoinMatch = matchRoute(pathname, '/api/channels/:id/voice/join');
  if (voiceJoinMatch && method === 'POST') {
    const channelId = parsePositiveId(voiceJoinMatch.id);
    if (!channelId) return badRequest('ID de canal inválido.');
    const channel = accessibleChannel(db, channelId, me.id);
    if (!channel) return notFound('Canal não encontrado.');
    if (channel.type !== 'voice') return badRequest('Canal não é de voz.');
    const timestamp = now();
    db.prepare(
      `INSERT OR REPLACE INTO chat_voice_states (channel_id, user_id, joined_at, is_muted, is_deafened, is_speaking)
       VALUES (?, ?, ?, 0, 0, 0)`
    ).run(channelId, me.id, timestamp);
    // Broadcast voice state change to channel members via SSE
    const recipientIds = db
      .prepare('SELECT user_id FROM chat_channel_members WHERE channel_id = ?')
      .all(channelId)
      .map((row) => row.user_id);
    sseHub.publish(
      recipientIds,
      'voice.state',
      { scope: 'channel', channelId, userId: me.id, joined: true, username: me.username, name: me.name, avatar: me.avatar },
      (client) => accessibleChannel(db, channelId, client.userId) !== null,
    );
    return { status: 200, body: { ok: true } };
  }

  /* ---- /api/channels/:id/voice/leave (POST) - leave voice channel ---- */
  const voiceLeaveMatch = matchRoute(pathname, '/api/channels/:id/voice/leave');
  if (voiceLeaveMatch && method === 'POST') {
    const channelId = parsePositiveId(voiceLeaveMatch.id);
    if (!channelId) return badRequest('ID de canal inválido.');
    const channel = accessibleChannel(db, channelId, me.id);
    if (!channel) return notFound('Canal não encontrado.');
    if (channel.type !== 'voice') return badRequest('Canal não é de voz.');
    db.prepare('DELETE FROM chat_voice_states WHERE channel_id = ? AND user_id = ?').run(channelId, me.id);
    const recipientIds = db
      .prepare('SELECT user_id FROM chat_channel_members WHERE channel_id = ?')
      .all(channelId)
      .map((row) => row.user_id);
    sseHub.publish(
      recipientIds,
      'voice.state',
      { scope: 'channel', channelId, userId: me.id, joined: false },
      (client) => accessibleChannel(db, channelId, client.userId) !== null,
    );
    return { status: 200, body: { ok: true } };
  }

  /* ---- /api/channels/:id/voice/state (GET) - get voice channel state ---- */
  const voiceStateMatch = matchRoute(pathname, '/api/channels/:id/voice/state');
  if (voiceStateMatch && method === 'GET') {
    const channelId = parsePositiveId(voiceStateMatch.id);
    if (!channelId) return badRequest('ID de canal inválido.');
    const channel = accessibleChannel(db, channelId, me.id);
    if (!channel) return notFound('Canal não encontrado.');
    if (channel.type !== 'voice') return badRequest('Canal não é de voz.');
    const states = db
      .prepare(
        `SELECT vs.*, u.username, u.name, u.avatar
         FROM chat_voice_states vs
         JOIN users u ON u.id = vs.user_id
         WHERE vs.channel_id = ?`
      )
      .all(channelId);
    const participants = states.map((row) => ({
      userId: row.user_id,
      username: row.username,
      name: row.name,
      avatar: row.avatar,
      isMuted: !!row.is_muted,
      isDeafened: !!row.is_deafened,
      isSpeaking: !!row.is_speaking,
      joinedAt: row.joined_at,
    }));
    return { status: 200, body: { participants } };
  }

  /* ---- /api/channels/:id/voice/mute (POST) - toggle mute ---- */
  const voiceMuteMatch = matchRoute(pathname, '/api/channels/:id/voice/mute');
  if (voiceMuteMatch && method === 'POST') {
    const channelId = parsePositiveId(voiceMuteMatch.id);
    if (!channelId) return badRequest('ID de canal inválido.');
    const channel = accessibleChannel(db, channelId, me.id);
    if (!channel) return notFound('Canal não encontrado.');
    if (channel.type !== 'voice') return badRequest('Canal não é de voz.');
    const body = await readBody(req);
    const isMuted = body?.muted === true ? 1 : 0;
    db.prepare('UPDATE chat_voice_states SET is_muted = ? WHERE channel_id = ? AND user_id = ?').run(isMuted, channelId, me.id);
    const recipientIds = db
      .prepare('SELECT user_id FROM chat_channel_members WHERE channel_id = ?')
      .all(channelId)
      .map((row) => row.user_id);
    sseHub.publish(
      recipientIds,
      'voice.state',
      { scope: 'channel', channelId, userId: me.id, isMuted: !!isMuted },
      (client) => accessibleChannel(db, channelId, client.userId) !== null,
    );
    return { status: 200, body: { ok: true, muted: !!isMuted } };
  }

  /* ---- /api/channels/:id/voice/deafen (POST) - toggle deafen ---- */
  const voiceDeafenMatch = matchRoute(pathname, '/api/channels/:id/voice/deafen');
  if (voiceDeafenMatch && method === 'POST') {
    const channelId = parsePositiveId(voiceDeafenMatch.id);
    if (!channelId) return badRequest('ID de canal inválido.');
    const channel = accessibleChannel(db, channelId, me.id);
    if (!channel) return notFound('Canal não encontrado.');
    if (channel.type !== 'voice') return badRequest('Canal não é de voz.');
    const body = await readBody(req);
    const isDeafened = body?.deafened === true ? 1 : 0;
    db.prepare('UPDATE chat_voice_states SET is_deafened = ? WHERE channel_id = ? AND user_id = ?').run(isDeafened, channelId, me.id);
    return { status: 200, body: { ok: true, deafened: !!isDeafened } };
  }

  /* ---- /api/channels/:id/voice/speaking (POST) - update speaking state ---- */
  const voiceSpeakingMatch = matchRoute(pathname, '/api/channels/:id/voice/speaking');
  if (voiceSpeakingMatch && method === 'POST') {
    const channelId = parsePositiveId(voiceSpeakingMatch.id);
    if (!channelId) return badRequest('ID de canal inválido.');
    const channel = accessibleChannel(db, channelId, me.id);
    if (!channel) return notFound('Canal não encontrado.');
    if (channel.type !== 'voice') return badRequest('Canal não é de voz.');
    const body = await readBody(req);
    const isSpeaking = body?.speaking === true ? 1 : 0;
    db.prepare('UPDATE chat_voice_states SET is_speaking = ? WHERE channel_id = ? AND user_id = ?').run(isSpeaking, channelId, me.id);
    const recipientIds = db
      .prepare('SELECT user_id FROM chat_channel_members WHERE channel_id = ?')
      .all(channelId)
      .map((row) => row.user_id);
    sseHub.publish(
      recipientIds,
      'voice.speaking',
      { scope: 'channel', channelId, userId: me.id, isSpeaking: !!isSpeaking },
      (client) => accessibleChannel(db, channelId, client.userId) !== null,
    );
    return { status: 200, body: { ok: true } };
  }

  return null;
}

module.exports = {
  handleChatRoutes,
  slugify,
  matchRoute,
  getSpaceMembership,
  getSpace,
  getChannel,
  isChannelMember,
  accessibleChannel,
  canManageChannel,
};