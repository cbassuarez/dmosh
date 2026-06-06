//! Minimal AVI (RIFF) reader/writer for datamoshing — a faithful port of
//! `src/mosh/avi.ts`. Frame chunk data is `Rc`-shared so the duplication effects
//! (which repeat the same frame many times) stay cheap.

use std::rc::Rc;

#[derive(Clone)]
pub struct Chunk {
    pub id: [u8; 4],
    pub data: Rc<[u8]>,
}

pub struct ParsedAvi {
    /// Everything before the `movi` LIST body — reused verbatim when re-muxing.
    pub head: Vec<u8>,
    pub chunks: Vec<Chunk>,
}

fn u32_le(b: &[u8], o: usize) -> u32 {
    u32::from_le_bytes([b[o], b[o + 1], b[o + 2], b[o + 3]])
}

fn fourcc(b: &[u8], o: usize) -> [u8; 4] {
    [b[o], b[o + 1], b[o + 2], b[o + 3]]
}

fn is_video_chunk(id: &[u8; 4]) -> bool {
    id[0].is_ascii_digit() && id[1].is_ascii_digit() && (&id[2..] == b"dc" || &id[2..] == b"db")
}

/// Parse an AVI byte stream into its pre-`movi` header and its frame chunks.
pub fn parse_avi(bytes: &[u8]) -> Result<ParsedAvi, String> {
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"AVI " {
        return Err("not an AVI RIFF stream".into());
    }

    // Locate the `movi` LIST, descending into every LIST.
    let mut movi_start = usize::MAX;
    let mut movi_end = 0usize;
    let mut i = 12usize;
    while i + 8 <= bytes.len() {
        let id = fourcc(bytes, i);
        let size = u32_le(bytes, i + 4) as usize;
        if &id == b"LIST" {
            if &bytes[i + 8..i + 12] == b"movi" {
                movi_start = i + 12;
                movi_end = i + 8 + size;
                break;
            }
            i += 12; // descend
            continue;
        }
        i += 8 + size + (size & 1);
    }
    if movi_start == usize::MAX {
        return Err("AVI has no movi LIST".into());
    }

    let mut chunks = Vec::new();
    let mut j = movi_start;
    while j + 8 <= movi_end.min(bytes.len()) {
        let id = fourcc(bytes, j);
        let size = u32_le(bytes, j + 4) as usize;
        if is_video_chunk(&id) {
            let end = (j + 8 + size).min(bytes.len());
            chunks.push(Chunk {
                id,
                data: Rc::from(&bytes[j + 8..end]),
            });
        }
        j += 8 + size + (size & 1);
    }

    Ok(ParsedAvi {
        head: bytes[0..movi_start - 12].to_vec(),
        chunks,
    })
}

/// Classify an MPEG-4 part 2 frame chunk by its VOP coding type.
pub fn frame_type(data: &[u8]) -> u8 {
    let mut i = 0;
    while i + 4 < data.len() {
        if data[i] == 0 && data[i + 1] == 0 && data[i + 2] == 1 && data[i + 3] == 0xb6 {
            return match (data[i + 4] >> 6) & 0x3 {
                0 => b'I',
                1 => b'P',
                2 => b'B',
                _ => b'S',
            };
        }
        i += 1;
    }
    b'?'
}

/// Patch `avih.dwTotalFrames` and the video `strh.dwLength` to match the new
/// chunk count, so ffmpeg computes the right duration (otherwise its progress
/// hits 100% early and it keeps encoding silently).
fn patch_frame_counts(out: &mut [u8], head_len: usize, frame_count: u32) {
    let mut i = 12usize;
    while i + 8 <= head_len {
        let id = fourcc(out, i);
        let size = u32_le(out, i + 4) as usize;
        if &id == b"LIST" {
            i += 12;
            continue;
        }
        if &id == b"avih" {
            out[i + 8 + 16..i + 8 + 20].copy_from_slice(&frame_count.to_le_bytes());
        } else if &id == b"strh" && &out[i + 8..i + 12] == b"vids" {
            out[i + 8 + 32..i + 8 + 36].copy_from_slice(&frame_count.to_le_bytes());
        }
        i += 8 + size + (size & 1);
    }
}

/// Re-mux a header + frame chunk list back into a valid AVI. The original index
/// is dropped; ffmpeg re-derives timing from the chunk stream.
pub fn write_avi(head: &[u8], chunks: &[Chunk]) -> Vec<u8> {
    let mut movi_body_len = 0usize;
    for c in chunks {
        movi_body_len += 8 + c.data.len() + (c.data.len() & 1);
    }

    let total = head.len() + 12 + movi_body_len;
    let mut out = vec![0u8; total];
    out[0..head.len()].copy_from_slice(head);
    patch_frame_counts(&mut out, head.len(), chunks.len() as u32);

    let mut p = head.len();
    out[p..p + 4].copy_from_slice(b"LIST");
    out[p + 4..p + 8].copy_from_slice(&((movi_body_len + 4) as u32).to_le_bytes());
    out[p + 8..p + 12].copy_from_slice(b"movi");
    p += 12;

    for c in chunks {
        out[p..p + 4].copy_from_slice(&c.id);
        out[p + 4..p + 8].copy_from_slice(&(c.data.len() as u32).to_le_bytes());
        out[p + 8..p + 8 + c.data.len()].copy_from_slice(&c.data);
        p += 8 + c.data.len();
        if c.data.len() & 1 == 1 {
            out[p] = 0;
            p += 1;
        }
    }

    let riff_size = (out.len() - 8) as u32;
    out[4..8].copy_from_slice(&riff_size.to_le_bytes());
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(t: u8, payload: usize) -> Chunk {
        let ct = match t {
            b'I' => 0x00,
            b'P' => 0x40,
            b'B' => 0x80,
            _ => 0xc0,
        };
        let mut data = vec![0u8, 0, 1, 0xb6, ct];
        data.extend((0..payload).map(|i| (i + 1) as u8));
        Chunk {
            id: *b"00dc",
            data: Rc::from(data.as_slice()),
        }
    }

    fn head() -> Vec<u8> {
        let mut h = vec![0u8; 12];
        h[0..4].copy_from_slice(b"RIFF");
        h[8..12].copy_from_slice(b"AVI ");
        h
    }

    #[test]
    fn classifies_vop_types() {
        assert_eq!(frame_type(&frame(b'I', 4).data), b'I');
        assert_eq!(frame_type(&frame(b'P', 4).data), b'P');
        assert_eq!(frame_type(&[1, 2, 3, 4, 5]), b'?');
    }

    #[test]
    fn round_trips_chunks() {
        let chunks = vec![frame(b'I', 4), frame(b'P', 3), frame(b'P', 6)];
        let bytes = write_avi(&head(), &chunks);
        let parsed = parse_avi(&bytes).unwrap();
        assert_eq!(parsed.chunks.len(), 3);
        for (a, b) in parsed.chunks.iter().zip(chunks.iter()) {
            assert_eq!(&a.data[..], &b.data[..]);
        }
        // RIFF size field is correct.
        assert_eq!(u32_le(&bytes, 4) as usize, bytes.len() - 8);
    }
}
