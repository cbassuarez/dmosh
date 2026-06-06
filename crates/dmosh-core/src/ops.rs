//! Pure datamosh operations over a flat list of AVI frame chunks — a port of
//! `src/mosh/ops.ts`. Chunk cloning is cheap (the data is `Rc`-shared).

use crate::avi::{frame_type, Chunk};

#[derive(Clone, Copy)]
pub struct DropTargets {
    pub i: bool,
    pub p: bool,
}
pub const DEFAULT_TARGETS: DropTargets = DropTargets { i: true, p: false };

fn clamp01(x: f32) -> f32 {
    x.max(0.0).min(1.0)
}
fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * clamp01(t)
}

fn mulberry32(seed: u32) -> impl FnMut() -> f64 {
    let mut s = seed;
    move || {
        s = s.wrapping_add(0x6d2b79f5);
        let mut t = s;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }
}

fn split_seed(chunks: &[Chunk]) -> (Vec<Chunk>, Vec<Chunk>) {
    if chunks.is_empty() {
        return (vec![], vec![]);
    }
    (vec![chunks[0].clone()], chunks[1..].to_vec())
}

/// Keep the first keyframe as a seed, drop every later keyframe.
pub fn strip_interior_keyframes(chunks: &[Chunk]) -> Vec<Chunk> {
    let mut seen = false;
    chunks
        .iter()
        .filter(|c| {
            if frame_type(&c.data) != b'I' {
                return true;
            }
            if !seen {
                seen = true;
                return true;
            }
            false
        })
        .cloned()
        .collect()
}

/// Bloom: duplicate every predicted frame so its motion re-applies — the
/// continuous melt. `intensity` sets extra copies per P-frame (1..4).
pub fn bloom(chunks: &[Chunk], intensity: f32) -> Vec<Chunk> {
    let copies = 1 + (clamp01(intensity) * 3.0).round() as usize;
    let mut out = Vec::with_capacity(chunks.len() * (copies + 1));
    for c in chunks {
        out.push(c.clone());
        if frame_type(&c.data) == b'P' {
            for _ in 0..copies {
                out.push(c.clone());
            }
        }
    }
    out
}

/// Stutter: periodically repeat predicted frames. `intensity` is the rate;
/// `repeat` (optional) the explicit copies per hit.
pub fn stutter(chunks: &[Chunk], intensity: f32, repeat: Option<u32>) -> Vec<Chunk> {
    let t = clamp01(intensity);
    if t <= 0.0 {
        return chunks.to_vec();
    }
    let period = ((16.0 * (1.0 - t)).round() as usize).max(1);
    let extra = repeat
        .map(|r| (r as usize).max(1))
        .unwrap_or_else(|| ((8.0 * t).round() as usize).max(1));

    let mut out = Vec::new();
    let mut p_index = 0usize;
    for c in chunks {
        out.push(c.clone());
        if frame_type(&c.data) == b'P' {
            if p_index % period == 0 {
                for _ in 0..extra {
                    out.push(c.clone());
                }
            }
            p_index += 1;
        }
    }
    out
}

/// Bloom burst: repeat the single strongest-motion P-frame many times.
pub fn bloom_burst(chunks: &[Chunk], intensity: f32) -> Vec<Chunk> {
    let mut best: isize = -1;
    let mut best_len = 0usize;
    for (i, c) in chunks.iter().enumerate() {
        if frame_type(&c.data) == b'P' && c.data.len() > best_len {
            best_len = c.data.len();
            best = i as isize;
        }
    }
    if best < 0 {
        return chunks.to_vec();
    }
    let best = best as usize;
    let copies = lerp(8.0, 50.0, intensity).round() as usize;
    let mut out = Vec::with_capacity(chunks.len() + copies);
    out.extend_from_slice(&chunks[..=best]);
    for _ in 0..copies {
        out.push(chunks[best].clone());
    }
    out.extend_from_slice(&chunks[best + 1..]);
    out
}

/// Shuffle: drop interior keyframes, then shuffle predicted frames in blocks.
pub fn shuffle(chunks: &[Chunk], intensity: f32, seed: u32) -> Vec<Chunk> {
    let stripped = strip_interior_keyframes(chunks);
    let (head, rest) = split_seed(&stripped);
    let block = (lerp(8.0, 1.0, intensity).round() as usize).max(1);
    let mut blocks: Vec<Vec<Chunk>> = rest.chunks(block).map(|b| b.to_vec()).collect();
    let mut rng = mulberry32(seed ^ 0x9e37_79b9);
    let mut i = blocks.len();
    while i > 1 {
        i -= 1;
        let j = (rng() * (i as f64 + 1.0)).floor() as usize;
        blocks.swap(i, j);
    }
    let mut out = head;
    for b in blocks {
        out.extend(b);
    }
    out
}

/// Sort: drop interior keyframes, then order predicted frames by motion energy.
pub fn sort_by_motion(chunks: &[Chunk]) -> Vec<Chunk> {
    let stripped = strip_interior_keyframes(chunks);
    let (head, mut rest) = split_seed(&stripped);
    rest.sort_by(|a, b| b.data.len().cmp(&a.data.len()));
    let mut out = head;
    out.extend(rest);
    out
}

/// Reverse: drop interior keyframes, then reverse predicted frames.
pub fn reverse(chunks: &[Chunk]) -> Vec<Chunk> {
    let stripped = strip_interior_keyframes(chunks);
    let (head, mut rest) = split_seed(&stripped);
    rest.reverse();
    let mut out = head;
    out.extend(rest);
    out
}

/// Transition: concat A + B, stripping targeted frame types from a leading
/// window of B (length `bleed`) so A melts into B.
pub fn transition(a: &[Chunk], b: &[Chunk], targets: DropTargets, bleed: f32) -> Vec<Chunk> {
    let window_len = ((clamp01(bleed) * b.len() as f32).round() as usize).max(1);
    let mut out = a.to_vec();
    for (i, c) in b.iter().enumerate() {
        let t = frame_type(&c.data);
        let in_window = i < window_len;
        let drop = in_window && ((t == b'I' && targets.i) || (t == b'P' && targets.p));
        if !drop {
            out.push(c.clone());
        }
    }
    out
}

/// Apply a transform to only a fractional sub-window of the clip.
pub fn apply_windowed<F>(transform: F, chunks: &[Chunk], range: Option<(f32, f32)>) -> Vec<Chunk>
where
    F: Fn(&[Chunk]) -> Vec<Chunk>,
{
    let (start, end) = match range {
        Some((s, e)) if !(s <= 0.0 && e >= 1.0) => (s, e),
        _ => return transform(chunks),
    };
    let n = chunks.len();
    let clamp = |v: f32| ((v * n as f32).round() as usize).min(n);
    let s = clamp(start);
    let e = clamp(end).max(s);
    let mut out = chunks[..s].to_vec();
    out.extend(transform(&chunks[s..e]));
    out.extend_from_slice(&chunks[e..]);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::avi::frame_type;
    use std::rc::Rc;

    fn f(t: u8, payload: usize) -> Chunk {
        let ct = if t == b'I' { 0x00 } else { 0x40 };
        let mut data = vec![0u8, 0, 1, 0xb6, ct];
        data.extend((0..payload).map(|i| (i + 1) as u8));
        Chunk { id: *b"00dc", data: Rc::from(data.as_slice()) }
    }
    fn stream(p: &str) -> Vec<Chunk> {
        p.bytes().map(|b| f(b, 4)).collect()
    }
    fn count_i(c: &[Chunk]) -> usize {
        c.iter().filter(|x| frame_type(&x.data) == b'I').count()
    }

    #[test]
    fn bloom_duplicates_p_frames() {
        let out = bloom(&stream("IPPP"), 1.0); // 4 extra each → P becomes 5
        assert_eq!(out.len(), 1 + 3 * 5);
        assert_eq!(count_i(&out), 1);
    }

    #[test]
    fn stutter_repeat_count() {
        let out = stutter(&stream("IPPP"), 1.0, Some(3)); // every P, +3
        assert_eq!(out.len(), 1 + 3 * 4);
        assert_eq!(count_i(&out), 1);
    }

    #[test]
    fn transition_bleed() {
        let a = stream("IPP");
        let b = stream("IPPIPP"); // keyframes at 0 and 3
        let cut = transition(&a, &b, DEFAULT_TARGETS, 0.0);
        let types: String = cut.iter().map(|c| frame_type(&c.data) as char).collect();
        assert_eq!(types, "IPPPPIPP");
        let full = transition(&a, &b, DEFAULT_TARGETS, 1.0);
        let types: String = full.iter().map(|c| frame_type(&c.data) as char).collect();
        assert_eq!(types, "IPPPPPP");
    }

    #[test]
    fn windowed_only_touches_window() {
        let drop_all = |cs: &[Chunk]| -> Vec<Chunk> {
            cs.iter().filter(|c| frame_type(&c.data) != b'I').cloned().collect()
        };
        let chunks = stream("IPPIPPIPP");
        let out = apply_windowed(drop_all, &chunks, Some((3.0 / 9.0, 6.0 / 9.0)));
        let types: String = out.iter().map(|c| frame_type(&c.data) as char).collect();
        assert_eq!(types, "IPPPPIPP");
    }
}
