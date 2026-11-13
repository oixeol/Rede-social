/**
 * Testes de integração para anexos de mensagem (ETAPA 2).
 *
 * Roda contra o servidor de demonstração ou temporário iniciado por qa/run-tests.mjs.
 * Cobre: envio de imagem, documento (PDF, DOCX, RTF, TXT, CSV), limites de tamanho,
 * transação atômica, limpeza de arquivos órfãos e leitura de anexos.
 */
import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  csvDataUrl,
  docDataUrl,
  docxDataUrl,
  makeDataUrl,
  pdfDataUrl,
  pngBuffer,
  pngDataUrl,
  rtfDataUrl,
  txtDataUrl,
} from './fixtures/message-attachments.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const DEMO_PASSWORD = process.env.VIBRA_DEMO_PASSWORD || '';
if (!DEMO_PASSWORD) {
  console.error('Defina VIBRA_DEMO_PASSWORD para testar contra um servidor com dados de demonstração.');
  process.exit(1);
}

let cookie = '';
let failures = 0;

function ok(label, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { ...options, headers });
  const setCookie = res.headers.getSetCookie?.() || [];
  for (const value of setCookie) {
    const pair = value.split(';')[0];
    if (pair.startsWith('vibra_session=')) {
      cookie = pair.endsWith('=') ? '' : pair;
    }
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data, headers: res.headers };
}

async function countMessages(convId) {
  const thread = await api(`/api/conversations/${convId}`);
  return thread.data?.messages?.length ?? 0;
}

async function runTests() {
  /* login demo */
  const login = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'vibra', password: DEMO_PASSWORD }),
  });
  ok('login demo', login.status === 200 && login.data.user.username === 'vibra');

  /* buscar conversas para achar a social existente com carla.arte */
  const convs = await api('/api/conversations');
  ok('conversas carregadas', convs.status === 200 && convs.data.conversations.length >= 1);
  const socialConv = convs.data.conversations.find(
    (c) => c.kind === 'social' && c.other.username === 'bruno.dev',
  );
  ok('conversa social com bruno.dev existe', !!socialConv);
  if (!socialConv) return;
  const convId = socialConv.id;

  /* abrir thread */
  const thread = await api(`/api/conversations/${convId}`);
  ok('thread carregada', thread.status === 200 && thread.data.messages.length >= 1);

  /* ---- 1. Enviar imagem válida ---- */
  const imgMsg = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'Imagem de teste',
      media: [{ dataUrl: pngDataUrl(), fileName: 'foto.png' }],
    }),
  });
  ok('enviar imagem', imgMsg.status === 201 && imgMsg.data.message.media?.length === 1);
  const imgMedia = imgMsg.data.message.media?.[0];
  ok('imagem tipo correto', imgMedia?.mediaType === 'image' && imgMedia?.mimeType === 'image/png');
  ok('imagem URL válida', imgMedia?.url?.startsWith('/uploads/'));

  /* ---- 2. Enviar documento PDF ---- */
  const pdfMsg = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'PDF de teste',
      media: [{ dataUrl: pdfDataUrl(), fileName: 'doc.pdf' }],
    }),
  });
  ok('enviar PDF', pdfMsg.status === 201 && pdfMsg.data.message.media?.length === 1);
  const pdfMedia = pdfMsg.data.message.media?.[0];
  ok('PDF tipo file', pdfMedia?.mediaType === 'file' && pdfMedia?.mimeType === 'application/pdf');

  /* ---- 3. Enviar DOCX ---- */
  const docxMsg = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'DOCX de teste',
      media: [{ dataUrl: docxDataUrl(), fileName: 'doc.docx' }],
    }),
  });
  ok('enviar DOCX', docxMsg.status === 201);
  const docxMedia = docxMsg.data.message.media?.[0];
  ok('DOCX mime correto', docxMedia?.mimeType?.includes('openxmlformats'));

  /* ---- 4. Enviar DOC ---- */
  const docMsg = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'DOC de teste',
      media: [{ dataUrl: docDataUrl(), fileName: 'doc.doc' }],
    }),
  });
  ok('enviar DOC', docMsg.status === 201);
  const docMedia = docMsg.data.message.media?.[0];
  ok('DOC mime correto', docMedia?.mimeType === 'application/msword');

  /* ---- 5. Enviar RTF ---- */
  const rtfMsg = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'RTF de teste',
      media: [{ dataUrl: rtfDataUrl(), fileName: 'doc.rtf' }],
    }),
  });
  ok('enviar RTF', rtfMsg.status === 201);
  const rtfMedia = rtfMsg.data.message.media?.[0];
  ok('RTF mime correto', rtfMedia?.mimeType === 'application/rtf');

  /* ---- 5. Enviar TXT ---- */
  const txtMsg = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'TXT de teste',
      media: [{ dataUrl: txtDataUrl(), fileName: 'readme.txt' }],
    }),
  });
  ok('enviar TXT', txtMsg.status === 201);
  const txtMedia = txtMsg.data.message.media?.[0];
  ok('TXT mime text/plain', txtMedia?.mimeType === 'text/plain');

  /* ---- 6. Enviar CSV ---- */
  const csvMsg = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'CSV de teste',
      media: [{ dataUrl: csvDataUrl(), fileName: 'dados.csv' }],
    }),
  });
  ok('enviar CSV', csvMsg.status === 201);
  const csvMedia = csvMsg.data.message.media?.[0];
  ok('CSV mime text/csv', csvMedia?.mimeType === 'text/csv');

  /* ---- 7. Anexos sem texto (apenas mídia) ---- */
  const onlyMedia = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: '',
      media: [{ dataUrl: pngDataUrl(), fileName: 'only.png' }],
    }),
  });
  ok('apenas anexo sem texto', onlyMedia.status === 201);

  /* ---- 8. Limite de 4 anexos ---- */
  const many = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'muitos',
      media: [
        { dataUrl: pngDataUrl(), fileName: '1.png' },
        { dataUrl: pngDataUrl(), fileName: '2.png' },
        { dataUrl: pngDataUrl(), fileName: '3.png' },
        { dataUrl: pngDataUrl(), fileName: '4.png' },
        { dataUrl: pngDataUrl(), fileName: '5.png' },
      ],
    }),
  });
  ok('rejeita >4 anexos', many.status === 400);

  /* ---- 10. Imagem > 8 MB (PNG válido com padding) ---- */
  const bigImg = pngBuffer(9 * 1024 * 1024);
  const bigMsg = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'grande',
      media: [{ dataUrl: makeDataUrl(bigImg, 'image/png'), fileName: 'big.png' }],
    }),
  });
  ok('rejeita imagem >8MB', bigMsg.status === 413);

  /* ---- 10. Documento > 25 MB ---- */
  const bigPdfHead = Buffer.from('%PDF-1.4\n');
  const bigPdfTail = Buffer.from('\n%%EOF\n');
  const bigDoc = Buffer.concat([
    bigPdfHead,
    Buffer.alloc(26 * 1024 * 1024, 0x20),
    bigPdfTail,
  ]);
  const bigDocMsg = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'grande',
      media: [{ dataUrl: makeDataUrl(bigDoc, 'application/pdf'), fileName: 'big.pdf' }],
    }),
  });
  ok('rejeita doc >25MB', bigDocMsg.status === 413);

  /* ---- 11. Total > 25 MB (4 docs ~6.5MB cada = 26MB) ---- */
  const med = Buffer.alloc(6.5 * 1024 * 1024, 0x20);
  const totalMsg = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'total',
      media: [
        { dataUrl: makeDataUrl(med, 'text/plain'), fileName: 'a.txt' },
        { dataUrl: makeDataUrl(med, 'text/plain'), fileName: 'b.txt' },
        { dataUrl: makeDataUrl(med, 'text/plain'), fileName: 'c.txt' },
        { dataUrl: makeDataUrl(med, 'text/plain'), fileName: 'd.txt' },
      ],
    }),
  });
  ok('rejeita total >25MB', totalMsg.status === 413);

  /* ---- 12. MIME declarado é ignorado; conteúdo e extensão precisam concordar ---- */
  const spoofedMime = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'spoof',
      media: [{ dataUrl: makeDataUrl(Buffer.from('%PDF-1.4\n%%EOF\n'), 'image/png'), fileName: 'falso.png' }],
    }),
  });
  ok('rejeita MIME/extensão adulterados', spoofedMime.status === 400);

  const spoofedExtension = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'spoof',
      media: [{ dataUrl: pngDataUrl(), fileName: 'falso.pdf' }],
    }),
  });
  ok('rejeita extensão que não corresponde aos bytes', spoofedExtension.status === 400);

  /* ---- 13. Texto estrito: UTF-8 inválido e controles são recusados ---- */
  const invalidUtf8 = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'utf8',
      media: [{ dataUrl: makeDataUrl(Buffer.from([0xff, 0xfe, 0x41]), 'text/plain'), fileName: 'invalido.txt' }],
    }),
  });
  ok('rejeita UTF-8 inválido', invalidUtf8.status === 400);

  const controlBytes = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'controle',
      media: [{ dataUrl: makeDataUrl(Buffer.from([0x41, 0x00, 0x42]), 'text/plain'), fileName: 'controle.txt' }],
    }),
  });
  ok('rejeita bytes de controle em texto', controlBytes.status === 400);

  const inconsistentCsv = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'csv',
      media: [{ dataUrl: csvDataUrl('a,b\n1,2,3'), fileName: 'inconsistente.csv' }],
    }),
  });
  ok('rejeita CSV estrutural com extensão CSV inconsistente', inconsistentCsv.status === 400);

  const oneColumnCsv = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'csv coluna única',
      media: [{ dataUrl: csvDataUrl('nome\nAna\nBruno'), fileName: 'coluna.csv' }],
    }),
  });
  ok(
    'aceita CSV de coluna única com vários registros',
    oneColumnCsv.status === 201 && oneColumnCsv.data.message?.media?.[0]?.mimeType === 'text/csv'
  );

  const csvAsTxt = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'csv com extensão txt',
      media: [{ dataUrl: csvDataUrl('a,b\n1,2'), fileName: 'dados.txt' }],
    }),
  });
  ok('rejeita CSV estrutural declarado como TXT', csvAsTxt.status === 400);

  const inconsistentCsvAsTxt = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'texto inconsistente',
      media: [{ dataUrl: csvDataUrl('a,b\n1,2,3'), fileName: 'inconsistente.txt' }],
    }),
  });
  ok(
    'aceita CSV inconsistente como TXT quando extensão concorda',
    inconsistentCsvAsTxt.status === 201 &&
      inconsistentCsvAsTxt.data.message?.media?.[0]?.mimeType === 'text/plain'
  );

  /* ---- 14. Formato não suportado (GIF) ---- */
  const gifBuf = Buffer.from('GIF89a', 'binary');
  const gifMsg = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'gif',
      media: [{ dataUrl: makeDataUrl(gifBuf, 'image/gif'), fileName: 'test.gif' }],
    }),
  });
  ok('rejeita GIF', gifMsg.status === 400);

  /* ---- 15. Transação atômica: falha ao inserir mídia não cria mensagem ---- */
  const countBeforeFail = await countMessages(convId);
  const failMsg = await api(`/api/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'deve falhar',
      media: [{ dataUrl: makeDataUrl(gifBuf, 'image/gif'), fileName: 'fail.gif' }],
    }),
  });
  ok('falha mídia retorna erro', failMsg.status === 400);
  const countAfterFail = await countMessages(convId);
  ok('mensagem não persistida na falha', countAfterFail === countBeforeFail);

  /* ---- 16. Rollback + cleanup quando persistência de anexo falha ---- */
  const isolatedDataDir = process.env.VIBRA_DATA_DIR ? path.resolve(process.env.VIBRA_DATA_DIR) : '';
  const isolatedDbPath = isolatedDataDir ? path.join(isolatedDataDir, 'vibra.db') : '';
  const uploadsDir = isolatedDataDir ? path.join(isolatedDataDir, 'uploads') : '';
  const canForceRollback =
    process.env.NODE_ENV === 'test' &&
    Boolean(isolatedDbPath) &&
    existsSync(isolatedDbPath) &&
    path.dirname(isolatedDataDir) === path.resolve(os.tmpdir());

  if (canForceRollback) {
    const testDb = new DatabaseSync(isolatedDbPath);
    testDb.exec('PRAGMA busy_timeout = 5000');
    const filesBefore = existsSync(uploadsDir) ? readdirSync(uploadsDir).length : 0;
    const countBeforeRollback = await countMessages(convId);
    try {
      testDb.exec(
        "CREATE TRIGGER qa_fail_message_media BEFORE INSERT ON message_media BEGIN SELECT RAISE(ABORT, 'forced failure'); END;",
      );
      const rollbackMsg = await api(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          text: 'rollback',
          media: [{ dataUrl: pngDataUrl(), fileName: 'rollback.png' }],
        }),
      });
      ok('falha de persistência retorna erro', rollbackMsg.status >= 400);
      const countAfterRollback = await countMessages(convId);
      ok('transação faz rollback da mensagem', countAfterRollback === countBeforeRollback);
      const filesAfter = existsSync(uploadsDir) ? readdirSync(uploadsDir).length : 0;
      ok('arquivo órfão removido após rollback', filesAfter === filesBefore);
    } finally {
      try {
        testDb.exec('DROP TRIGGER IF EXISTS qa_fail_message_media;');
      } catch {
        /* trigger já removido */
      }
      testDb.close();
    }
  } else {
    console.log('SKIP  rollback/cleanup exige banco temporário isolado');
  }

  /* ---- 17. Anexo exige autenticação e membership da conversa ---- */
  const attachmentUrl = imgMedia?.url;
  const memberCookie = cookie;
  if (attachmentUrl) {
    const anonymous = await fetch(`${BASE}${attachmentUrl}`);
    ok('anônimo não lê anexo', anonymous.status === 404);

    const memberRead = await fetch(`${BASE}${attachmentUrl}`, { headers: { Cookie: memberCookie } });
    ok('membro lê anexo', memberRead.status === 200);
    ok('MIME canônico da imagem', memberRead.headers.get('content-type') === 'image/png');
    ok('imagem não força download', !memberRead.headers.get('content-disposition'));

    if (pdfMedia?.url) {
      const pdfRead = await fetch(`${BASE}${pdfMedia.url}`, { headers: { Cookie: memberCookie } });
      ok('MIME canônico do PDF', pdfRead.headers.get('content-type') === 'application/pdf');
      ok(
        'documento força download',
        pdfRead.headers.get('content-disposition')?.startsWith('attachment;') === true,
        pdfRead.headers.get('content-disposition') || ''
      );
    }

    const outsiderLogin = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'ana.souza', password: DEMO_PASSWORD }),
    });
    ok('login outsider para teste de anexo', outsiderLogin.status === 200);
    if (outsiderLogin.status === 200) {
      const outsiderRead = await fetch(`${BASE}${attachmentUrl}`, { headers: { Cookie: cookie } });
      ok('usuário fora da conversa não lê anexo', outsiderRead.status === 404);
    }
    cookie = memberCookie;
  }

  /* ---- 18. Bloqueio remove acesso privado ao anexo ---- */
  const block = await api('/api/users/bruno.dev/block', {
    method: 'PUT',
    body: JSON.stringify({ blocked: true }),
  });
  ok('bloqueio de teste aplicado', block.status === 200 && block.data.blocked === true);
  if (attachmentUrl) {
    const blockedRead = await fetch(`${BASE}${attachmentUrl}`, { headers: { Cookie: memberCookie } });
    ok('bloqueio impede leitura do anexo', blockedRead.status === 404);
  }
  await api('/api/users/bruno.dev/block', { method: 'DELETE' });

  /* ---- 19. Mensagem excluída não deixa anexo acessível ---- */
  if (canForceRollback && imgMsg.data.message?.id) {
    const testDb = new DatabaseSync(isolatedDbPath);
    try {
      testDb.prepare('UPDATE messages SET deleted_at = ? WHERE id = ?').run(Date.now(), imgMsg.data.message.id);
      const deletedRead = await fetch(`${BASE}${attachmentUrl}`, { headers: { Cookie: memberCookie } });
      ok('mensagem excluída bloqueia leitura do anexo', deletedRead.status === 404);
    } finally {
      testDb.close();
    }
  }

  /* ---- 20. Dating-ineligible access check ---- */
  const dateConvs = await api('/api/conversations');
  const datingConv = dateConvs.data?.conversations?.find((c) => c.kind === 'dating');
  if (datingConv) {
    const expiredDatingRead = await fetch(`${BASE}/uploads/message-qa-ineligible.png`, {
      headers: { Cookie: memberCookie },
    });
    ok('URL inexistente ou dating sem permissão devolve 404', expiredDatingRead.status === 404);
  }

  /* ---- 21. Ler anexos na thread ---- */
  const threadAfter = await api(`/api/conversations/${convId}`);
  ok('thread com anexos', threadAfter.status === 200 && threadAfter.data.messages.some((m) => m.media?.length));
  const msgWithMedia = threadAfter.data.messages.find((m) => m.media?.length);
  ok('mensagem tem media array', !!msgWithMedia?.media?.length);
  if (msgWithMedia?.media?.length) {
    const m = msgWithMedia.media[0];
    ok('media campos esperados', typeof m.url === 'string' && typeof m.mediaType === 'string' && typeof m.mimeType === 'string');
  }

  console.log('Testes de anexos concluídos.');
}

runTests().catch((err) => {
  console.error('Erro fatal no teste de anexos:', err);
  process.exit(1);
}).finally(() => {
  if (failures) process.exit(1);
});