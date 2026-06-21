// Generates the Blackstar Player icon set (black + violet→magenta star).
// Run: node scripts/gen-icons.mjs   — Made in Italy.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');
const BG = '#0A0A0F';

function starPath(cx, cy, outerR, innerR, points = 5) {
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + i * step;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d + 'Z';
}

const grad = `
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7C3AED"/>
    <stop offset="0.5" stop-color="#A855F7"/>
    <stop offset="1" stop-color="#D946EF"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#D946EF" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#D946EF" stop-opacity="0"/>
  </radialGradient>`;

function svgStar(size, { bg, fill = 'url(#g)', outer = size * 0.32, glow = true } = {}) {
  const c = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>${grad}</defs>
    ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
    ${glow ? `<circle cx="${c}" cy="${c}" r="${size * 0.42}" fill="url(#glow)"/>` : ''}
    <path d="${starPath(c, c, outer, outer * 0.42)}" fill="${fill}"/>
  </svg>`;
}

function svgSplash(w = 1024, h = 1024) {
  const c = w / 2;
  const cy = h * 0.4;
  const outer = w * 0.16;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>${grad}</defs>
    <circle cx="${c}" cy="${cy}" r="${w * 0.22}" fill="url(#glow)"/>
    <path d="${starPath(c, cy, outer, outer * 0.42)}" fill="url(#g)"/>
    <text x="${c}" y="${h * 0.66}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
      font-size="${w * 0.085}" font-weight="800" fill="#F5F3FF" letter-spacing="6">BLACKSTAR</text>
    <text x="${c}" y="${h * 0.74}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
      font-size="${w * 0.05}" font-weight="600" fill="#A855F7" letter-spacing="10">PLAYER</text>
  </svg>`;
}

async function png(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(OUT, file));
  console.log('✓', file);
}

await png(svgStar(1024, { bg: BG, outer: 300 }), 1024, 'icon.png');
await sharp(Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" fill="${BG}"/></svg>`))
  .png()
  .toFile(join(OUT, 'android-icon-background.png'));
console.log('✓ android-icon-background.png');
await png(svgStar(1024, { outer: 250, glow: true }), 1024, 'android-icon-foreground.png');
await png(svgStar(1024, { outer: 250, fill: '#FFFFFF', glow: false }), 1024, 'android-icon-monochrome.png');
await png(svgStar(96, { bg: BG, outer: 30 }), 96, 'favicon.png');

await sharp(Buffer.from(svgSplash(1024, 1024))).resize(1024, 1024).png().toFile(join(OUT, 'splash-icon.png'));
console.log('✓ splash-icon.png');

console.log('Done.');
