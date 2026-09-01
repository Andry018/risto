// One-off generator for PWA maskable icons + iOS splash screens.
// Run with: node scripts/gen-pwa-assets.cjs
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SOURCE = path.join(PUBLIC_DIR, 'pwa-512x512.png');
const BG = { r: 104, g: 56, b: 56, alpha: 1 }; // dominant bordeaux from the logo

async function makeMaskable(size, outName) {
  const logoSize = Math.round(size * 0.7); // keep well inside the 80% safe-zone circle
  const logo = await sharp(SOURCE).resize(logoSize, logoSize, { fit: 'contain' }).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC_DIR, outName));
  console.log('wrote', outName);
}

async function makeSplash(width, height, outName) {
  const logoSize = Math.round(Math.min(width, height) * 0.38);
  const logo = await sharp(SOURCE).resize(logoSize, logoSize, { fit: 'contain' }).toBuffer();
  await sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'splash', outName));
  console.log('wrote splash/' + outName);
}

const SPLASH_SIZES = [
  // width, height (portrait, physical px), filename
  [640, 1136, 'apple-splash-640-1136.png'],   // iPhone SE (1st gen)
  [750, 1334, 'apple-splash-750-1334.png'],   // iPhone SE2/3, 6/7/8
  [1242, 2208, 'apple-splash-1242-2208.png'], // iPhone 8 Plus
  [1125, 2436, 'apple-splash-1125-2436.png'], // iPhone X/XS/11 Pro/12 mini/13 mini
  [828, 1792, 'apple-splash-828-1792.png'],   // iPhone 11/XR
  [1242, 2688, 'apple-splash-1242-2688.png'], // iPhone 11 Pro Max/XS Max
  [1170, 2532, 'apple-splash-1170-2532.png'], // iPhone 12/13/14
  [1284, 2778, 'apple-splash-1284-2778.png'], // iPhone 12/13 Pro Max, 14 Plus
  [1179, 2556, 'apple-splash-1179-2556.png'], // iPhone 14/15/15 Pro/16
  [1290, 2796, 'apple-splash-1290-2796.png'], // iPhone 14/15 Pro Max, 15/16 Plus
  [1668, 2388, 'apple-splash-1668-2388.png'], // iPad Air/Pro 11"
  [2048, 2732, 'apple-splash-2048-2732.png'], // iPad Pro 12.9"
];

(async () => {
  fs.mkdirSync(path.join(PUBLIC_DIR, 'splash'), { recursive: true });
  await makeMaskable(192, 'pwa-maskable-192x192.png');
  await makeMaskable(512, 'pwa-maskable-512x512.png');
  await sharp(SOURCE).resize(180, 180).png().toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
  console.log('wrote apple-touch-icon.png');
  for (const [w, h, name] of SPLASH_SIZES) {
    await makeSplash(w, h, name);
  }
})();
