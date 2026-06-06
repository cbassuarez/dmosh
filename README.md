# dmosh

Add a clip, datamosh it, download the result — entirely in your browser. No
uploads, no accounts, no backend.

dmosh transcodes your video to MPEG-4/AVI with [ffmpeg.wasm](https://ffmpegwasm.netlify.app/),
edits the raw frame stream, then re-encodes to MP4. Effects:

- **Bloom** — strips interior keyframes so motion vectors smear across the wrong
  frame (the signature melt).
- **Bloom Burst** — repeats the strongest-motion frame into an explosive bloom.
- **Stutter** — duplicates predicted frames to freeze/echo motion into a judder.
- **Shuffle** — scrambles predicted frames out of order for chaotic glitch.
- **Sort** — reorders frames by motion energy (a frame's byte size ≈ its motion).
- **Reverse** — plays motion backward over the footage.
- **Transition** — splices two clips and drops the keyframe at the cut so clip A
  bleeds into clip B.

Plus a **mosh range** scrubber (mosh only part of the clip), a **keep-audio**
toggle (muxes the source audio back in), and **reroll/variation** for the
randomized effects. The transcode uses richer motion vectors (`-flags +mv4`,
`-trellis`, Xvid tag) and a sharp `-crf 18` final encode so the mosh stays crisp.

It runs the single-threaded ffmpeg core, self-hosted from `public/ffmpeg/`, so it
works on static hosting (GitHub Pages) with no special headers. Short clips
(a few seconds, ≤~720p) mosh fastest; the engine is memory-bound in the browser.
The `MoshBackend` seam in `src/mosh/backend.ts` is where a future native
server-side "heavy mode" would plug in.

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
