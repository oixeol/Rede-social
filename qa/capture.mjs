import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.QA_DB || path.join(here, '..', 'data', 'vibra.db');
const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const db = new DatabaseSync(DB_PATH);
const session = db.prepare('SELECT token FROM sessions ORDER BY created_at DESC LIMIT 1').get();
db.close();

if (!session) {
  console.error('Nenhuma sessao encontrada. Faca login antes de capturar.');
  process.exit(1);
}

const out = process.argv[2] || path.join(here, 'screen.png');
const width = Number(process.argv[3] || 1400);
const height = Number(process.argv[4] || 1000);
const fullPage = process.argv[5] === 'full';
const action = process.env.QA_ACTION || '';
const initialUrl = process.env.QA_URL || BASE_URL + '/';

const CDP_PORT = process.env.QA_CDP_PORT || '9333';
const endpoint = `http://127.0.0.1:${CDP_PORT}/json/list`;
const targets = await (await fetch(endpoint)).json();
const target = targets.find((item) => item.type === 'page');
if (!target) {
  console.error('Nenhuma pagina encontrada no Edge.');
  process.exit(1);
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
let loadResolve = null;

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  if (message.method === 'Page.loadEventFired' && loadResolve) {
    const resolve = loadResolve;
    loadResolve = null;
    resolve();
  }
};

await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pageErrors = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') {
    pageErrors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text);
  }
});

await send('Runtime.enable');
await send('Network.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: width < 600,
});
if (!process.env.QA_NO_COOKIE) {
  await send('Network.setCookie', {
    name: 'vibra_session',
    value: session.token,
    url: BASE_URL + '/',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });
}

const loaded = new Promise((resolve) => {
  loadResolve = resolve;
});
await send('Page.navigate', { url: initialUrl });
await Promise.race([loaded, delay(8000)]);
await delay(900);

if (action) {
  await send('Runtime.evaluate', { expression: action, awaitPromise: true });
  await delay(1100);
}

if (process.env.QA_DEBUG) {
  const probe = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      premid: document.body.innerText.includes('PreMid'),
      htmlHasPremid: document.documentElement.outerHTML.includes('PreMid'),
      userScripts: document.body.innerText.includes('User Scripts Permission'),
      feed: document.querySelector('.feed-grid')?.getBoundingClientRect().toJSON(),
      card: document.querySelector('.post-card')?.getBoundingClientRect().toJSON(),
      bottomNav: document.querySelector('.bottom-nav')?.getBoundingClientRect().toJSON()
    })`,
    returnByValue: true,
  });
  console.log('DEBUG', probe.result.value);
}

const metrics = await send('Page.getLayoutMetrics');
const content = metrics.cssContentSize;
const shot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: fullPage,
  ...(fullPage
    ? { clip: { x: 0, y: 0, width: content.width, height: Math.min(content.height, 7000), scale: 1 } }
    : {}),
});

fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(`${out} | ${width}x${height} | pagina ${Math.round(content.height)}px`);
if (pageErrors.length) {
  console.log(`ERROS DE PAGINA:\n${pageErrors.join('\n')}`);
}
socket.close();
process.exit(0);
