# dmosh

a simple, effective way to datamosh video clips. 

[![Release](https://img.shields.io/github/v/release/cbassuarez/dmosh?style=flat-square&color=ff5135)](https://github.com/cbassuarez/dmosh/releases/latest)
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

Current release: [v0.2.0](https://github.com/cbassuarez/dmosh/releases/latest).

v0.2.0 adds the **native desktop app** (Tauri + a Rust engine, with an ffmpeg
sidecar and trial/license gating), a refined light-theme UI with a real-time
effect preview, technical effect names, a mosh-range scrubber, keep-audio, and an
auto-updating release badge. See [CHANGELOG.md](CHANGELOG.md) for full notes.

## How it works

| File | Role |
| --- | --- |
| `src/mosh/ffmpeg.ts` | Loads + caches the ffmpeg.wasm singleton |
| `src/mosh/avi.ts` | Parses/writes AVI and classifies MPEG-4 I/P frames |
| `src/mosh/ops.ts` | Pure bloom / stutter / transition transforms |
| `src/mosh/datamosh.ts` | Orchestrates transcode → mosh → re-encode |
| `src/mosh/backend.ts` | Routes to the browser, native (Tauri), or server engine |
| `src/app/MoshApp.tsx` | The single-screen UI |
| `crates/dmosh-core/` | Native engine (Rust port of `avi`/`ops` + ffmpeg) |
| `src-tauri/` | The desktop app shell |

The ffmpeg core is copied from `node_modules` into `public/ffmpeg/` by
`scripts/copy-ffmpeg-core.mjs` (runs automatically on `predev`/`prebuild`); it is
gitignored, not committed.

## Desktop app

The web app is free and always will be. The **desktop app** is the same thing,
native: it uses your machine's ffmpeg instead of the in-browser WebAssembly one —
so it's much faster and handles large files the browser can't. Two ways to get
it, same code either way:

### Free — build it yourself

A self-built copy is fully featured, with no license key. Get the latest stable release [here](https://github.com/cbassuarez/dmosh/releases/latest). You need
[Node](https://nodejs.org), the [Rust toolchain](https://rustup.rs), and
`ffmpeg`.

```bash
npm install
npm run tauri:build     # → src-tauri/target/release/bundle/
# or: npm run tauri:dev to run it without packaging
```

### Paid — prebuilt download

Don't want to install a toolchain? **[Buy a prebuilt build](https://cbassuarez.github.io/dmosh/buy)** —
signed, auto-updating, ready to run. It starts as a free trial (10 moshes); after
that you paste in a license key to keep going. Paying just saves you the build
step and funds development.

<!-- TODO: point the buy link at the real checkout once it exists (currently the Pages site). -->

---

Under the hood: the codec effects run through the Rust `dmosh-core` crate (a port
of `avi.ts`/`ops.ts`); the GPU Flow effect runs in the webview. Routing is
automatic (`src/mosh/backend.ts` detects the Tauri runtime), so the UI is
identical to the web app. The engine has its own tests + a headless CLI:

```bash
cargo test -p dmosh-core
cargo run -p dmosh-core --example mosh_cli -- input.mp4 bloom out.mp4
```

**Packaging notes.** `ffmpeg` is bundled as a Tauri sidecar
(`scripts/fetch-ffmpeg-sidecar.mjs`): win/linux fetch a static build
automatically; on **macOS** there's no stable static-build URL, so a release
build must supply one via `DMOSH_FFMPEG_BIN=/path/to/static/ffmpeg`
(e.g. from [osxexperts.net](https://www.osxexperts.net/) or a self-build) — a
plain system `ffmpeg` is not portable. Official paid builds also bake an Ed25519
public key into `src-tauri/src/license.rs` (`cargo run -p licctl -- keygen`) and
compile with `--features licensed`; self-compiled builds skip all of that.
