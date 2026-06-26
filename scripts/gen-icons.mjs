// Generates the Blackstar Player icon set from the real Blackstar logo
// (open ring), gradient-tinted violet→magenta on black. Made in Italy.
// Run: node scripts/gen-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');
const LOGO = join(OUT, 'brand-logo.png');
const BG = '#0A0A0F';
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const gradSvg = (size) =>
  `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7C3AED"/><stop offset="0.5" stop-color="#A855F7"/><stop offset="1" stop-color="#D946EF"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#g)"/></svg>`;

// Logo silhouette filled with the brand gradient (uses logo alpha as mask).
async function tinted(size) {
  const logo = await sharp(LOGO).resize(size, size, { fit: 'contain', background: TRANSPARENT }).png().toBuffer();
  return sharp(Buffer.from(gradSvg(size))).composite([{ input: logo, blend: 'dest-in' }]).png().toBuffer();
}
async function white(size) {
  return sharp(LOGO).resize(size, size, { fit: 'contain', background: TRANSPARENT }).png().toBuffer();
}
function canvas(size, bg) {
  return sharp({ create: { width: size, height: size, channels: 4, background: bg || TRANSPARENT } });
}

// App icon: black + glow + gradient logo.
const iconBase = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#D946EF" stop-opacity="0.5"/><stop offset="1" stop-color="#D946EF" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="1024" height="1024" fill="${BG}"/>
  <circle cx="512" cy="512" r="430" fill="url(#glow)"/></svg>`;

async function run() {
  await sharp(Buffer.from(iconBase)).composite([{ input: await tinted(640), gravity: 'center' }]).png().toFile(join(OUT, 'icon.png'));
  console.log('✓ icon.png');

  await canvas(1024, BG).png().toFile(join(OUT, 'android-icon-background.png'));
  console.log('✓ android-icon-background.png');

  await canvas(1024).composite([{ input: await tinted(560), gravity: 'center' }]).png().toFile(join(OUT, 'android-icon-foreground.png'));
  console.log('✓ android-icon-foreground.png');

  await canvas(1024).composite([{ input: await white(560), gravity: 'center' }]).png().toFile(join(OUT, 'android-icon-monochrome.png'));
  console.log('✓ android-icon-monochrome.png');

  await sharp({ create: { width: 96, height: 96, channels: 4, background: BG } })
    .composite([{ input: await tinted(72), gravity: 'center' }])
    .png()
    .toFile(join(OUT, 'favicon.png'));
  console.log('✓ favicon.png');

  // Splash: transparent canvas, gradient logo high, wordmark below.
  const text = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <text x="512" y="690" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="800" fill="#F5F3FF" letter-spacing="6">BLACKSTAR</text>
    <text x="512" y="760" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="600" fill="#A855F7" letter-spacing="10">PLAYER</text></svg>`;
  const logo320 = await tinted(320);
  await canvas(1024)
    .composite([{ input: logo320, top: 250, left: 352 }, { input: Buffer.from(text), top: 0, left: 0 }])
    .png()
    .toFile(join(OUT, 'splash-icon.png'));
  console.log('✓ splash-icon.png');

  console.log('Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
