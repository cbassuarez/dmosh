//! Native datamosh orchestration: ffmpeg transcode → frame surgery → re-encode.
//! Mirrors `src/mosh/datamosh.ts` but shells out to a native ffmpeg (no wasm
//! ceiling, multithreaded, libx264 — we distribute directly, so GPL is fine).

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Deserialize;

use crate::avi::{parse_avi, write_avi, Chunk};
use crate::ops::{
    apply_windowed, bloom, bloom_burst, reverse, shuffle, sort_by_motion, stutter, transition,
    DropTargets,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoshOptions {
    pub effect: String,
    #[serde(default = "default_intensity")]
    pub intensity: f32,
    #[serde(default = "default_max_dim")]
    pub max_dimension: u32,
    #[serde(default)]
    pub keep_audio: bool,
    #[serde(default = "default_seed")]
    pub seed: u32,
    #[serde(default)]
    pub range: Option<(f32, f32)>,
    #[serde(default = "default_true")]
    pub drop_i: bool,
    #[serde(default)]
    pub drop_p: bool,
    #[serde(default)]
    pub repeat: Option<u32>,
}

fn default_intensity() -> f32 {
    0.7
}
fn default_max_dim() -> u32 {
    1280
}
fn default_seed() -> u32 {
    0x6d6f_7368
}
fn default_true() -> bool {
    true
}

fn clamp01(x: f32) -> f32 {
    x.max(0.0).min(1.0)
}
fn gop_for(effect: &str) -> u32 {
    if effect == "transition" {
        30
    } else {
        9999
    }
}
fn qscale_for(intensity: f32) -> u32 {
    4 + (clamp01(intensity) * 5.0).round() as u32
}

/// Progress sink: `(0..1, phase)`.
pub type Progress<'a> = dyn Fn(f32, &str) + 'a;

fn ffmpeg_bin() -> String {
    std::env::var("DMOSH_FFMPEG").unwrap_or_else(|_| "ffmpeg".to_string())
}

fn ff(args: &[&str]) -> Result<(), String> {
    let bin = ffmpeg_bin();
    let output = Command::new(&bin)
        .args(["-hide_banner", "-loglevel", "error", "-y"])
        .args(args)
        .output()
        .map_err(|e| format!("could not run ffmpeg ('{bin}'): {e}"))?;
    if !output.status.success() {
        let tail = String::from_utf8_lossy(&output.stderr);
        let tail = &tail[tail.len().saturating_sub(600)..];
        return Err(format!("ffmpeg failed: {tail}"));
    }
    Ok(())
}

fn fit_filter(max: u32) -> String {
    format!("scale='min({max},iw)':-2:flags=bicubic")
}
fn normalize_filter(w: u32, h: u32) -> String {
    format!(
        "scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
    )
}

fn transcode_to_chunks(
    input: &Path,
    out_avi: &Path,
    vfilter: &str,
    gop: u32,
    qscale: u32,
) -> Result<crate::avi::ParsedAvi, String> {
    ff(&[
        "-i",
        &input.to_string_lossy(),
        "-an",
        "-vf",
        vfilter,
        "-c:v",
        "mpeg4",
        "-vtag",
        "xvid",
        "-qscale:v",
        &qscale.to_string(),
        "-g",
        &gop.to_string(),
        "-bf",
        "0",
        &out_avi.to_string_lossy(),
    ])?;
    let bytes = std::fs::read(out_avi).map_err(|e| e.to_string())?;
    parse_avi(&bytes)
}

fn encode_to_mp4(
    avi_path: &Path,
    out_path: &Path,
    keep_audio: bool,
    audio_src: &Path,
) -> Result<(), String> {
    if keep_audio {
        let video = avi_path.with_extension("v.mp4");
        ff(&[
            "-i", &avi_path.to_string_lossy(),
            "-c:v", "libx264", "-crf", "18", "-preset", "medium",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
            &video.to_string_lossy(),
        ])?;
        // `1:a:0?` keeps the audio map optional — silent clips pass through.
        let muxed = ff(&[
            "-i", &video.to_string_lossy(),
            "-i", &audio_src.to_string_lossy(),
            "-map", "0:v:0", "-map", "1:a:0?",
            "-c:v", "copy", "-c:a", "aac", "-shortest",
            &out_path.to_string_lossy(),
        ]);
        if muxed.is_err() {
            std::fs::copy(&video, out_path).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    ff(&[
        "-i", &avi_path.to_string_lossy(),
        "-c:v", "libx264", "-crf", "18", "-preset", "medium",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
        &out_path.to_string_lossy(),
    ])
}

fn apply_single(effect: &str, chunks: &[Chunk], opts: &MoshOptions) -> Vec<Chunk> {
    match effect {
        "bloom" => bloom(chunks, opts.intensity),
        "bloomBurst" => bloom_burst(chunks, opts.intensity),
        "stutter" => stutter(chunks, opts.intensity, opts.repeat),
        "shuffle" => shuffle(chunks, opts.intensity, opts.seed),
        "sort" => sort_by_motion(chunks),
        "reverse" => reverse(chunks),
        _ => chunks.to_vec(),
    }
}

fn unique_workdir() -> Result<PathBuf, String> {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("dmosh-{}-{}", std::process::id(), nanos));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Datamosh one or two clips with native ffmpeg. Returns the output MP4 path.
pub fn mosh(inputs: &[PathBuf], opts: &MoshOptions, progress: &Progress) -> Result<PathBuf, String> {
    if opts.effect == "flow" {
        return Err("the Flow effect runs in the app's GPU preview, not the native engine".into());
    }
    if inputs.is_empty() {
        return Err("no input clip".into());
    }

    let dir = unique_workdir()?;
    let out = dir.join("out.mp4");
    let gop = gop_for(&opts.effect);
    let qscale = qscale_for(opts.intensity);
    let targets = DropTargets { i: opts.drop_i, p: opts.drop_p };

    if opts.effect == "transition" {
        if inputs.len() < 2 {
            return Err("transition needs two clips".into());
        }
        let w = (opts.max_dimension / 2) * 2;
        let h = (((opts.max_dimension as f32 * 9.0 / 16.0) / 2.0).round() as u32) * 2;
        let vf = normalize_filter(w, h);
        progress(0.05, "transcoding clip A");
        let a = transcode_to_chunks(&inputs[0], &dir.join("a.avi"), &vf, gop, qscale)?;
        progress(0.4, "transcoding clip B");
        let b = transcode_to_chunks(&inputs[1], &dir.join("b.avi"), &vf, gop, qscale)?;
        progress(0.8, "moshing");
        let moshed = write_avi(&a.head, &transition(&a.chunks, &b.chunks, targets, opts.intensity));
        let m = dir.join("m.avi");
        std::fs::write(&m, &moshed).map_err(|e| e.to_string())?;
        progress(0.85, "encoding");
        encode_to_mp4(&m, &out, opts.keep_audio, &inputs[0])?;
        progress(1.0, "done");
        return Ok(out);
    }

    progress(0.05, "transcoding");
    let parsed = transcode_to_chunks(&inputs[0], &dir.join("work.avi"), &fit_filter(opts.max_dimension), gop, qscale)?;
    progress(0.55, "moshing");
    let moshed_chunks = apply_windowed(
        |cs| apply_single(&opts.effect, cs, opts),
        &parsed.chunks,
        opts.range,
    );
    let moshed = write_avi(&parsed.head, &moshed_chunks);
    let m = dir.join("m.avi");
    std::fs::write(&m, &moshed).map_err(|e| e.to_string())?;
    progress(0.6, "encoding");
    encode_to_mp4(&m, &out, opts.keep_audio, &inputs[0])?;
    progress(1.0, "done");
    Ok(out)
}
