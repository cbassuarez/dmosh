// Generates platform-correct icon sources + the DMG background from the brand
// art (assets/brand/source.png). Outputs:
//   /tmp/dmosh-icon-mac.png     1024² rounded squircle tile (macOS .icns)
//   /tmp/dmosh-icon-square.png  1024² square tile (Windows .ico + Linux PNGs + web)
//   src-tauri/dmg-background.png 660×400 install-window background
// Run: node scripts/make-brand-assets.mjs   (then assemble with `tauri icon`)
import sharp from 'sharp'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(root, 'assets/brand/source.png')

// Sample the art's background colour (its corners) so tiles are seamless.
async function bgColor() {
  const { data } = await sharp(SRC).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true })
  return { r: data[0], g: data[1], b: data[2] }
}

// Trimmed art (flower without its surrounding margin), so we control padding.
async function art() {
  return sharp(SRC).trim({ threshold: 12 }).toBuffer()
}

async function macIcon(bg) {
  const a = await sharp(await art()).resize(600, 600, { fit: 'inside' }).toBuffer()
  // macOS grid: 824² tile centred in 1024 (≈100px margin), corner radius ≈185.
  const tile = Buffer.from(
    `<svg width="1024" height="1024"><rect x="100" y="100" width="824" height="824" rx="185" ry="185" fill="rgb(${bg.r},${bg.g},${bg.b})"/></svg>`,
  )
  const mask = Buffer.from(
    `<svg width="1024" height="1024"><rect x="100" y="100" width="824" height="824" rx="185" ry="185" fill="#fff"/></svg>`,
  )
  const composed = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: tile }, { input: a, gravity: 'center' }])
    .png()
    .toBuffer()
  await sharp(composed).composite([{ input: mask, blend: 'dest-in' }]).png().toFile('/tmp/dmosh-icon-mac.png')
}

async function squareIcon(bg) {
  const a = await sharp(await art()).resize(860, 860, { fit: 'inside' }).toBuffer()
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { ...bg, alpha: 1 } } })
    .composite([{ input: a, gravity: 'center' }])
    .png()
    .toFile('/tmp/dmosh-icon-square.png')
}

async function dmgBackground() {
  // Rendered at 2x (1320×800) of the 660×400 DMG window for a crisp retina
  // background. Minimal + light, matching the web app: off-white, IBM Plex Mono
  // wordmark, a hairline rule, and one restrained arrow toward Applications.
  // Icons sit at (180,170) and (480,170) in window points → ×2 here.
  const svg = `
  <svg width="1320" height="800" xmlns="http://www.w3.org/2000/svg">
    <rect width="1320" height="800" fill="#fafafa"/>
    <text x="660" y="150" text-anchor="middle" font-family="'IBM Plex Mono','SF Mono',monospace" font-size="40" font-weight="600" fill="#171717" letter-spacing="4">dmosh</text>
    <line x1="600" y1="186" x2="720" y2="186" stroke="#e5e5e5" stroke-width="2"/>
    <text x="660" y="228" text-anchor="middle" font-family="'IBM Plex Sans','Helvetica Neue',sans-serif" font-size="22" fill="#9ca3af" letter-spacing="0.5">drag to Applications</text>
    <!-- one quiet arrow, app (360,340) → Applications (960,340) -->
    <g stroke="#d97757" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <line x1="556" y1="340" x2="772" y2="340"/>
      <polyline points="752,322 776,340 752,358"/>
    </g>
  </svg>`
  await sharp(Buffer.from(svg)).png().toFile(resolve(root, 'src-tauri/dmg-background.png'))
}

const bg = await bgColor()
await macIcon(bg)
await squareIcon(bg)
await dmgBackground()
console.log('brand assets written: /tmp/dmosh-icon-mac.png, /tmp/dmosh-icon-square.png, src-tauri/dmg-background.png')
