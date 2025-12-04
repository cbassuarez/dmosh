# Architecture Notes

This repository scaffolds a deterministic, typed datamoshing editor that ships a Vite + React + Tailwind + Framer Motion UI, a typed engine contract, and CI that builds and deploys to GitHub Pages.

## Project JSON schema
- Root `Project` object captures metadata, seed, render settings, sources, timeline, masks, operations, and automation curves.
- Operation precedence: `dropKeyframes` → `freezeReference` → `redirectFrames` → `holdSmear` → `motionVectorTransforms`. Later items in each array win on conflict.
- Automation parameter ranges: scale `[0,4]`, jitter `[0,1]`, quantize `[0,8]` integer bins, driftX/driftY `[-50,50]` px/frame. Curves reference operations by id and are validated.
- Masks live in timeline space and quantize to `blockSize`. Keyframes interpolate linearly or stepwise.

## Engine pipeline
1. **Normalize sources** – verify normalized profiles; any `normalizationError` blocks rendering.
2. **Validate** – structural checks via `validation.ts`; throws typed errors for missing references or out-of-range automation points.
3. **Compose operations** – priority ordering plus per-kind last-wins semantics, producing a deterministic list for the renderer.
4. **Render stub** – mock topology summary derived from operations and project seeds; deterministic pseudo-RNG guarantees repeatability.
5. **Encode stub** – placeholder preset argument (`web` | `nle`) kept in the result for future ffmpeg wiring.

## Determinism & seeding
- `project.seed` seeds a deterministic LCG used in the mock renderer. Per-operation seeds can override randomness later.
- Identical project JSON yields identical topology summaries across UI/CLI once ffmpeg is wired.

## UI layout & design tokens
- Dark Resolve-inspired theme with accent `#ff5135` and surfaces from `surface-100..400` (Tailwind extensions).
- Typography: IBM Plex Sans for UI, IBM Plex Mono for technical labels, ids, and timecodes.
- Layout: fixed top nav, three-column editor (`ProjectPanel` | `Viewer + Timeline` | `Inspector`). Panels are resizable with animated slide/fade via Framer Motion.
- Motion timings: 120–180ms for micro interactions, ~240ms for panel/route transitions. Route transitions use `AnimatePresence`.

## Deployment & CI
- Vite `base` respects GitHub Pages; HashRouter ensures routing works on Pages.
- GitHub Actions workflow runs lint → test → build, uploads `dist`, and deploys Pages from `main`.
