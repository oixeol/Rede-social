'use strict';

/**
 * Hub SSE em memória para eventos de chat.
 *
 * Cada conexão pertence a um usuário autenticado. Publicação exige uma lista
 * explícita de destinatários e uma autorização verificada novamente no momento
 * do evento. Nenhum evento usa broadcast global.
 *
 * Hardening:
 * - Validação de sessão ativa antes de aceitar inscrição e periodicamente.
 * - Limite por usuário (padrão 3 conexões simultâneas).
 * - Back-pressure de escrita: eventos ficam em fila limitada enquanto o socket
 *   não drena; fila estourada desconecta o cliente lento em vez de crescer sem
 *   limite na memória do processo.
 */
class SseHub {
  constructor({
    keepAliveMs = 20_000,
    isSessionActive = null,
    maxWritableBytes = 1024 * 1024,
    maxConnectionsPerUser = 3,
  } = {}) {
    this.clients = new Map();
    this.keepAliveMs = keepAliveMs;
    this.isSessionActive = typeof isSessionActive === 'function' ? isSessionActive : null;
    this.maxWritableBytes = Math.max(1024, Number(maxWritableBytes) || 0);
    this.maxConnectionsPerUser = Math.max(1, Number(maxConnectionsPerUser) || 1);
    this.keepAliveTimer = setInterval(() => this.keepAlive(), keepAliveMs);
    this.keepAliveTimer.unref?.();
  }

  /**
   * Registra uma resposta SSE já autenticada.
   * Retorna true se aceitou, false se rejeitou (ex: sessão inválida, limite atingido).
   */
  subscribe(req, res, userId, sessionToken = null) {
    const userIdNum = Number(userId);

    /* Validação de sessão ativa no momento da inscrição. */
    if (this.isSessionActive) {
      if (!sessionToken || !this.isSessionActive(sessionToken, userIdNum)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sessão expirada ou inválida.' }));
        return false;
      }
    }

    /* Limite de conexões por usuário. */
    const existing = this.clients.get(userIdNum);
    if (existing && existing.size >= this.maxConnectionsPerUser) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Limite de conexões SSE atingido.' }));
      return false;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');

    const client = {
      res,
      userId: userIdNum,
      sessionToken: sessionToken || null,
      backpressured: false,
      queue: [],
      queueBytes: 0,
      closed: false,
    };
    const clients = this.clients.get(client.userId) || new Set();
    clients.add(client);
    this.clients.set(client.userId, clients);

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      client.closed = true;
      client.queue = [];
      client.queueBytes = 0;
      const current = this.clients.get(client.userId);
      if (!current) return;
      current.delete(client);
      if (!current.size) this.clients.delete(client.userId);
    };
    client.cleanup = cleanup;

    /* Lida com back-pressure: se o buffer do socket encher, para de escrever
     * até o evento 'drain' liberar. */
    const onDrain = () => {
      client.backpressured = false;
      this.flushQueue(client);
    };
    res.on('drain', onDrain);

    /* `IncomingMessage.close` pode ocorrer quando o request termina, sem que a
     * resposta SSE termine. Usar `res.close` evita remover a stream cedo. */
    req.on('aborted', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
    res.on('finish', cleanup);

    /* Remove listener de drain ao limpar para evitar vazamento. */
    const originalCleanup = cleanup;
    client.cleanup = () => {
      res.off('drain', onDrain);
      originalCleanup();
    };

    return true;
  }

  /**
   * Envia evento somente aos IDs autorizados.
   *
   * `authorizeRecipient` recebe a conexão e deve confirmar membership vivo.
   * `payloadForRecipient` permite ajustar `mine` sem reutilizar o DTO do autor.
   */
  publish(userIds, type, payload, authorizeRecipient, payloadForRecipient = null) {
    if (typeof authorizeRecipient !== 'function') {
      throw new TypeError('SSE exige autorização por destinatário.');
    }
    const recipients = [...new Set((userIds || []).map(Number).filter(Number.isInteger))];

    for (const userId of recipients) {
      const clients = this.clients.get(userId);
      if (!clients) continue;
      for (const client of [...clients]) {
        let allowed = false;
        try {
          allowed = authorizeRecipient(client, payload) === true;
        } catch {
          allowed = false;
        }
        if (!allowed) continue;

        try {
          const recipientPayload =
            typeof payloadForRecipient === 'function'
              ? payloadForRecipient(client, payload)
              : payload;
          const envelope = JSON.stringify({ type, payload: recipientPayload });
          this.write(client, `event: ${type}\ndata: ${envelope}\n\n`);
        } catch {
          client.cleanup?.();
        }
      }
    }
  }

  /**
   * Escreve um chunk respeitando back-pressure.
   *
   * Socket lento: chunks entram em fila limitada por `maxWritableBytes`.
   * Fila estourada: cliente é desconectado. Nunca há crescimento ilimitado.
   */
  write(client, chunk) {
    if (!client || client.closed || client.res.destroyed || client.res.writableEnded) return false;
    const bytes = Buffer.byteLength(chunk, 'utf8');

    if (client.backpressured) {
      if (client.queueBytes + bytes > this.maxWritableBytes) {
        this.disconnectClient(client);
        return false;
      }
      client.queue.push(chunk);
      client.queueBytes += bytes;
      return false;
    }

    let ok;
    try {
      ok = client.res.write(chunk);
    } catch {
      client.cleanup?.();
      return false;
    }

    if (!ok) {
      /* Buffer cheio: marca como backpressured e aguarda 'drain'. */
      client.backpressured = true;
    }

    /* Limite absoluto: buffer do socket acima do teto desconecta o cliente. */
    const pending = Number(client.res.writableLength) || 0;
    if (pending > this.maxWritableBytes) {
      this.disconnectClient(client);
      return false;
    }
    return ok;
  }

  /** Reenvia eventos enfileirados após o socket drenar. */
  flushQueue(client) {
    if (!client || client.closed || client.res.destroyed || client.res.writableEnded) {
      if (client) {
        client.queue = [];
        client.queueBytes = 0;
      }
      return;
    }
    while (client.queue.length && !client.backpressured) {
      const chunk = client.queue.shift();
      client.queueBytes -= Buffer.byteLength(chunk, 'utf8');
      if (client.queueBytes < 0) client.queueBytes = 0;
      let ok;
      try {
        ok = client.res.write(chunk);
      } catch {
        client.cleanup?.();
        return;
      }
      if (!ok) {
        client.backpressured = true;
        break;
      }
    }
    if (!client.queue.length) client.queueBytes = 0;
  }

  /** Encerra uma conexão específica e remove seus listeners. */
  disconnectClient(client) {
    if (!client) return;
    client.cleanup?.();
    try {
      client.res.end();
    } catch {
      /* Conexão já encerrada. */
    }
  }

  /** Encerra todas as conexões de um usuário, por exemplo após logout. */
  disconnectUser(userId) {
    const normalizedId = Number(userId);
    const clients = this.clients.get(normalizedId);
    if (!clients) return;
    for (const client of [...clients]) {
      this.disconnectClient(client);
    }
    this.clients.delete(normalizedId);
  }

  /** Comentário SSE mantém proxies e ligações intermediárias abertas. */
  keepAlive() {
    for (const clients of this.clients.values()) {
      for (const client of [...clients]) {
        try {
          /* Revalida sessão periodicamente se callback fornecido. */
          if (this.isSessionActive) {
            if (!client.sessionToken || !this.isSessionActive(client.sessionToken, client.userId)) {
              this.disconnectClient(client);
              continue;
            }
          }
          /* Cliente lento não recebe keepalive: evita acumular fila sem uso. */
          if (client.backpressured) continue;
          this.write(client, ': keepalive\n\n');
        } catch {
          client.cleanup?.();
        }
      }
    }
  }

  close() {
    clearInterval(this.keepAliveTimer);
    for (const clients of this.clients.values()) {
      for (const client of [...clients]) {
        this.disconnectClient(client);
      }
    }
    this.clients.clear();
  }
}

module.exports = { SseHub };
