// Native-ffmpeg datamosh, reusing the browser engine's pure modules so the
// structural effects are byte-for-byte the same as the client. The only extra
// is `motionTransfer`, which needs FFglitch (ffgac/ffedit) — see README.
import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseAvi, writeAvi, frameType } from '../src/mosh/avi.ts'
import {
  bloom,
  bloomBurst,
  stutter,
  shuffle,
  sortByMotion,
  reverse,
  transition,
  applyWindowed,
} from '../src/mosh/ops.ts'

const GOP = { bloom: 12, bloomBurst: 12, stutter: 300, shuffle: 9999, sort: 9999, reverse: 9999, transition: 15 }

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} failed: ${err.slice(-500)}`))))
  })
}

const ffmpeg = (args) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])

async function transcodeToChunks(input, out, vf, gop) {
  await ffmpeg([
    '-i', input, '-an', '-vf', vf,
    '-c:v', 'mpeg4', '-vtag', 'xvid', '-q:v', '1',
    '-g', String(gop), '-bf', '0', '-mbd', 'rd', '-flags', '+mv4', '-trellis', '2',
    out,
  ])
  return parseAvi(await readFile(out))
}

function applySingle(effect, chunks, intensity, seed) {
  switch (effect) {
    case 'bloom': return bloom(chunks, intensity, seed)
    case 'bloomBurst': return bloomBurst(chunks, intensity, seed)
    case 'stutter': return stutter(chunks, intensity)
    case 'shuffle': return shuffle(chunks, intensity, seed)
    case 'sort': return sortByMotion(chunks)
    case 'reverse': return reverse(chunks)
    default: return chunks
  }
}

const fit = (max) => `scale='min(${max},iw)':-2:flags=bicubic`
const norm = (w, h) =>
  `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`

async function encode(aviPath, outPath, audioSrc, keepAudio) {
  if (keepAudio && audioSrc) {
    const video = `${outPath}.v.mp4`
    await ffmpeg(['-i', aviPath, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', video])
    try {
      await ffmpeg(['-i', video, '-i', audioSrc, '-map', '0:v:0', '-map', '1:a:0?', '-c:v', 'copy', '-c:a', 'aac', '-shortest', outPath])
      return
    } catch {
      /* no audio / aac — fall through to video-only */
      await ffmpeg(['-i', video, '-c', 'copy', outPath])
      return
    }
  }
  await ffmpeg(['-i', aviPath, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', outPath])
}

/**
 * FFglitch motion transfer: re-encode both clips with ffgac, then ffedit clip A
 * substituting clip B's motion vectors. Requires ffgac + ffedit on PATH.
 */
async function motionTransfer(dir, clipA, clipB, outPath) {
  const aGac = join(dir, 'a.mkv')
  const bGac = join(dir, 'b.mkv')
  await run('ffgac', ['-i', clipA, '-an', '-mpv_flags', '+nopimb+forcemv', '-qscale:v', '0', '-g', '999999', '-vcodec', 'mpeg4', '-f', 'avi', aGac])
  await run('ffgac', ['-i', clipB, '-an', '-mpv_flags', '+nopimb+forcemv', '-qscale:v', '0', '-g', '999999', '-vcodec', 'mpeg4', '-f', 'avi', bGac])
  // Export B's vectors, then apply onto A. Script provided in /server/scripts.
  const bJson = join(dir, 'b.mv.json')
  await run('ffedit', ['-i', bGac, '-f', 'mv', '-e', bJson])
  const merged = join(dir, 'merged.avi')
  await run('ffedit', ['-i', aGac, '-f', 'mv', '-a', bJson, '-o', merged])
  await encode(merged, outPath, null, false)
}

/**
 * Process a job. `files` = { clip, clip2? } absolute paths. `onProgress(r, phase)`.
 * Returns the path to the result mp4.
 */
export async function processJob(files, options, onProgress = () => {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dmosh-'))
  const out = join(dir, 'out.mp4')
  try {
    const intensity = options.intensity ?? 0.8
    const maxDim = options.maxDimension ?? 1280
    const seed = options.seed ?? 0x6d6f7368
    const keepAudio = options.keepAudio ?? false
    const range = options.range

    if (options.effect === 'motionTransfer') {
      if (!files.clip2) throw new Error('motionTransfer needs two clips')
      onProgress(0.1, 'Motion transfer')
      await motionTransfer(dir, files.clip, files.clip2, out)
      onProgress(1, 'Done')
      return out
    }

    if (options.effect === 'transition') {
      if (!files.clip2) throw new Error('transition needs two clips')
      const w = Math.round(maxDim / 2) * 2
      const h = Math.round((maxDim * 9) / 16 / 2) * 2
      onProgress(0.05, 'Transcoding A')
      const a = await transcodeToChunks(files.clip, join(dir, 'a.avi'), norm(w, h), GOP.transition)
      onProgress(0.4, 'Transcoding B')
      const b = await transcodeToChunks(files.clip2, join(dir, 'b.avi'), norm(w, h), GOP.transition)
      onProgress(0.8, 'Encoding')
      const moshed = writeAvi(a.head, transition(a.chunks, b.chunks))
      const m = join(dir, 'm.avi')
      await writeFile(m, Buffer.from(moshed))
      await encode(m, out, files.clip, keepAudio)
      onProgress(1, 'Done')
      return out
    }

    const partial = range && !(range.start <= 0 && range.end >= 1)
    const gop = partial ? 12 : GOP[options.effect]
    onProgress(0.05, 'Transcoding')
    const { head, chunks } = await transcodeToChunks(files.clip, join(dir, 'work.avi'), fit(maxDim), gop)
    onProgress(0.6, 'Encoding')
    const moshed = writeAvi(head, applyWindowed((cs) => applySingle(options.effect, cs, intensity, seed), chunks, range))
    const m = join(dir, 'm.avi')
    await writeFile(m, Buffer.from(moshed))
    await encode(m, out, files.clip, keepAudio)
    onProgress(1, 'Done')
    return out
  } catch (e) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    throw e
  }
}

// re-export so the server can validate effect names
export const SINGLE_EFFECTS = ['bloom', 'bloomBurst', 'stutter', 'shuffle', 'sort', 'reverse']
export { frameType }
