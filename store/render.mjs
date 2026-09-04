/**
 * ShyText App Store cards — cinematic title-card compositor (v2).
 *
 * 1290×2796 PNGs (6.7" App Store portrait). Centered composition:
 * story bars, statement + echo, and an iPhone frame (Dynamic Island, soft
 * shadow) that bleeds off the bottom edge, over Higgsfield atmosphere
 * photography. Brand cards (1 and 5) are pure title cards with the wordmark.
 *
 * Drop real iPhone screenshots into store/screens/card-2.png, card-3.png,
 * card-4.png and rerun — they composite into the device automatically.
 *
 * Usage: npm run render   (outputs to store/out/)
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'out');
mkdirSync(OUT, { recursive: true });

const W = 1290;
const H = 2796;

const NIGHT = '#12100E';
const SCREEN_BG = '#171310';
const PAPER = '#FCF3E8';
const FLAME = '#D05927';
const SMOKE = '#A89486';
const LINE = 'rgba(252,243,232,0.14)';
const BEZEL = '#050403';

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

function bgUri(name) {
  const path = join(ROOT, 'bg', name);
  return existsSync(path) ? dataUri(path, 'image/jpeg') : null;
}

function screenUri(cardId) {
  const path = join(ROOT, 'screens', `card-${cardId}.png`);
  return existsSync(path) ? dataUri(path, 'image/png') : null;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Story bars — centered, quiet, straight from the app's onboarding. */
function storyBars(lit) {
  const groupW = 560;
  const gap = 12;
  const barW = (groupW - gap * 2) / 3;
  const x0 = (W - groupW) / 2;
  return [0, 1, 2]
    .map((i) => {
      const x = x0 + i * (barW + gap);
      return `<rect x="${x}" y="168" width="${barW}" height="9" rx="4.5" fill="${i < lit ? FLAME : LINE}"/>`;
    })
    .join('\n');
}

function titleBlock({ lines, echo, y, size = 116, lineHeight = 128 }) {
  const statement = lines
    .map(
      (line, i) =>
        `<text x="${W / 2}" y="${y + i * lineHeight}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${size}" letter-spacing="-3.5" fill="${PAPER}">${esc(line)}</text>`
    )
    .join('\n');
  const echoY = y + lines.length * lineHeight + 26;
  const echoText = `<text x="${W / 2}" y="${echoY}" text-anchor="middle" font-family="Inter" font-weight="500" font-size="54" fill="${SMOKE}">${esc(echo)}</text>`;
  return statement + '\n' + echoText;
}

/**
 * iPhone frame, bleeding off the bottom of the card. Real screenshot slides
 * into the screen when present; otherwise a quiet dark screen with a ghost flame.
 */
function device(cardId) {
  const outerW = 1010;
  const inset = 22;
  const screenW = outerW - inset * 2;
  const screenH = Math.round((screenW * 2796) / 1290);
  const outerH = screenH + inset * 2;
  const x = (W - outerW) / 2;
  const y = 1150;
  const rOuter = 158;
  const rScreen = 136;
  const screenX = x + inset;
  const screenY = y + inset;

  const shot = screenUri(cardId);
  // Screenshots start at the app header (no status bar), so give the island
  // a real status-bar zone and slide the capture down beneath it.
  const statusH = 150;
  const screenContent = shot
    ? `<rect x="${screenX}" y="${screenY}" width="${screenW}" height="${statusH + rScreen}" fill="#F5F2EF" clip-path="url(#screen-${cardId})"/>
       <image href="${shot}" x="${screenX}" y="${screenY + statusH}" width="${screenW}" height="${screenH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#screen-${cardId})"/>`
    : `<image href="${flamePng}" x="${W / 2 - 100}" y="${screenY + 560}" width="200" height="200" opacity="0.18"/>`;

  // Dynamic Island only makes sense over a real screenshot-less screen too — it sells the frame.
  const islandW = 302;
  const island = `<rect x="${(W - islandW) / 2}" y="${screenY + 30}" width="${islandW}" height="84" rx="42" fill="${BEZEL}"/>`;

  return `
    <clipPath id="screen-${cardId}"><rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="${rScreen}"/></clipPath>
    <rect x="${x - 40}" y="${y + 60}" width="${outerW + 80}" height="${outerH}" rx="${rOuter + 30}" fill="#000000" opacity="0.55" filter="url(#soft)"/>
    <rect x="${x}" y="${y}" width="${outerW}" height="${outerH}" rx="${rOuter}" fill="${BEZEL}"/>
    <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="${rScreen}" fill="${SCREEN_BG}"/>
    ${screenContent}
    ${island}
    <rect x="${x + 3}" y="${y + 3}" width="${outerW - 6}" height="${outerH - 6}" rx="${rOuter - 3}" fill="none" stroke="rgba(252,243,232,0.10)" stroke-width="2.5"/>
  `;
}

function wordmarkCentered(y) {
  const flameSize = 76;
  const textSize = 60;
  const gapX = 18;
  const textW = textSize * 0.56 * 7; // ~ visual width of "shytext"
  const total = flameSize + gapX + textW;
  const x0 = (W - total) / 2;
  return `
    <image href="${flamePng}" x="${x0}" y="${y - flameSize + 12}" width="${flameSize}" height="${flameSize}"/>
    <text x="${x0 + flameSize + gapX}" y="${y}" font-family="Inter" font-weight="700" font-size="${textSize}" letter-spacing="-1" fill="${FLAME}">shytext</text>
  `;
}

function card(spec) {
  const bgImage = spec.bg ? bgUri(spec.bg) : null;
  const photo = bgImage
    ? `<image href="${bgImage}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity="0.5"/>`
    : '';
  const heroFlame = spec.bigFlame
    ? `<image href="${flamePng}" x="${(W - 520) / 2}" y="1250" width="520" height="520"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="scrimTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${NIGHT}" stop-opacity="0.95"/>
      <stop offset="0.42" stop-color="${NIGHT}" stop-opacity="0.62"/>
      <stop offset="1" stop-color="${NIGHT}" stop-opacity="0.18"/>
    </linearGradient>
    <linearGradient id="scrimBottom" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="${NIGHT}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${NIGHT}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="emberGlow" cx="0.5" cy="0.62" r="0.62">
      <stop offset="0" stop-color="${FLAME}" stop-opacity="0.15"/>
      <stop offset="1" stop-color="${FLAME}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="46"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.9  0 0 0 0.05 0"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="${NIGHT}"/>
  ${photo}
  <rect width="${W}" height="${H * 0.58}" fill="url(#scrimTop)"/>
  <rect y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="url(#scrimBottom)"/>
  <rect width="${W}" height="${H}" fill="url(#emberGlow)"/>

  ${storyBars(spec.lit)}
  ${titleBlock(spec)}
  ${spec.device ? device(spec.id) : ''}
  ${heroFlame}
  ${spec.wordmark ? wordmarkCentered(H - 170) : ''}

  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.55"/>
</svg>`;
}

const CARDS = [
  {
    id: 1,
    lit: 1,
    lines: ['There’s a moment', 'before hello.'],
    echo: 'ShyText lives there.',
    y: 960,
    bg: 'bar.jpg',
    device: false,
    bigFlame: false,
    wordmark: true,
  },
  {
    id: 2,
    lit: 2,
    lines: ['Shyne when', 'you’re open.'],
    echo: 'A quiet signal to the room.',
    y: 500,
    bg: 'cafe.jpg',
    device: true,
    bigFlame: false,
    wordmark: false,
  },
  {
    id: 3,
    lit: 2,
    lines: ['See who’s', 'open here.'],
    echo: 'Nobody shows up by accident.',
    y: 500,
    bg: 'bar.jpg',
    device: true,
    bigFlame: false,
    wordmark: false,
  },
  {
    id: 4,
    lit: 3,
    lines: ['One note.', 'One person.'],
    echo: 'No feed. No swiping. No map.',
    y: 500,
    bg: 'library.jpg',
    device: true,
    bigFlame: false,
    wordmark: false,
  },
  {
    id: 5,
    lit: 3,
    lines: ['They accept.', 'You chat.'],
    echo: 'The rest happens offline.',
    y: 500,
    bg: 'cafe.jpg',
    device: true,
    bigFlame: false,
    wordmark: false,
  },
  {
    id: 6,
    lit: 3,
    lines: ['Never on a map.'],
    echo: 'A venue name — never a pin.',
    y: 900,
    bg: null,
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
  console.log('rendered', file, `${Math.round(png.length / 1024)}kb`);
}
