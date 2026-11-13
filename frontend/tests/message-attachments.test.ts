import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyMessageAttachment,
  MAX_MESSAGE_ATTACHMENTS,
  MAX_MESSAGE_DOCUMENT_BYTES,
  MAX_MESSAGE_IMAGE_BYTES,
  MAX_MESSAGE_TOTAL_BYTES,
  validateMessageAttachment,
} from '../src/lib/message-attachments.ts';

function file(name: string, size: number, type = ''): File {
  return { name, size, type } as File;
}

test('classifica imagens permitidas', () => {
  assert.equal(classifyMessageAttachment(file('foto.png', 10, 'image/png')), 'image');
  assert.equal(classifyMessageAttachment(file('foto.JPG', 10, 'image/jpeg')), 'image');
  assert.equal(classifyMessageAttachment(file('foto.webp', 10, 'image/webp')), 'image');
  assert.equal(classifyMessageAttachment(file('foto.png', 10, '')), 'image');
});

test('classifica documentos permitidos', () => {
  assert.equal(classifyMessageAttachment(file('a.pdf', 10, 'application/pdf')), 'file');
  assert.equal(classifyMessageAttachment(file('a.doc', 10, 'application/msword')), 'file');
  assert.equal(
    classifyMessageAttachment(
      file('a.docx', 10, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ),
    'file',
  );
  assert.equal(classifyMessageAttachment(file('a.rtf', 10, 'application/rtf')), 'file');
  assert.equal(classifyMessageAttachment(file('a.txt', 10, 'text/plain')), 'file');
  assert.equal(classifyMessageAttachment(file('a.csv', 10, 'text/csv')), 'file');
  assert.equal(classifyMessageAttachment(file('a.csv', 10, '')), 'file');
});

test('recusa GIF e formatos fora da lista', () => {
  assert.equal(classifyMessageAttachment(file('a.gif', 10, 'image/gif')), null);
  assert.equal(classifyMessageAttachment(file('a.gif', 10, '')), null);
  assert.equal(classifyMessageAttachment(file('a.mp4', 10, 'video/mp4')), null);
  assert.equal(classifyMessageAttachment(file('a.exe', 10, 'application/octet-stream')), null);
});

test('recusa imagem acima de 8 MB', () => {
  const error = validateMessageAttachment(
    file('grande.png', MAX_MESSAGE_IMAGE_BYTES + 1, 'image/png'),
  );
  assert.match(error ?? '', /8 MB/);
});

test('recusa documento acima de 25 MB', () => {
  const error = validateMessageAttachment(
    file('grande.pdf', MAX_MESSAGE_DOCUMENT_BYTES + 1, 'application/pdf'),
  );
  assert.match(error ?? '', /25 MB/);
});

test('recusa total acima de 25 MB', () => {
  const chunk = 9 * 1024 * 1024;
  const existing = Array.from({ length: 2 }, () => ({ sizeBytes: chunk }));
  const error = validateMessageAttachment(file('a.txt', chunk, 'text/plain'), existing);
  assert.match(error ?? '', /total de 25 MB/);
});

test('recusa mais de 4 anexos', () => {
  const existing = Array.from({ length: MAX_MESSAGE_ATTACHMENTS }, () => ({ sizeBytes: 10 }));
  const error = validateMessageAttachment(file('a.png', 10, 'image/png'), existing);
  assert.match(error ?? '', /no máximo 4/);
});

test('aceita anexos dentro dos limites', () => {
  assert.equal(validateMessageAttachment(file('ok.png', 1024, 'image/png')), null);
  assert.equal(validateMessageAttachment(file('ok.csv', 1024, 'text/csv')), null);
});
