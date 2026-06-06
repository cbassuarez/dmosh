// Minimal AVI (RIFF) reader/writer for datamoshing.
//
// We transcode source video to AVI with the MPEG-4 part 2 video codec (one
// keyframe per GOP, no B-frames, no audio). That container stores every frame
// as its own `00dc` chunk inside the `movi` LIST, and each frame's coding type
// (I / P) is readable from the MPEG-4 VOP header. Datamoshing is then just
// editing that flat list of frame chunks — dropping keyframes (bloom),
// duplicating predicted frames (stutter), or splicing two clips (transition) —
// and re-muxing.
//
// References: RIFF/AVI chunk layout; MPEG-4 part 2 VOP start code 0x000001B6.

export type FrameType = 'I' | 'P' | 'B' | 'S' | '?'

export interface AviChunk {
  /** FourCC, e.g. "00dc" (compressed video) or "00db" (uncompressed). */
  id: string
  data: Uint8Array
}

export interface ParsedAvi {
  /** Everything before the `movi` LIST body — reused verbatim when re-muxing. */
  head: Uint8Array
  /** Frame chunks from the `movi` LIST, in stream order. */
  chunks: AviChunk[]
}

function readFourCC(bytes: Uint8Array, o: number): string {
  return String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3])
}

function isVideoChunkId(id: string): boolean {
  // "##dc" (compressed) / "##db" (uncompressed) for stream ##.
  return /^\d\d(dc|db)$/.test(id)
}

/** Parse an AVI byte stream into its pre-`movi` header and its frame chunks. */
export function parseAvi(bytes: Uint8Array): ParsedAvi {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u32 = (o: number) => view.getUint32(o, true)

  if (readFourCC(bytes, 0) !== 'RIFF' || readFourCC(bytes, 8) !== 'AVI ') {
    throw new Error('Not an AVI RIFF stream')
  }

  // Locate the `movi` LIST. We descend into every LIST so the walk naturally
  // reaches the nested `movi` LIST regardless of how hdrl/strl are arranged.
  let moviStart = -1
  let moviEnd = -1
  for (let i = 12; i + 8 <= bytes.length; ) {
    const id = readFourCC(bytes, i)
    const size = u32(i + 4)
    if (id === 'LIST') {
      const listType = readFourCC(bytes, i + 8)
      if (listType === 'movi') {
        moviStart = i + 12
        moviEnd = i + 8 + size
        break
      }
      i += 12 // descend into this LIST's body
      continue
    }
    i += 8 + size + (size & 1) // chunks are word-aligned
  }
  if (moviStart < 0) throw new Error('AVI has no movi LIST')

  const chunks: AviChunk[] = []
  for (let i = moviStart; i + 8 <= moviEnd; ) {
    const id = readFourCC(bytes, i)
    const size = u32(i + 4)
    if (isVideoChunkId(id)) {
      chunks.push({ id, data: bytes.subarray(i + 8, i + 8 + size) })
    }
    i += 8 + size + (size & 1)
  }

  // head = everything up to (but not including) the `LIST size movi` header.
  return { head: bytes.subarray(0, moviStart - 12), chunks }
}

/**
 * Classify an MPEG-4 part 2 frame chunk by scanning for the VOP start code
 * (00 00 01 B6); the two bits after it are vop_coding_type.
 */
export function frameType(data: Uint8Array): FrameType {
  for (let i = 0; i + 4 < data.length; i++) {
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1 && data[i + 3] === 0xb6) {
      const ct = (data[i + 4] >> 6) & 0x3
      return ct === 0 ? 'I' : ct === 1 ? 'P' : ct === 2 ? 'B' : 'S'
    }
  }
  return '?'
}

/** Convenience: the I/P/B/S/? type of every chunk, in order. */
export function frameTypes(chunks: AviChunk[]): FrameType[] {
  return chunks.map((c) => frameType(c.data))
}

/**
 * Re-mux a header + frame chunk list back into a valid AVI. The original `idx1`
 * index is intentionally dropped (we don't copy it and don't rebuild it):
 * ffmpeg re-derives timing from the chunk stream on the re-encode pass, which
 * keeps this simple and robust to inserted/removed frames.
 */
export function writeAvi(head: Uint8Array, chunks: AviChunk[]): Uint8Array {
  let moviBodyLen = 0
  for (const c of chunks) {
    moviBodyLen += 8 + c.data.length + (c.data.length & 1)
  }

  const total = head.length + 12 + moviBodyLen
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)

  out.set(head, 0)
  let p = head.length

  // `LIST <size> movi`
  out[p] = 0x4c // L
  out[p + 1] = 0x49 // I
  out[p + 2] = 0x53 // S
  out[p + 3] = 0x54 // T
  view.setUint32(p + 4, moviBodyLen + 4, true)
  out[p + 8] = 0x6d // m
  out[p + 9] = 0x6f // o
  out[p + 10] = 0x76 // v
  out[p + 11] = 0x69 // i
  p += 12

  for (const c of chunks) {
    out[p] = c.id.charCodeAt(0)
    out[p + 1] = c.id.charCodeAt(1)
    out[p + 2] = c.id.charCodeAt(2)
    out[p + 3] = c.id.charCodeAt(3)
    view.setUint32(p + 4, c.data.length, true)
    out.set(c.data, p + 8)
    p += 8 + c.data.length
    if (c.data.length & 1) {
      out[p] = 0
      p += 1
    }
  }

  // Fix the top-level RIFF size (file length minus the 8-byte RIFF header).
  view.setUint32(4, out.length - 8, true)
  return out
}
