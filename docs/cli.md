# dmosh as a CLI / TTY — design sketch

## The one fact that makes this easy

The whole engine already collapses to a single pure-ish call:

```ts
activeBackend.process(inputs: File[], options: MoshOptions) => Promise<Blob>
```

`MoshOptions` is just data (`effect`, `amount`, `range`, `repeat`, `dropI/P`,
`keepAudio`, `seed`). So a CLI/TTY is **not** a rewrite — it's a thin
`parse args → MoshOptions → process() → write Blob` shim over that seam. The hard
part (moshing) is done; we're only adding a front-end and an I/O path.

## The core constraint

The engine runs in a **browser**: ffmpeg.wasm (Worker), WebCodecs, WebGL2. There
is no backend and we want to keep it that way. So "a command runs and a file
comes out" has to resolve *where the code runs* and *how files get in/out of the
sandbox*. Three front-ends share one command grammar:

## Command grammar (shared)

```
mosh <input> --effect <name> [--amount 0-100] [--range a:b]
     [--repeat n] [--strip i,p] [--audio] [--seed n] [-o out.mp4]

effects: optical-flow-warp · p-frame-dup · peak-frame-repeat · interval-repeat
         p-frame-shuffle · residual-sort · p-frame-reversal · i-frame-removal
```

A command string is fully reproducible — paste it to reproduce a mosh exactly
(with `--seed`). That's a real win for a research tool.

## Three front-ends, one grammar

### 1. In-browser TTY (the "CLI/TTY component") — *recommended*
An [xterm.js] console inside the site. You type the command; `open`/drag selects
the input; the parser builds `MoshOptions`; `process()` runs; the result
auto-downloads (or `showSaveFilePicker()` writes to a chosen path in Chromium).

- **No backend, no new runtime** — it's the same page, just a terminal pane.
- Fits the research-grade aesthetic; pairs with (or replaces) the GUI.
- Honest limit: the browser sandbox means `open`/drag for input and download for
  output — it's a command *grammar*, not a real shell with `ls ~/Videos`.

### 2. Headless-browser driver (true automation CLI)
A tiny Node CLI launches headless Chromium, loads the static `dist/`, injects the
file bytes, calls a small exposed API (below), reads the result Blob back, writes
it to disk. **This is already proven** — the test harnesses do exactly this
(`setInputFiles` → click → `fetch(blobURL)` → base64 → write).

- Reuses the *canonical* web engine bit-for-bit, **including the GPU Flow effect**
  (needs `--use-gl=angle --use-angle=swiftshader` headless, or a real GPU).
- Real filesystem in/out, pipeable.
- Cost: ships/uses a Chromium binary (~150 MB) and per-invocation startup.

To make this robust, expose an automation seam on the site so the driver calls an
API instead of poking the DOM:

```ts
// window.dmosh.run({ effect, amount, range, bytes }) => Promise<Uint8Array>
```

The same seam powers a **deep-link mode**: `#mosh?effect=p-frame-dup&amount=70&src=<url>&download=1`
fetches a *remote* source (CORS permitting), moshes, and auto-downloads — literally
"send a command (a URL) to the site, get a file," zero UI. (Local files can't ride
in a URL, so this mode is remote-source only.)

### 3. Node-native CLI (no browser) — escape hatch
Reuse the framework-free `src/mosh/avi.ts` + `ops.ts` with native ffmpeg — this is
the `/server` reference minus HTTP. Fast, lightweight, real pipes.

- Trade-off: it does **not** "run the web commands" — it's a parallel runtime over
  the shared pure core. The **Flow** effect (WebGL optical-flow) has no Node path
  without a headless-GL port, so it'd be unsupported or CPU-ported there.

## Recommendation

Build **#1 (in-browser TTY)** as the "CLI/TTY component" — it's the smallest,
truest-to-"no backend" answer and matches the product's direction. Add the
**`window.dmosh.run` automation seam** at the same time (cheap), which unlocks
**#2 (headless driver)** and the deep-link mode for real automation later, reusing
the exact engine. Keep **#3** only if a browser-free batch pipeline becomes a hard
requirement.

### Rough phasing
1. Factor a pure `parseCommand(str) → MoshOptions | error` (with `--help`) — shared
   by every front-end; unit-testable, no DOM.
2. Expose `window.dmosh.run(opts, bytes)` and a `#mosh?…` deep-link handler.
3. Drop in an xterm pane wired to `parseCommand` + `process()` + download.
4. (Optional) `bin/dmosh.mjs` Playwright driver targeting `window.dmosh.run`.

## Gotchas to remember
- **Files**: in-browser = picker/drag in, download/`showSaveFilePicker` out; driver
  = fs bytes both ways. No real filesystem from the TTY itself.
- **Headless GPU**: Flow needs swiftshader/real GL flags; it's slower under
  swiftshader. The codec effects (ffmpeg.wasm) don't care.
- **Determinism**: only `--seed` makes randomized effects (shuffle) reproducible.
- **Blob round-trip** in the driver is base64 over the CDP bridge — fine for short
  clips, watch memory on large ones (same ceiling as the GUI).

---

# Standalone native binary (future)

**Yes — and it's additive, not a rewrite.** Two things we already have make it a
drop-in:

- The **`MoshBackend` seam** (`src/mosh/backend.ts`): `process(inputs, options)
  → Blob`. We already ship `clientBackend` (ffmpeg.wasm/WebCodecs) and
  `serverBackend` (HTTP). A native build is just a third one — `nativeBackend` —
  behind the same interface. The UI doesn't change.
- The **pure core** (`avi.ts` + `ops.ts`): no DOM, no framework. It runs unchanged
  in a browser, in Node, and ports trivially to Rust/Go (it's byte-twiddling).

## Why go native at all — the two asks

- **Larger files.** The browser ceiling is wasm memory (~2–4 GB) + single-thread
  ffmpeg.wasm. Native ffmpeg removes both: multi-GB inputs, multithreaded,
  GPU-accelerated encode. This is the #1 reason to compile.
- **Simple timelines.** We stripped the old timeline, but `transition` already
  proves the primitive (two clips, mosh at the cut). A timeline is just *ordered
  segments + a mosh at each boundary* + project save/load — natural once there's
  native headroom and a real filesystem.

## Targets (in order of leverage)

| Path | What it is | Binary | Reuses |
| --- | --- | --- | --- |
| **Tauri** *(recommended)* | Rust shell + our existing web UI in the OS webview; Rust spawns native `ffmpeg` as a sidecar | ~5–15 MB (+ bundled ffmpeg) | ~all the UI; `nativeBackend` calls Rust→ffmpeg |
| **Electron** | Bundles Chromium + Node; UI unchanged; Node spawns native ffmpeg | ~120–200 MB | everything incl. WebCodecs/WebGL Flow, zero engine changes |
| **Compiled CLI** | `bun build --compile` / `deno compile` of the Node engine (the `/server` logic minus HTTP) | one file (+ ffmpeg) | the pure core; native ffmpeg |

- **Tauri** is the sweet spot: keep the React UI, swap `clientBackend` →
  `nativeBackend` (Rust command → native ffmpeg + the AVI edit), get big files,
  speed, real drag/drop + `Save As`, and a clean place to grow a timeline. Flow
  still runs in the webview's WebGL2, or natively later.
- **Electron** is the zero-effort path if binary size doesn't matter — the bundled
  Chromium runs today's engine (ffmpeg.wasm *or* native, WebCodecs, WebGL) as-is.
- **Compiled CLI** is the headless/batch companion for pipelines; Flow needs a
  native-GL port (or is CLI-unsupported).

## What we'd point users at, over time

1. **Today** — the web app (zero install, short clips).
2. **Next** — in-browser TTY + `#mosh?…` deep links (still zero install).
3. **Later** — a **dmosh desktop** download (Tauri) for large files + timelines,
   and a **compiled CLI** for automation. Both reuse the same pure core, so effects
   stay identical across web and native.

## Honest gotchas

- **ffmpeg licensing**: bundling ffmpeg pulls in LGPL/GPL terms depending on the
  build (e.g. `--enable-gpl`, x264). Ship an LGPL build or document the license;
  affects redistribution.
- **Signing/notarization**: a downloadable binary needs Apple notarization and
  Windows code-signing or users hit scary warnings. Real cost + cert management.
- **Auto-update + CI matrix**: building/signing for mac (arm+intel), win, linux.
  Tauri/Electron both have updater plumbing; it's still infra to own.
- **Two code paths**: web vs native backends. Mitigated because the *interesting*
  logic (`avi.ts`/`ops.ts`) is shared and small; only the transcode/encode shell
  differs (wasm vs native ffmpeg).
