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
  const svg = `
  <svg width="660" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="660" height="400" fill="#f6f5f3"/>
    <!-- restrained datamosh smear: a faint row of displaced macroblocks -->
    <g opacity="0.16">
      <rect x="120" y="300" width="46" height="22" fill="#f4a01e"/>
      <rect x="166" y="300" width="22" height="22" fill="#e2581f"/>
      <rect x="188" y="300" width="60" height="22" fill="#f4c01e"/>
      <rect x="248" y="300" width="18" height="22" fill="#2bb673"/>
      <rect x="300" y="300" width="40" height="22" fill="#f4a01e"/>
      <rect x="360" y="300" width="26" height="22" fill="#3aa6c9"/>
      <rect x="404" y="300" width="70" height="22" fill="#e2581f"/>
      <rect x="474" y="300" width="30" height="22" fill="#f4c01e"/>
    </g>
    <text x="330" y="52" text-anchor="middle" font-family="monospace" font-size="22" font-weight="600" fill="#1a1a1a" letter-spacing="2">dmosh</text>
    <text x="330" y="74" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#9a9a9a">drag dmosh into your Applications folder</text>
    <!-- arrow from the app icon (180,170) to Applications (480,170) -->
    <g stroke="#ff5135" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.85">
      <line x1="258" y1="170" x2="402" y2="170"/>
      <polyline points="390,160 404,170 390,180"/>
    </g>
  </svg>`
  await sharp(Buffer.from(svg)).png().toFile(resolve(root, 'src-tauri/dmg-background.png'))
}

const bg = await bgColor()
await macIcon(bg)
await squareIcon(bg)
await dmgBackground()
console.log('brand assets written: /tmp/dmosh-icon-mac.png, /tmp/dmosh-icon-square.png, src-tauri/dmg-background.png')
