// Copies the single-thread @ffmpeg/core build into public/ffmpeg so it can be
// self-hosted (no CDN, works offline and on GitHub Pages with a base path).
// Run automatically via predev / prebuild. The multithreaded core is avoided on
// purpose: it needs SharedArrayBuffer + COOP/COEP headers that GitHub Pages
// cannot set.
import { mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// ESM build: Vite spawns @ffmpeg/ffmpeg's worker as a *module* worker, whose
// core-load path is `import(coreURL).default`. Only the ESM core exposes that
// default export, so the UMD core would fail with "failed to import".
const srcDir = resolve(root, 'node_modules/@ffmpeg/core/dist/esm')
const outDir = resolve(root, 'public/ffmpeg')

const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm']

mkdirSync(outDir, { recursive: true })
for (const f of files) {
  const from = resolve(srcDir, f)
  if (!existsSync(from)) {
    console.error(`[copy-ffmpeg-core] missing ${from} — is @ffmpeg/core installed?`)
    process.exit(1)
  }
  copyFileSync(from, resolve(outDir, f))
}
console.log(`[copy-ffmpeg-core] copied ${files.join(', ')} -> public/ffmpeg`)
