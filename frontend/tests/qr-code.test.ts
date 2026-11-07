import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { createQrCode } from '../src/lib/qr-code.ts';

const GOLDEN_TEXT = 'https://vibra.example/entrar';
const GOLDEN_SHA256 = '0d23bf345d550ea3cac66994c34bc1f0340cb20180d8a3fa3e558d4d9efe275d';

test('createQrCode returns stable matrix for known input', () => {
  const qrCode = createQrCode(GOLDEN_TEXT);

  assert.strictEqual(qrCode.size, 33);
  assert.strictEqual(
    createHash('sha256').update(qrCode.path).digest('hex'),
    GOLDEN_SHA256,
  );
});

test('createQrCode encodes UTF-8 content and numeric SVG path only', () => {
  const qrCode = createQrCode('Ação日本語😀');

  assert.ok(qrCode.size >= 21);
  assert.match(qrCode.path, /^(?:M\d+ \d+h1v1h-1z)+$/);
});

test('createQrCode rejects empty and oversized content', () => {
  assert.throws(() => createQrCode(''), /vazio/i);
  assert.throws(() => createQrCode('x'.repeat(1274)), /excede/i);
});
