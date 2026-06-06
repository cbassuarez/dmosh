# dmosh

[![Release](https://img.shields.io/badge/release-v0.1.0-ff5135?style=flat-square)](https://github.com/cbassuarez/dmosh/releases/tag/v0.1.0)
[![CI and Deploy](https://github.com/cbassuarez/dmosh/actions/workflows/ci.yml/badge.svg)](https://github.com/cbassuarez/dmosh/actions/workflows/ci.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-37f5a5?style=flat-square)](https://cbassuarez.github.io/dmosh/)
[![License: MIT](https://img.shields.io/badge/license-MIT-111111?style=flat-square)](LICENSE)

Add a clip, datamosh it, download the result — entirely in your browser. No
uploads, no accounts, no backend.

dmosh transcodes your video to MPEG-4/AVI with [ffmpeg.wasm](https://ffmpegwasm.netlify.app/),
edits the raw frame stream, then re-encodes to MP4. Effects:

- **Flow** — a GPU smear: decodes frames with WebCodecs, computes optical flow,
  and feeds an accumulator buffer back through a motion-warp so a seed frame's
  pixels get dragged along the scene's motion. Reproduces the datamosh melt
  *natively* (no codec needed) and fast. Falls back to Bloom if WebCodecs/WebGL2
  isn't available. (Why a separate engine? Browser video decoders are conformant
  — they *drop* frames when keyframes go missing instead of smearing, so the
  codec-based melt below can't be done with WebCodecs. We compute the motion
  ourselves instead.)
- **Bloom** — duplicates predicted (P) frames so their motion re-applies to
  already-moved content: the signature continuous melt. (Duplication, *not*
  keyframe removal — stripping keyframes only melts at a content cut, so within a
  single continuous clip it barely moshes. See Transition for the keyframe trick.)
- **Bloom Burst** — repeats the strongest-motion frame into one explosive pulse.
- **Stutter** — repeats frames at intervals to freeze/echo motion into a judder.
- **Shuffle** — scrambles predicted frames out of order for chaotic glitch.
- **Sort** — reorders frames by motion energy (a frame's byte size ≈ its motion).
- **Reverse** — plays motion backward over the footage.
- **Transition** — splices two clips and strips I/P frames at the cut (with a
  Bleed control) so clip A's motion melts into clip B — classic datamosh.

Plus a **mosh range** scrubber (mosh only part of the clip), a **keep-audio**
toggle (muxes the source audio back in), and **reroll/variation** for the
randomized effects. The mosh source is encoded at a deliberately *low* quality
(amount-linked `-qscale` ~4–9, no `-mbd/-mv4/-trellis`): coarse residuals let the
motion vectors dominate so the smear reads instead of being corrected away.

It runs the single-threaded ffmpeg core, self-hosted from `public/ffmpeg/`, so it
works on static hosting (GitHub Pages) with no special headers. Short clips
(a few seconds, ≤~720p) mosh fastest; the engine is memory-bound in the browser.
The `MoshBackend` seam in `src/mosh/backend.ts` is where a future native
server-side "heavy mode" would plug in.

## Release

Current release: [v0.1.0](https://github.com/cbassuarez/dmosh/releases/tag/v0.1.0).

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

## Scripts
- `npm run dev` — start local dev server
- `npm run build` — type-check then build
- `npm run lint` — lint with ESLint
- `npm run test` — run Vitest unit tests (`src/mosh/avi.test.ts`)

## Deploy
Configured for GitHub Pages (`vite.config.ts` sets the `/dmosh/` base under
`GITHUB_PAGES_BASE`). The CI workflow lints, tests, builds, and deploys from `main`.
