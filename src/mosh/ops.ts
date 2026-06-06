// Pure datamosh operations over a flat list of AVI frame chunks. No ffmpeg here,
// so these are deterministic and unit-testable.
//
// A useful free signal: a P-frame chunk's byte length (`data.length`) tracks how
// much it changed from the previous frame — i.e. roughly its motion/residual
// magnitude. Several effects below exploit that (strongest-frame bloom, sort).
import type { AviChunk } from './avi'
import { frameType } from './avi'

const DEFAULT_SEED = 0x6d6f7368 // "mosh"

/** Which frame types an effect is allowed to strip. */
export interface DropTargets {
  i: boolean
  p: boolean
}
const DEFAULT_TARGETS: DropTargets = { i: true, p: false }

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

/** Keep the first keyframe as a seed, drop every later keyframe. */
export function stripInteriorKeyframes(chunks: AviChunk[]): AviChunk[] {
  let seenFirst = false
  return chunks.filter((c) => {
    if (frameType(c.data) !== 'I') return true
    if (!seenFirst) {
      seenFirst = true
      return true
    }
    return false
  })
}

/**
 * Bloom / smear: duplicate every predicted frame so its motion vectors re-apply
 * to already-moved content — the signature melt that drags and streaks. This is
 * the real single-clip datamosh: unlike stripping keyframes (which only melts at
 * a cut), repeating motion accumulates the smear within continuous footage.
 * `intensity` sets how many extra copies each P-frame gets (1–4).
 */
export function bloom(chunks: AviChunk[], intensity = 0.7): AviChunk[] {
  const copies = 1 + Math.round(clamp01(intensity) * 3)
  const out: AviChunk[] = []
  for (const c of chunks) {
    out.push(c)
    if (frameType(c.data) === 'P') {
      for (let k = 0; k < copies; k++) out.push(c)
    }
  }
  return out
}

/**
 * Stutter / P-frame repeat: periodically duplicate predicted frames so their
 * motion vectors re-apply, freezing/echoing motion into a glitchy judder.
 * `intensity` is the rate (how often a P-frame is repeated); `repeat`, when
 * given, is the explicit number of extra copies per hit (else derived from rate).
 */
export function stutter(chunks: AviChunk[], intensity = 0.5, repeat?: number): AviChunk[] {
  const t = clamp01(intensity)
  if (t <= 0) return chunks.slice()
  const period = Math.max(1, Math.round(16 * (1 - t)))
  const extra = repeat != null ? Math.max(1, Math.round(repeat)) : Math.max(1, Math.round(8 * t))

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
 * Bloom burst: find the single strongest-motion P-frame (largest chunk) and
 * repeat it many times in place — one explosive, psychedelic pulse rather than a
 * continuous melt. `intensity` scales the repeat count (~8–50).
 */
export function bloomBurst(chunks: AviChunk[], intensity = 0.7): AviChunk[] {
  let best = -1
  let bestLen = -1
  for (let i = 0; i < chunks.length; i++) {
    if (frameType(chunks[i].data) === 'P' && chunks[i].data.length > bestLen) {
      bestLen = chunks[i].data.length
      best = i
    }
  }
  if (best < 0) return chunks.slice()
  const copies = Math.round(lerp(8, 50, intensity))
  const burst = Array.from({ length: copies }, () => chunks[best])
  return [...chunks.slice(0, best + 1), ...burst, ...chunks.slice(best + 1)]
}

/**
 * Shuffle: drop interior keyframes, then shuffle the predicted frames in blocks
 * so motion is re-applied out of order — chaotic scramble. Higher intensity uses
 * smaller blocks (finer chaos).
 */
export function shuffle(chunks: AviChunk[], intensity = 0.5, seed = DEFAULT_SEED): AviChunk[] {
  const stripped = stripInteriorKeyframes(chunks)
  const { seed: head, rest } = splitSeed(stripped)
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
  const stripped = stripInteriorKeyframes(chunks)
  const { seed: head, rest } = splitSeed(stripped)
  const sorted = rest.slice().sort((a, b) => b.data.length - a.data.length)
  return [...head, ...sorted]
}

/**
 * Reverse: drop interior keyframes, then reverse the predicted frames so motion
 * plays backward over forward content.
 */
export function reverse(chunks: AviChunk[]): AviChunk[] {
  const stripped = stripInteriorKeyframes(chunks)
  const { seed: head, rest } = splitSeed(stripped)
  return [...head, ...rest.reverse()]
}

/**
 * Transition / classic datamosh: concatenate clip A and clip B, then strip the
 * targeted frame types from a leading window of B so A's motion bleeds into B.
 * `bleed` (0..1) is how far into B that window reaches — small/0 strips just the
 * cut keyframe (classic); larger keeps A melting through more of B. `targets`
 * selects I-frame and/or P-frame removal.
 */
export function transition(
  a: AviChunk[],
  b: AviChunk[],
  targets: DropTargets = DEFAULT_TARGETS,
  bleed = 0,
): AviChunk[] {
  const windowLen = Math.max(1, Math.round(clamp01(bleed) * b.length))
  const out = [...a]
  for (let i = 0; i < b.length; i++) {
    const t = frameType(b[i].data)
    const inWindow = i < windowLen
    const drop = inWindow && ((t === 'I' && targets.i) || (t === 'P' && targets.p))
    if (!drop) out.push(b[i])
  }
  return out
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
