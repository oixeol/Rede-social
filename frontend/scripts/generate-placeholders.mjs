/**
 * Gera os placeholders de imagem do perfil (frontend/public/images).
 * Uso: node scripts/generate-placeholders.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'public', 'images');
fs.mkdirSync(outDir, { recursive: true });

const BLACK = '#050505';
const CHARCOAL = '#0B0B0B';
const GRAPHITE = '#101010';
const SLATE = '#242424';
const STEEL = '#3F3F46';
const SILVER = '#71717A';
const LIGHT_GRAY = '#A1A1AA';
const OFF_WHITE = '#FFFFFF';
const WHITE = '#FFFFFF';
const ORANGE = '#FF6A00';
const AMBER = '#FF8C00';
const DEEP_ORANGE = '#FF4500';

function svg(width, height, body) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`,
  );
}

function write(name, buffer) {
  const target = path.join(outDir, name);
  fs.writeFileSync(target, buffer);
  console.log('wrote', target);
}

async function banner() {
  const w = 1536;
  const h = 640;
  const body = `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${BLACK}"/>
        <stop offset="0.55" stop-color="${GRAPHITE}"/>
        <stop offset="1" stop-color="${SLATE}"/>
      </linearGradient>
      <radialGradient id="moon" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="${WHITE}"/>
        <stop offset="0.75" stop-color="${OFF_WHITE}"/>
        <stop offset="1" stop-color="${LIGHT_GRAY}"/>
      </radialGradient>
      <linearGradient id="cloud" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${STEEL}" stop-opacity="0.8"/>
        <stop offset="1" stop-color="${SILVER}" stop-opacity="0.3"/>
      </linearGradient>
      <linearGradient id="scarf" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${ORANGE}" stop-opacity="0.9"/>
        <stop offset="1" stop-color="${DEEP_ORANGE}" stop-opacity="0.35"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/>
    <circle cx="${w - 220}" cy="120" r="78" fill="url(#moon)"/>
    <circle cx="${w - 190}" cy="100" r="12" fill="${SILVER}" opacity="0.45"/>
    <circle cx="${w - 250}" cy="140" r="8" fill="${SILVER}" opacity="0.35"/>
    <path d="M0 150 C220 100 420 200 640 160 C860 120 1040 210 1536 150 L1536 0 L0 0Z" fill="url(#cloud)" opacity="0.42"/>
    <path d="M0 230 C260 180 520 280 800 220 C1080 160 1280 260 1536 210 L1536 90 L0 90Z" fill="url(#cloud)" opacity="0.28"/>
    <path d="M0 470 L170 430 L340 480 L520 420 L700 470 L880 410 L1060 465 L1250 415 L1536 470 L1536 640 L0 640Z" fill="${BLACK}"/>
    <g fill="${ORANGE}" opacity="0.9">
      <rect x="140" y="500" width="8" height="12"/><rect x="210" y="520" width="7" height="10"/>
      <rect x="300" y="505" width="8" height="12"/><rect x="430" y="525" width="7" height="10"/>
      <rect x="700" y="515" width="8" height="12"/><rect x="880" y="530" width="7" height="10"/>
      <rect x="1080" y="505" width="8" height="12"/><rect x="1240" y="525" width="7" height="10"/>
    </g>
    <g transform="translate(1180 400)">
      <path d="M0 120 L0 40 L40 0 L120 40 L120 120Z" fill="${CHARCOAL}"/>
      <path d="M-14 44 L40 -4 L138 44 L126 60 L40 20 L-2 60Z" fill="${SLATE}"/>
      <rect x="52" y="72" width="26" height="48" fill="${AMBER}" opacity="0.95"/>
    </g>
    <g transform="translate(430 300)">
      <ellipse cx="80" cy="150" rx="70" ry="22" fill="${BLACK}" opacity="0.85"/>
      <path d="M40 150 C40 60 120 60 120 150Z" fill="${CHARCOAL}"/>
      <circle cx="80" cy="46" r="30" fill="${GRAPHITE}"/>
      <path d="M28 128 C20 78 60 60 96 78 C120 92 126 118 120 150Z" fill="${SLATE}"/>
      <path d="M4 96 C40 78 96 96 132 122 C150 136 136 152 112 146 C74 136 34 124 4 118Z" fill="url(#scarf)" opacity="0.95"/>
    </g>
    <g transform="translate(120 240)" fill="${BLACK}">
      <path d="M0 200 L26 96 L14 96 L40 40 L66 96 L54 96 L80 200Z"/>
      <path d="M40 60 C20 20 60 -6 84 18 C104 38 88 74 60 82 C38 88 26 70 30 52 C46 62 62 52 62 36 C50 44 40 52 40 60Z"/>
    </g>
  `;
  write('banner.jpg', await sharp(svg(w, h, body)).jpeg({ quality: 88 }).toBuffer());
}

async function avatar() {
  const size = 400;
  const body = `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${AMBER}"/>
        <stop offset="1" stop-color="${DEEP_ORANGE}"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>
    <circle cx="${size / 2}" cy="${size / 2 - 18}" r="66" fill="${CHARCOAL}" opacity="0.58"/>
    <path d="M96 ${size} C110 ${size - 120} 290 ${size - 120} 304 ${size}Z" fill="${CHARCOAL}" opacity="0.58"/>
    <path d="M150 120 L200 60 L250 120 L230 138 L170 138Z" fill="${WHITE}" opacity="0.9"/>
  `;
  write('avatar.jpg', await sharp(svg(size, size, body)).jpeg({ quality: 90 }).toBuffer());
}

async function postOne() {
  const w = 800;
  const h = 800;
  const body = `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${BLACK}"/>
        <stop offset="1" stop-color="${SLATE}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/>
    <circle cx="600" cy="170" r="70" fill="${OFF_WHITE}"/>
    <path d="M0 520 L160 470 L320 530 L500 450 L660 520 L800 470 L800 800 L0 800Z" fill="${BLACK}"/>
    <g fill="${ORANGE}" opacity="0.9">
      <rect x="90" y="600" width="10" height="14"/><rect x="190" y="630" width="9" height="12"/>
      <rect x="330" y="610" width="10" height="14"/><rect x="470" y="635" width="9" height="12"/>
      <rect x="620" y="615" width="10" height="14"/>
    </g>
  `;
  write('post-1.jpg', await sharp(svg(w, h, body)).jpeg({ quality: 88 }).toBuffer());
}

async function postTwo() {
  const w = 800;
  const h = 800;
  const body = `
    <rect width="${w}" height="${h}" fill="${CHARCOAL}"/>
    <path d="M0 600 L200 520 L420 600 L620 540 L800 610 L800 800 L0 800Z" fill="${BLACK}"/>
    <g transform="translate(360 380)" fill="${OFF_WHITE}">
      <circle cx="40" cy="0" r="34"/>
      <path d="M6 52 C2 100 74 110 78 62 C60 74 26 74 6 52Z"/>
      <path d="M0 130 C20 96 66 96 92 130 L110 250 L-20 250Z"/>
      <path d="M-6 150 C-46 176 -56 208 -50 236 C-24 222 -6 200 4 178Z"/>
    </g>
    <g fill="${SLATE}">
      <rect x="60" y="300" width="160" height="300"/>
      <rect x="600" y="260" width="140" height="340"/>
    </g>
    <g stroke="${OFF_WHITE}" stroke-width="6" fill="none" opacity="0.75">
      <path d="M360 92 C300 92 296 34 334 26"/>
      <path d="M440 92 C500 92 504 34 466 26"/>
    </g>
  `;
  write('post-2.jpg', await sharp(svg(w, h, body)).jpeg({ quality: 88 }).toBuffer());
}

async function postThree() {
  const w = 800;
  const h = 800;
  const body = `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${BLACK}"/>
        <stop offset="1" stop-color="${SLATE}"/>
      </linearGradient>
      <linearGradient id="tree" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${AMBER}"/>
        <stop offset="1" stop-color="${DEEP_ORANGE}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/>
    <circle cx="640" cy="140" r="56" fill="${OFF_WHITE}" opacity="0.95"/>
    <g transform="translate(180 140)">
      <path d="M90 420 C80 300 60 240 10 190 M90 420 C110 320 180 280 250 250 M90 420 C70 330 30 300 -40 270" stroke="${STEEL}" stroke-width="26" fill="none" stroke-linecap="round"/>
      <circle cx="10" cy="180" r="74" fill="url(#tree)" opacity="0.95"/>
      <circle cx="240" cy="240" r="66" fill="url(#tree)" opacity="0.9"/>
      <circle cx="-30" cy="260" r="58" fill="url(#tree)" opacity="0.85"/>
      <circle cx="120" cy="120" r="70" fill="url(#tree)" opacity="0.95"/>
      <circle cx="180" cy="160" r="52" fill="${WHITE}" opacity="0.8"/>
    </g>
    <g transform="translate(560 420)">
      <path d="M0 110 L0 30 L70 -14 L140 30 L140 110Z" fill="${CHARCOAL}"/>
      <path d="M-14 34 L70 -18 L154 34 L142 50 L70 8 L-2 50Z" fill="${GRAPHITE}"/>
      <rect x="56" y="62" width="28" height="48" fill="${AMBER}" opacity="0.95"/>
    </g>
    <path d="M0 640 L200 600 L420 650 L640 590 L800 640 L800 800 L0 800Z" fill="${BLACK}"/>
  `;
  write('post-3.jpg', await sharp(svg(w, h, body)).jpeg({ quality: 88 }).toBuffer());
}

async function postFour() {
  const w = 800;
  const h = 800;
  const body = `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${BLACK}"/>
        <stop offset="1" stop-color="${GRAPHITE}"/>
      </linearGradient>
      <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${ORANGE}"/>
        <stop offset="0.5" stop-color="${AMBER}"/>
        <stop offset="1" stop-color="${DEEP_ORANGE}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <g fill="none" stroke="url(#wave)" stroke-linecap="round">
      <path d="M-40 220 C120 120 240 320 400 220 C560 120 680 300 840 200" stroke-width="16" opacity="0.95"/>
      <path d="M-40 320 C120 220 240 420 400 320 C560 220 680 400 840 300" stroke-width="12" opacity="0.7"/>
      <path d="M-40 420 C120 320 240 520 400 420 C560 320 680 500 840 400" stroke-width="9" opacity="0.5"/>
      <path d="M-40 520 C120 420 240 620 400 520 C560 420 680 600 840 500" stroke-width="6" opacity="0.32"/>
      <path d="M-40 620 C120 520 240 720 400 620 C560 520 680 700 840 600" stroke-width="4" opacity="0.2"/>
    </g>
    <circle cx="620" cy="180" r="70" fill="${ORANGE}" opacity="0.18"/>
  `;
  write('post-4.jpg', await sharp(svg(w, h, body)).jpeg({ quality: 88 }).toBuffer());
}

async function suggestionAvatar(name, shade) {
  const size = 240;
  const body = `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${shade}"/>
        <stop offset="1" stop-color="${BLACK}"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>
    <circle cx="${size / 2}" cy="${size / 2 - 14}" r="42" fill="${BLACK}" opacity="0.62"/>
    <path d="M56 ${size} C64 ${size - 76} 176 ${size - 76} 184 ${size}Z" fill="${BLACK}" opacity="0.62"/>
    <circle cx="${size - 34}" cy="34" r="16" fill="${ORANGE}" opacity="0.85"/>
    <text x="${size / 2}" y="${size / 2 + 52}" font-family="Inter, sans-serif" font-size="42" font-weight="700" fill="${WHITE}" opacity="0.88" text-anchor="middle">${name}</text>
  `;
  write(name, await sharp(svg(size, size, body)).jpeg({ quality: 90 }).toBuffer());
}

await banner();
await avatar();
await postOne();
await postTwo();
await postThree();
await postFour();
await suggestionAvatar('avatar-lucasfps.jpg', SLATE);
await suggestionAvatar('avatar-ana.jpg', STEEL);
await suggestionAvatar('avatar-darkzera.jpg', GRAPHITE);

console.log('placeholders concluídos');
