import { describe, it, expect } from 'vitest'
import { parseAvi, writeAvi, frameType, frameTypes, type AviChunk, type FrameType } from './avi'
import {
  bloom,
  bloomBurst,
  stutter,
  shuffle,
  sortByMotion,
  reverse,
  transition,
  applyWindowed,
  isFullRange,
} from './ops'

// Build a frame chunk whose MPEG-4 VOP header encodes the given coding type.
const CT_BYTE: Record<'I' | 'P' | 'B' | 'S', number> = {
  I: 0x00, // 00xxxxxx
  P: 0x40, // 01xxxxxx
  B: 0x80, // 10xxxxxx
  S: 0xc0, // 11xxxxxx
}
function makeFrame(type: 'I' | 'P' | 'B' | 'S', payload = 4): AviChunk {
  const data = new Uint8Array(5 + payload)
  data.set([0x00, 0x00, 0x01, 0xb6, CT_BYTE[type]], 0)
  for (let i = 0; i < payload; i++) data[5 + i] = (i + 1) & 0xff
  return { id: '00dc', data }
}
function makeStream(pattern: string): AviChunk[] {
  return pattern.split('').map((t) => makeFrame(t as 'I' | 'P' | 'B' | 'S'))
}

// Minimal valid pre-movi AVI header: "RIFF" + size + "AVI ".
const HEAD = (() => {
  const h = new Uint8Array(12)
  h.set([0x52, 0x49, 0x46, 0x46], 0) // RIFF
  h.set([0x41, 0x56, 0x49, 0x20], 8) // "AVI "
  return h
})()

describe('frameType', () => {
  it('classifies I/P/B/S from the VOP coding type bits', () => {
    expect(frameType(makeFrame('I').data)).toBe('I')
    expect(frameType(makeFrame('P').data)).toBe('P')
    expect(frameType(makeFrame('B').data)).toBe('B')
    expect(frameType(makeFrame('S').data)).toBe('S')
  })
  it('returns ? when no VOP start code is present', () => {
    expect(frameType(new Uint8Array([1, 2, 3, 4, 5]))).toBe('?')
  })
})

describe('parseAvi / writeAvi round-trip', () => {
  it('recovers the same frame chunks (incl. odd-length padding)', () => {
    const chunks = [makeFrame('I', 4), makeFrame('P', 3), makeFrame('P', 6)]
    const bytes = writeAvi(HEAD, chunks)
    const parsed = parseAvi(bytes)
    expect(parsed.chunks).toHaveLength(3)
    parsed.chunks.forEach((c, i) => {
      expect(c.id).toBe('00dc')
      expect(Array.from(c.data)).toEqual(Array.from(chunks[i].data))
    })
  })
  it('produces a valid RIFF/AVI size field', () => {
    const bytes = writeAvi(HEAD, makeStream('IPP'))
    const view = new DataView(bytes.buffer)
    expect(view.getUint32(4, true)).toBe(bytes.length - 8)
  })
})

describe('bloom', () => {
  it('duplicates every P-frame so motion accumulates into a melt', () => {
    // copies = 1 + round(intensity*3); at intensity 1 → 4 extra, so each P → 5.
    const out = bloom(makeStream('IPPP'), 1)
    expect(out.length).toBe(1 + 3 * 5) // I + three P's each expanded to 5
    expect(frameTypes(out).filter((t: FrameType) => t === 'I')).toHaveLength(1)
  })
  it('leaves I-frames untouched and keeps frame order', () => {
    const out = bloom(makeStream('IPP'), 0)
    // zero intensity still adds one copy per P (minimum melt)
    expect(frameType(out[0].data)).toBe('I')
    expect(frameTypes(out).filter((t: FrameType) => t === 'I')).toHaveLength(1)
  })
})

describe('stutter', () => {
  it('duplicates P-frames so the stream grows but keeps order/types monotonic', () => {
    const chunks = makeStream('IPPPPPPPP')
    const out = stutter(chunks, 1)
    expect(out.length).toBeGreaterThan(chunks.length)
    // Still exactly one I-frame, and it stays first.
    const types = frameTypes(out)
    expect(types[0]).toBe('I')
    expect(types.filter((t: FrameType) => t === 'I')).toHaveLength(1)
  })
  it('is a no-op at zero intensity', () => {
    const chunks = makeStream('IPPP')
    expect(stutter(chunks, 0)).toHaveLength(chunks.length)
  })
})

describe('transition', () => {
  it('drops the leading keyframe(s) of clip B at the cut', () => {
    const a = makeStream('IPP')
    const b = makeStream('IPP')
    const out = transition(a, b)
    // A intact, then B without its leading I → I P P P P
    expect(frameTypes(out).join('')).toBe('IPPPP')
    expect(out.length).toBe(5)
  })
})

describe('tier-A effects', () => {
  // Distinct payload sizes let us track frames through reorderings.
  const sized = (type: 'I' | 'P', payload: number) => makeFrame(type, payload)
  const sizesOf = (cs: AviChunk[]) => cs.map((c) => c.data.length)

  it('bloomBurst repeats the strongest-motion P-frame', () => {
    const chunks = [sized('I', 4), sized('P', 10), sized('P', 80), sized('P', 6)]
    const out = bloomBurst(chunks, 0.5)
    const strongLen = 5 + 80
    const count = out.filter((c) => c.data.length === strongLen).length
    expect(out.length).toBeGreaterThan(chunks.length)
    expect(count).toBeGreaterThan(1) // the strong frame was duplicated
    expect(frameTypes(out).filter((t: FrameType) => t === 'I')).toHaveLength(1)
  })

  it('sortByMotion orders predicted frames strongest-first after the seed', () => {
    const chunks = [sized('I', 4), sized('P', 10), sized('P', 80), sized('P', 6)]
    const out = sortByMotion(chunks)
    expect(frameType(out[0].data)).toBe('I')
    const rest = sizesOf(out.slice(1))
    expect(rest).toEqual([...rest].sort((a, b) => b - a)) // descending
  })

  it('reverse flips the predicted frames but keeps the seed first', () => {
    const chunks = [sized('I', 4), sized('P', 11), sized('P', 22), sized('P', 33)]
    const out = reverse(chunks)
    expect(frameType(out[0].data)).toBe('I')
    expect(sizesOf(out.slice(1))).toEqual([5 + 33, 5 + 22, 5 + 11])
  })

  it('shuffle is a permutation that keeps the seed first and is seed-stable', () => {
    const chunks = [sized('I', 4), sized('P', 11), sized('P', 22), sized('P', 33), sized('P', 44)]
    const a = shuffle(chunks, 0.9, 123)
    const b = shuffle(chunks, 0.9, 123)
    expect(frameType(a[0].data)).toBe('I')
    expect(a.length).toBe(chunks.length)
    expect(sizesOf(a).slice(1).sort()).toEqual(sizesOf(chunks).slice(1).sort()) // same multiset
    expect(sizesOf(a)).toEqual(sizesOf(b)) // deterministic for a given seed
  })
})

describe('frame-type controls', () => {
  it('stutter honours an explicit repeat count', () => {
    const out = stutter(makeStream('IPPP'), 1, 3) // every P, +3 copies each
    expect(out.length).toBe(1 + 3 * 4) // I + three P's each expanded to 4
    expect(frameTypes(out).filter((t: FrameType) => t === 'I')).toHaveLength(1)
  })

  it('transition bleed length controls how much of B is stripped', () => {
    const a = makeStream('IPP')
    const b = makeStream('IPPIPP') // keyframes at 0 and 3
    // bleed 0 → only the cut keyframe (classic)
    expect(frameTypes(transition(a, b, { i: true, p: false }, 0)).join('')).toBe('IPPPPIPP')
    // bleed 1 → strip every keyframe across B
    expect(frameTypes(transition(a, b, { i: true, p: false }, 1)).join('')).toBe('IPPPPPP')
  })
})

describe('applyWindowed', () => {
  // Stub transform: drop every keyframe. Lets us see exactly what's in-window.
  const dropAllI = (cs: AviChunk[]) => cs.filter((c) => frameType(c.data) !== 'I')

  it('treats a full/absent range as a whole-clip transform', () => {
    const chunks = makeStream('IPPIPPIPP')
    expect(isFullRange()).toBe(true)
    expect(isFullRange({ start: 0, end: 1 })).toBe(true)
    expect(applyWindowed(dropAllI, chunks).length).toBe(6) // all 3 I-frames dropped
  })

  it('only transforms frames inside the window, leaving the rest intact', () => {
    // 9 frames: I P P | I P P | I P P  → window = middle third (indices 3..6).
    const chunks = makeStream('IPPIPPIPP')
    const out = applyWindowed(dropAllI, chunks, { start: 3 / 9, end: 6 / 9 })
    // Only the middle I (index 3) is dropped; the outer two I-frames survive.
    expect(frameTypes(out).join('')).toBe('IPPPPIPP')
  })
})
