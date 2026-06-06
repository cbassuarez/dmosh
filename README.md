# dmosh

a simple, effective way to datamosh video clips. 

[![Release](https://img.shields.io/badge/release-v0.1.0-ff5135?style=flat-square)](https://github.com/cbassuarez/dmosh/releases/tag/v0.1.0)
[![CI and Deploy](https://github.com/cbassuarez/dmosh/actions/workflows/ci.yml/badge.svg)](https://github.com/cbassuarez/dmosh/actions/workflows/ci.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-37f5a5?style=flat-square)](https://cbassuarez.github.io/dmosh/)
[![License: MIT](https://img.shields.io/badge/license-MIT-111111?style=flat-square)](LICENSE)

https://github.com/user-attachments/assets/ccf1ede2-08ca-45e9-ac76-cc19ab3e0098

dmosh transcodes video to MPEG-4/AVI with [ffmpeg.wasm](https://ffmpegwasm.netlify.app/),
edits the raw frame stream, re-encodes to MP4. 

It runs the single-threaded ffmpeg core, self-hosted from `public/ffmpeg/`, so it
works on static hosting (GitHub Pages) with no special headers. Short clips
(a few seconds, ≤~720p) mosh fastest; the engine is memory-bound in the browser.
The `MoshBackend` seam in `src/mosh/backend.ts` is where a future native
server-side "heavy mode" would plug in.

## Release

Current release: [v0.1.1](https://github.com/cbassuarez/dmosh/releases/tag/v0.1.1).

This release establishes the public browser app surface: codec-based datamosh
effects, GPU optical-flow smear, transition controls, exact baked previews, a
GitHub Pages deployment path, and release metadata in the app header. See
[CHANGELOG.md](CHANGELOG.md) for release notes.

## How it works

| File | Role |
| --- | --- |
| `src/mosh/ffmpeg.ts` | Loads + caches the ffmpeg.wasm singleton |
| `src/mosh/avi.ts` | Parses/writes AVI and classifies MPEG-4 I/P frames |
| `src/mosh/ops.ts` | Pure bloom / stutter / transition transforms |
| `src/mosh/datamosh.ts` | Orchestrates transcode → mosh → re-encode |
| `src/mosh/backend.ts` | Backend interface (client now, server later) |
| `src/app/MoshApp.tsx` | The single-screen UI |

The ffmpeg core is copied from `node_modules` into `public/ffmpeg/` by
`scripts/copy-ffmpeg-core.mjs` (runs automatically on `predev`/`prebuild`); it is
gitignored, not committed.
