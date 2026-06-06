// Pure datamosh operations over a flat list of AVI frame chunks. No ffmpeg here,
// so these are deterministic and unit-testable.
//
// A useful free signal: a P-frame chunk's byte length (`data.length`) tracks how
// much it changed from the previous frame — i.e. roughly its motion/residual
// magnitude. Several effects below exploit that (strongest-frame bloom, sort).
import type { AviChunk } from './avi'
import { frameType } from './avi'

const DEFAULT_SEED = 0x6d6f7368 // "mosh"

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t)
}

/** Split off the leading seed keyframe; return it plus the trailing frames. */
function splitSeed(chunks: AviChunk[]): { seed: AviChunk[]; rest: AviChunk[] } {
  if (chunks.length === 0) return { seed: [], rest: [] }
  return { seed: [chunks[0]], rest: chunks.slice(1) }
}

/** Drop interior keyframes (keep the first), so motion bleeds across the frame. */
export function bloom(chunks: AviChunk[], intensity = 1, seed = DEFAULT_SEED): AviChunk[] {
  const p = clamp01(intensity)
  const rng = mulberry32(seed)
  let seenFirst = false
  return chunks.filter((c) => {
    if (frameType(c.data) !== 'I') return true
    if (!seenFirst) {
      seenFirst = true
      return true
    }
    return rng() >= p
  })
}

/**
 * Stutter / P-frame repeat: periodically duplicate predicted frames so their
 * motion vectors re-apply, freezing/echoing motion into a glitchy judder.
 */
export function stutter(chunks: AviChunk[], intensity = 0.5): AviChunk[] {
  const t = clamp01(intensity)
  if (t <= 0) return chunks.slice()
  const period = Math.max(2, Math.round(16 * (1 - t)))
  const extra = Math.max(1, Math.round(8 * t))

  const out: AviChunk[] = []
  let pIndex = 0
  for (const c of chunks) {
    out.push(c)
    if (frameType(c.data) === 'P') {
      if (pIndex % period === 0) {
        for (let i = 0; i < extra; i++) out.push(c)
      }
      pIndex += 1
    }
  }
  return out
}

/**
 * Bloom burst: drop interior keyframes, then find the single strongest-motion
 * P-frame (largest chunk) and repeat it many times in place — the explosive,
 * psychedelic bloom. `intensity` scales the repeat count (~4–48).
 */
export function bloomBurst(chunks: AviChunk[], intensity = 0.7, seed = DEFAULT_SEED): AviChunk[] {
  const bloomed = bloom(chunks, 1, seed)
  // Index of the strongest P-frame.
  let best = -1
  let bestLen = -1
  for (let i = 0; i < bloomed.length; i++) {
    if (frameType(bloomed[i].data) === 'P' && bloomed[i].data.length > bestLen) {
      bestLen = bloomed[i].data.length
      best = i
    }
  }
  if (best < 0) return bloomed
  const copies = Math.round(lerp(4, 48, intensity))
  const burst = Array.from({ length: copies }, () => bloomed[best])
  return [...bloomed.slice(0, best + 1), ...burst, ...bloomed.slice(best + 1)]
}

/**
 * Shuffle: drop interior keyframes, then shuffle the predicted frames in blocks
 * so motion is re-applied out of order — chaotic scramble. Higher intensity uses
 * smaller blocks (finer chaos).
 */
export function shuffle(chunks: AviChunk[], intensity = 0.5, seed = DEFAULT_SEED): AviChunk[] {
  const bloomed = bloom(chunks, 1, seed)
  const { seed: head, rest } = splitSeed(bloomed)
  const block = Math.max(1, Math.round(lerp(8, 1, intensity)))
  const blocks: AviChunk[][] = []
  for (let i = 0; i < rest.length; i += block) blocks.push(rest.slice(i, i + block))
  const rng = mulberry32(seed ^ 0x9e3779b9)
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[blocks[i], blocks[j]] = [blocks[j], blocks[i]]
  }
  return [...head, ...blocks.flat()]
}

/**
 * Sort: drop interior keyframes, then order the predicted frames by motion
 * magnitude (strongest first) so the smear builds and resolves unnaturally.
 */
export function sortByMotion(chunks: AviChunk[]): AviChunk[] {
  const bloomed = bloom(chunks, 1)
  const { seed: head, rest } = splitSeed(bloomed)
  const sorted = rest.slice().sort((a, b) => b.data.length - a.data.length)
  return [...head, ...sorted]
}

/**
 * Reverse: drop interior keyframes, then reverse the predicted frames so motion
 * plays backward over forward content.
 */
export function reverse(chunks: AviChunk[]): AviChunk[] {
  const bloomed = bloom(chunks, 1)
  const { seed: head, rest } = splitSeed(bloomed)
  return [...head, ...rest.reverse()]
}

/**
 * Transition bloom: concatenate clip A and clip B, dropping B's leading
 * keyframe(s) at the cut so A's final motion bleeds into B.
 */
export function transition(a: AviChunk[], b: AviChunk[]): AviChunk[] {
  let i = 0
  while (i < b.length && frameType(b[i].data) === 'I') i += 1
  return [...a, ...b.slice(i)]
}

/** A fractional [start, end] window over a clip (0..1). */
export interface Range {
  start: number
  end: number
}

export function isFullRange(range?: Range): boolean {
  return !range || (range.start <= 0 && range.end >= 1)
}

/**
 * Apply a frame transform to only a sub-window of the clip. Frames before/after
 * the window pass through untouched, so the moshed region is bracketed by clean
 * footage — the "mosh from here to there" workflow. The caller is responsible
 * for transcoding with keyframes inside `after` so the picture re-establishes.
 */
export function applyWindowed(
  transform: (chunks: AviChunk[]) => AviChunk[],
  chunks: AviChunk[],
  range?: Range,
): AviChunk[] {
  if (isFullRange(range)) return transform(chunks)
  const n = chunks.length
  const clamp = (v: number) => Math.max(0, Math.min(n, Math.round(v * n)))
  const s = clamp(range!.start)
  const e = Math.max(s, clamp(range!.end))
  const before = chunks.slice(0, s)
  const window = chunks.slice(s, e)
  const after = chunks.slice(e)
  return [...before, ...transform(window), ...after]
}

/** Tiny deterministic PRNG (mulberry32) returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
