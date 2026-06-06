import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { getFFmpeg, onFfmpegProgress } from './ffmpeg'
import { parseAvi, writeAvi, type AviChunk } from './avi'
import {
  bloom,
  bloomBurst,
  stutter,
  shuffle,
  sortByMotion,
  reverse,
  transition,
  applyWindowed,
  type Range,
  type DropTargets,
} from './ops'

export type { Range } from './ops'

export type MoshEffect =
  | 'bloom'
  | 'bloomBurst'
  | 'stutter'
  | 'shuffle'
  | 'sort'
  | 'reverse'
  | 'transition'
  | 'flow' // GPU optical-flow smear; routed to webcodecs.ts, not this wasm engine

export interface MoshOptions {
  effect: MoshEffect
  /** 0..1. Drives keyframe-drop probability, repeat density, or scramble amount. */
  intensity?: number
  /** Cap the longest edge during transcode (keeps ffmpeg.wasm fast + in memory). */
  maxDimension?: number
  /** Mux the source clip's audio back into the result. */
  keepAudio?: boolean
  /** Seed for the randomized effects, so users can roll variations. */
  seed?: number
  /** Mosh only this fractional window of the clip (single-clip effects). */
  range?: Range
  /** Strip I-frames (bloom/transition). Defaults true. */
  dropI?: boolean
  /** Strip P-frames (bloom/transition). Defaults false. */
  dropP?: boolean
  /** Explicit repeat count per hit for stutter (else derived from intensity). */
  repeat?: number
}

export type MoshProgress = (ratio: number, phase: string) => void

const DEFAULTS = { intensity: 0.8, maxDimension: 960, seed: 0x6d6f7368 }

/** Effects that don't take an amount (the UI hides the slider for these). */
export const EFFECTS_WITHOUT_INTENSITY: ReadonlySet<MoshEffect> = new Set(['sort', 'reverse'])

// Per-effect GOP. The single-clip melts want one keyframe + a long predicted run
// (so duplicated/redirected motion accumulates with no resets); transition wants
// periodic keyframes in B so the Bleed control has something to span.
const GOP: Record<MoshEffect, number> = {
  bloom: 9999,
  bloomBurst: 9999,
  stutter: 9999,
  shuffle: 9999,
  sort: 9999,
  reverse: 9999,
  transition: 30,
  flow: 12, // unused (flow runs on the GPU engine), present to satisfy the map
}

/** Map an amount (0..1) to an mpeg4 qscale — more amount = grittier mosh. */
function qscaleFor(intensity: number): number {
  return 4 + Math.round(Math.max(0, Math.min(1, intensity)) * 5) // 4..9
}

async function fileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

function fitFilter(max: number): string {
  return `scale='min(${max},iw)':-2:flags=bicubic`
}

function normalizeFilter(w: number, h: number): string {
  return (
    `scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`
  )
}

async function runExec(
  ff: FFmpeg,
  args: string[],
  onProgress?: (ratio: number) => void,
): Promise<void> {
  const off = onProgress ? onFfmpegProgress(ff, onProgress) : null
  try {
    await ff.exec(args)
  } finally {
    off?.()
  }
}

/**
 * Transcode a source file to MPEG-4/AVI and return its parsed frame chunks.
 * The input file is left in ffmpeg's FS (under `inName`) so audio can be muxed
 * back later; the caller cleans it up.
 */
async function transcodeToChunks(
  ff: FFmpeg,
  file: File,
  inName: string,
  outName: string,
  vfilter: string,
  gop: number,
  qscale: number,
  onProgress?: (ratio: number) => void,
): Promise<{ head: Uint8Array; chunks: AviChunk[] }> {
  await ff.writeFile(inName, await fileBytes(file))
  // Lower quality (higher qscale) is what makes the mosh read: coarse residuals
  // let the motion vectors dominate so duplicated/redirected motion smears
  // instead of being corrected back. We deliberately avoid -mbd/-mv4/-trellis —
  // those sharpen prediction and sand the grit off the datamosh.
  await runExec(
    ff,
    [
      '-i', inName,
      '-an',
      '-vf', vfilter,
      '-c:v', 'mpeg4',
      '-vtag', 'xvid', // broad decoder compatibility for the moshed AVI
      '-qscale:v', String(qscale),
      '-g', String(gop),
      '-bf', '0', // no B-frames — predictable P-frame behaviour
      outName,
    ],
    onProgress,
  )
  const avi = (await ff.readFile(outName)) as Uint8Array
  return parseAvi(avi)
}

/**
 * Re-encode a moshed AVI to a web-playable MP4, optionally muxing the original
 * clip's audio back in. Returns the final MP4 Blob.
 */
async function encodeToMp4(
  ff: FFmpeg,
  aviBytes: Uint8Array,
  opts: { keepAudio: boolean; audioSrcName: string },
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  await ff.writeFile('m.avi', aviBytes)
  const videoName = opts.keepAudio ? 'v.mp4' : 'out.mp4'
  await runExec(
    ff,
    [
      '-i', 'm.avi',
      '-c:v', 'libx264',
      '-preset', 'veryfast', // fast bake — preset doesn't affect the mosh look
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an',
      videoName,
    ],
    onProgress,
  )

  let finalName = videoName
  if (opts.keepAudio) {
    finalName = 'out.mp4'
    try {
      // `1:a:0?` makes the audio map optional — silent clips just pass through.
      await runExec(ff, [
        '-i', 'v.mp4',
        '-i', opts.audioSrcName,
        '-map', '0:v:0',
        '-map', '1:a:0?',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        'out.mp4',
      ])
    } catch {
      finalName = 'v.mp4' // mux failed (e.g. no aac) — fall back to video-only
    }
  }

  const out = (await ff.readFile(finalName)) as Uint8Array
  return new Blob([out.slice()], { type: 'video/mp4' })
}

async function cleanup(ff: FFmpeg, names: string[]): Promise<void> {
  await Promise.all(
    names.map(async (n) => {
      try {
        await ff.deleteFile(n)
      } catch {
        /* file may not exist; ignore */
      }
    }),
  )
}

interface ApplyParams {
  intensity: number
  seed: number
  repeat?: number
}

function applySingle(effect: MoshEffect, chunks: AviChunk[], p: ApplyParams): AviChunk[] {
  switch (effect) {
    case 'bloom':
      return bloom(chunks, p.intensity)
    case 'bloomBurst':
      return bloomBurst(chunks, p.intensity)
    case 'stutter':
      return stutter(chunks, p.intensity, p.repeat)
    case 'shuffle':
      return shuffle(chunks, p.intensity, p.seed)
    case 'sort':
      return sortByMotion(chunks)
    case 'reverse':
      return reverse(chunks)
    default:
      return chunks
  }
}

/**
 * Datamosh one or two clips entirely in the browser and return an MP4 Blob.
 * `inputs` is a single clip for everything except transition, which takes two.
 */
export async function datamosh(
  inputs: File[],
  options: MoshOptions,
  onProgress?: MoshProgress,
): Promise<Blob> {
  const intensity = options.intensity ?? DEFAULTS.intensity
  const maxDim = options.maxDimension ?? DEFAULTS.maxDimension
  const seed = options.seed ?? DEFAULTS.seed
  const keepAudio = options.keepAudio ?? false
  const targets: DropTargets = { i: options.dropI ?? true, p: options.dropP ?? false }
  const gop = GOP[options.effect]
  const qscale = qscaleFor(intensity)
  const ff = await getFFmpeg()

  if (options.effect === 'transition') {
    if (inputs.length < 2) throw new Error('Transition needs two clips')
    const w = Math.round(maxDim / 2) * 2
    const h = Math.round((maxDim * 9) / 16 / 2) * 2
    const nf = normalizeFilter(w, h)

    onProgress?.(0, 'Transcoding clip A')
    const a = await transcodeToChunks(ff, inputs[0], 'a.in', 'a.avi', nf, gop, qscale, (r) =>
      onProgress?.(r * 0.4, 'Transcoding clip A'),
    )
    onProgress?.(0.4, 'Transcoding clip B')
    const b = await transcodeToChunks(ff, inputs[1], 'b.in', 'b.avi', nf, gop, qscale, (r) =>
      onProgress?.(0.4 + r * 0.4, 'Transcoding clip B'),
    )

    onProgress?.(0.8, 'Moshing')
    // The transition's Amount slider drives the bleed length into clip B.
    const moshed = writeAvi(a.head, transition(a.chunks, b.chunks, targets, intensity))

    onProgress?.(0.82, 'Encoding')
    const blob = await encodeToMp4(
      ff,
      moshed,
      { keepAudio, audioSrcName: 'a.in' },
      (r) => onProgress?.(0.82 + r * 0.18, keepAudio ? 'Encoding + audio' : 'Encoding'),
    )
    await cleanup(ff, ['a.in', 'a.avi', 'b.in', 'b.avi', 'm.avi', 'v.mp4', 'out.mp4'])
    onProgress?.(1, 'Done')
    return blob
  }

  onProgress?.(0, 'Transcoding')
  const { head, chunks } = await transcodeToChunks(
    ff,
    inputs[0],
    'in.src',
    'work.avi',
    fitFilter(maxDim),
    gop,
    qscale,
    (r) => onProgress?.(r * 0.5, 'Transcoding'),
  )

  onProgress?.(0.5, 'Moshing')
  const moshed = writeAvi(
    head,
    applyWindowed(
      (cs) => applySingle(options.effect, cs, { intensity, seed, repeat: options.repeat }),
      chunks,
      options.range,
    ),
  )

  onProgress?.(0.55, 'Encoding')
  const blob = await encodeToMp4(
    ff,
    moshed,
    { keepAudio, audioSrcName: 'in.src' },
    (r) => onProgress?.(0.55 + r * 0.45, keepAudio ? 'Encoding + audio' : 'Encoding'),
  )
  await cleanup(ff, ['in.src', 'work.avi', 'm.avi', 'v.mp4', 'out.mp4'])
  onProgress?.(1, 'Done')
  return blob
}
