// Fetch a static ffmpeg for the host platform and place it where Tauri's
// `externalBin` expects it: src-tauri/binaries/ffmpeg-<target-triple>. Run before
// `tauri dev` / `tauri build`. The binaries are gitignored (fetched, not vendored).
//
// We distribute directly (not the App Store), so GPL static builds (with x264)
// are fine. macOS has no single reliable static-build URL across arches, so on
// macOS we fall back to copying the system ffmpeg for LOCAL dev — that binary is
// NOT portable; CI/release on macOS must drop in a real static build.
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, copyFileSync, chmodSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir, platform, arch } from 'node:os'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'src-tauri/binaries')

const TRIPLES = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'win32-x64': 'x86_64-pc-windows-msvc',
}

// Reliable static GPL (with x264) builds. macOS: evermeet's static x86_64 build
// (runs on Apple Silicon via Rosetta), so release CI uses an x86_64 mac runner.
// arm64 macOS has no stable static URL → local dev there falls back to the system
// ffmpeg (or set DMOSH_FFMPEG_BIN).
const DOWNLOADS = {
  'darwin-x64': {
    url: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip',
    inner: 'ffmpeg',
  },
  'linux-x64': {
    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz',
    inner: 'ffmpeg', // basename of the binary inside the archive
  },
  'win32-x64': {
    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    inner: 'ffmpeg.exe',
  },
}

const key = `${platform()}-${arch()}`
const triple = TRIPLES[key]
if (!triple) {
  console.error(`[ffmpeg-sidecar] unsupported host ${key}`)
  process.exit(1)
}
const ext = platform() === 'win32' ? '.exe' : ''
const dest = join(outDir, `ffmpeg-${triple}${ext}`)
mkdirSync(outDir, { recursive: true })

if (existsSync(dest)) {
  console.log(`[ffmpeg-sidecar] present: ${dest}`)
  process.exit(0)
}

// CI / release: drop in an exact static binary. This is the correct path on
// macOS (no stable static-build URL across arches) — e.g. a static arm64 build
// from osxexperts.net or one you build yourself.
const override = process.env.DMOSH_FFMPEG_BIN
if (override) {
  if (!existsSync(override)) {
    console.error(`[ffmpeg-sidecar] DMOSH_FFMPEG_BIN does not exist: ${override}`)
    process.exit(1)
  }
  copyFileSync(override, dest)
  chmodSync(dest, 0o755)
  console.log(`[ffmpeg-sidecar] used DMOSH_FFMPEG_BIN → ${dest}`)
  process.exit(0)
}

function fromSystem() {
  try {
    const sys = execSync(platform() === 'win32' ? 'where ffmpeg' : 'command -v ffmpeg').toString().trim().split('\n')[0]
    copyFileSync(sys, dest)
    chmodSync(dest, 0o755)
    console.log(`[ffmpeg-sidecar] copied system ffmpeg → ${dest} (LOCAL DEV ONLY)`)
    console.warn(
      '[ffmpeg-sidecar] NOTE: a system ffmpeg is NOT portable (it links to local dylibs).\n' +
        '                 For a release build, set DMOSH_FFMPEG_BIN to a STATIC ffmpeg binary.',
    )
  } catch {
    console.error('[ffmpeg-sidecar] no static build fetched and no system ffmpeg found. Install ffmpeg or add a static binary at:', dest)
    process.exit(1)
  }
}

async function download(url, file) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const { writeFileSync } = await import('node:fs')
  writeFileSync(file, buf)
}

const dl = DOWNLOADS[key]
if (!dl) {
  // macOS (no stable static URL) → local dev fallback.
  fromSystem()
  process.exit(0)
}

const work = join(tmpdir(), `ffmpeg-dl-${Date.now()}`)
mkdirSync(work, { recursive: true })
try {
  const archive = join(work, key.includes('win') ? 'ff.zip' : 'ff.tar.xz')
  console.log(`[ffmpeg-sidecar] downloading ${dl.url}`)
  await download(dl.url, archive)
  if (archive.endsWith('.zip')) {
    execSync(`unzip -o ${archive} -d ${work}`, { stdio: 'ignore' })
  } else {
    execSync(`tar -xf ${archive} -C ${work}`, { stdio: 'ignore' })
  }
  const found = execSync(`find ${work} -type f -name ${dl.inner}`).toString().trim().split('\n')[0]
  if (!found) throw new Error(`${dl.inner} not found in archive`)
  copyFileSync(found, dest)
  chmodSync(dest, 0o755)
  console.log(`[ffmpeg-sidecar] installed static ffmpeg → ${dest}`)
} catch (e) {
  console.warn(`[ffmpeg-sidecar] download failed (${e.message}); falling back to system ffmpeg`)
  fromSystem()
} finally {
  rmSync(work, { recursive: true, force: true })
}
