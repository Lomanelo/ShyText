/** One-time: compress Higgsfield raws into card backdrops + the website hero. */
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RAW = join(ROOT, 'raw');
const BG = join(ROOT, 'bg');

// Vertical card backdrops: 1400px wide JPEGs keep the SVG compositor fast.
for (const name of ['bar', 'cafe', 'library']) {
  await sharp(join(RAW, `${name}.png`))
    .resize({ width: 1400 })
    .jpeg({ quality: 82 })
    .toFile(join(BG, `${name}.jpg`));
  console.log('bg', name);
}

// Website hero: 1920px wide, slightly deeper compression for fast paint.
await sharp(join(RAW, 'hero-wide.png'))
  .resize({ width: 1920 })
  .jpeg({ quality: 74 })
  .toFile(join(ROOT, '..', '..', 'shytext.com', 'public', 'hero-bar.jpg'));
console.log('hero-bar.jpg written to website public/');
