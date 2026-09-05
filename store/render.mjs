/**
 * ShyText App Store cards — warm-paper compositor (v3).
 *
 * 1290×2796 PNGs (6.7" App Store portrait) on the app's own world:
 * warm paper, flame accents, story bars, statement + echo, and a fully
 * visible iPhone frame so the screenshot content reads. Bookend cards carry
 * a printed "postcard" still (Higgsfield) and the flame closer.
 *
 * Screenshots: store/screens/card-{2..5}.png (JPEG or PNG — bytes are sniffed).
 * Usage: npm run render   → store/out/
 */
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'out');
const OUT_65 = join(OUT, '6.5-inch');
mkdirSync(OUT, { recursive: true });
mkdirSync(OUT_65, { recursive: true });

const W = 1290;
const H = 2796;

// The app's light theme, verbatim.
const PAPER = '#FCF3E8';
const INK = '#1C120E';
const MUTED = '#6B5344';
const FLAME = '#D05927';
const LINEC = '#E9DCCC';
const BEZEL = '#141210';
const STATUS = '#F6F1EA';

function dataUri(path, mime) {
  const buf = readFileSync(path);
  // Trust the bytes, not the extension — phone transfers rename JPEGs to .PNG.
  const sniffed =
    buf[0] === 0xff && buf[1] === 0xd8
      ? 'image/jpeg'
      : buf[0] === 0x89 && buf[1] === 0x50
        ? 'image/png'
        : mime;
  return `data:${sniffed};base64,${buf.toString('base64')}`;
}

const flamePng = dataUri(join(ROOT, 'flame-lit.png'), 'image/png');

function assetUri(rel, mime = 'image/jpeg') {
  const path = join(ROOT, rel);
  return existsSync(path) ? dataUri(path, mime) : null;
}

function screenUri(cardId) {
  const path = join(ROOT, 'screens', `card-${cardId}.png`);
  return existsSync(path) ? dataUri(path, 'image/png') : null;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function storyBars(lit) {
  const groupW = 520;
  const gap = 12;
  const barW = (groupW - gap * 2) / 3;
  const x0 = (W - groupW) / 2;
  return [0, 1, 2]
    .map((i) => {
      const x = x0 + i * (barW + gap);
      return `<rect x="${x}" y="150" width="${barW}" height="9" rx="4.5" fill="${i < lit ? FLAME : LINEC}"/>`;
    })
    .join('\n');
}

function titleBlock({ lines, echo, y, size = 104, lineHeight = 114 }) {
  const statement = lines
    .map(
      (line, i) =>
        `<text x="${W / 2}" y="${y + i * lineHeight}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${size}" letter-spacing="-3" fill="${INK}">${esc(line)}</text>`
    )
    .join('\n');
  const echoY = y + lines.length * lineHeight + 18;
  return (
    statement +
    `\n<text x="${W / 2}" y="${echoY}" text-anchor="middle" font-family="Inter" font-weight="500" font-size="50" fill="${MUTED}">${esc(echo)}</text>`
  );
}

/** Fully visible iPhone: nothing important gets cut. */
function device(cardId) {
  const outerW = 930;
  const inset = 20;
  const screenW = outerW - inset * 2;
  const screenH = Math.round((screenW * 2796) / 1290);
  const outerH = screenH + inset * 2;
  const x = (W - outerW) / 2;
  const y = 700;
  const rOuter = 142;
  const rScreen = 122;
  const screenX = x + inset;
  const screenY = y + inset;
  const statusH = 132;

  const shot = screenUri(cardId);
  const screenContent = shot
    ? `<rect x="${screenX}" y="${screenY}" width="${screenW}" height="${statusH + rScreen}" fill="${STATUS}" clip-path="url(#screen-${cardId})"/>
       <image href="${shot}" x="${screenX}" y="${screenY + statusH}" width="${screenW}" height="${screenH - statusH}" preserveAspectRatio="xMidYMin slice" clip-path="url(#screen-${cardId})"/>`
    : `<rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" fill="${STATUS}" clip-path="url(#screen-${cardId})"/>
       <image href="${flamePng}" x="${W / 2 - 90}" y="${screenY + screenH / 2 - 90}" width="180" height="180" opacity="0.2"/>`;

  const islandW = 276;
  const island = `<rect x="${(W - islandW) / 2}" y="${screenY + 26}" width="${islandW}" height="76" rx="38" fill="${BEZEL}"/>`;

  return `
    <clipPath id="screen-${cardId}"><rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="${rScreen}"/></clipPath>
    <rect x="${x - 30}" y="${y + 44}" width="${outerW + 60}" height="${outerH}" rx="${rOuter + 24}" fill="#3A281C" opacity="0.35" filter="url(#soft)"/>
    <rect x="${x}" y="${y}" width="${outerW}" height="${outerH}" rx="${rOuter}" fill="${BEZEL}"/>
    ${screenContent}
    ${island}
    <rect x="${x + 3}" y="${y + 3}" width="${outerW - 6}" height="${outerH - 6}" rx="${rOuter - 3}" fill="none" stroke="rgba(28,18,14,0.18)" stroke-width="2.5"/>
  `;
}

/** Photo printed on the paper like a postcard from the venue. */
function postcard(rel, y) {
  const uri = assetUri(rel);
  if (!uri) return '';
  const cardW = 1010;
  const cardH = 700;
  const x = (W - cardW) / 2;
  const r = 44;
  return `
    <clipPath id="postcard"><rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="${r}"/></clipPath>
    <rect x="${x - 24}" y="${y + 34}" width="${cardW + 48}" height="${cardH}" rx="${r + 18}" fill="#3A281C" opacity="0.30" filter="url(#soft)"/>
    <rect x="${x - 16}" y="${y - 16}" width="${cardW + 32}" height="${cardH + 32}" rx="${r + 14}" fill="#FFFFFF"/>
    <image href="${uri}" x="${x}" y="${y}" width="${cardW}" height="${cardH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#postcard)"/>
  `;
}

function wordmarkCentered(y) {
  const flameSize = 72;
  const textSize = 58;
  const gapX = 16;
  const textW = textSize * 0.56 * 7;
  const total = flameSize + gapX + textW;
  const x0 = (W - total) / 2;
  return `
    <image href="${flamePng}" x="${x0}" y="${y - flameSize + 12}" width="${flameSize}" height="${flameSize}"/>
    <text x="${x0 + flameSize + gapX}" y="${y}" font-family="Inter" font-weight="700" font-size="${textSize}" letter-spacing="-1" fill="${FLAME}">shytext</text>
  `;
}

function card(spec) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="emberGlow" cx="0.5" cy="0.06" r="0.75">
      <stop offset="0" stop-color="${FLAME}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${FLAME}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="40"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0 0.08  0 0 0 0.04 0"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect width="${W}" height="${H}" fill="url(#emberGlow)"/>

  ${storyBars(spec.lit)}
  ${titleBlock(spec)}
  ${spec.device ? device(spec.id) : ''}
  ${spec.postcard ? postcard(spec.postcard, spec.postcardY ?? 1450) : ''}
  ${spec.bigFlame ? `<image href="${flamePng}" x="${(W - 480) / 2}" y="1330" width="480" height="480"/>` : ''}
  ${spec.wordmark ? wordmarkCentered(H - 170) : ''}

  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.5"/>
</svg>`;
}

const CARDS = [
  {
    id: 1,
    lit: 1,
    lines: ['There’s a moment', 'before hello.'],
    echo: 'ShyText lives there.',
    y: 620,
    device: false,
    postcard: 'bg/terrace.jpg',
    postcardY: 1330,
    bigFlame: false,
    wordmark: true,
  },
  {
    id: 2,
    lit: 2,
    lines: ['Shyne when', 'you’re open.'],
    echo: 'A quiet signal to the room.',
    y: 380,
    device: true,
    wordmark: false,
  },
  {
    id: 3,
    lit: 2,
    lines: ['See who’s', 'open here.'],
    echo: 'Nobody shows up by accident.',
    y: 380,
    device: true,
    wordmark: false,
  },
  {
    id: 4,
    lit: 3,
    lines: ['One note.', 'One person.'],
    echo: 'No feed. No swiping. No map.',
    y: 380,
    device: true,
    wordmark: false,
  },
  {
    id: 5,
    lit: 3,
    lines: ['They accept.', 'You chat.'],
    echo: 'The rest happens offline.',
    y: 380,
    device: true,
    wordmark: false,
  },
  {
    id: 6,
    lit: 3,
    lines: ['Never on a map.'],
    echo: 'A venue name — never a pin.',
    y: 900,
    device: false,
    bigFlame: true,
    wordmark: true,
  },
];

const fontFiles = [
  join(ROOT, 'fonts', 'Inter-Medium.ttf'),
  join(ROOT, 'fonts', 'Inter-Bold.ttf'),
  join(ROOT, 'fonts', 'Inter-ExtraBold.ttf'),
].filter((f) => existsSync(f));

for (const spec of CARDS) {
  const svg = card(spec);
  const resvg = new Resvg(svg, {
    font: { fontFiles, loadSystemFonts: fontFiles.length === 0, defaultFontFamily: 'Inter' },
  });
  const png = resvg.render().asPng();
  const file = join(OUT, `appstore-card-${spec.id}.png`);
  writeFileSync(file, png);

  // App Store Connect 6.5" slot wants exactly 1284×2778 — 0.2% rescale, invisible.
  const file65 = join(OUT_65, `appstore-card-${spec.id}.png`);
  await sharp(png).resize(1284, 2778, { fit: 'fill' }).png().toFile(file65);
  console.log('rendered', file, `+ 6.5" variant`);
}
