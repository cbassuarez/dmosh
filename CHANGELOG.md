# Changelog

## v0.2.1 - 2026-06-06

- Ship prebuilt desktop binaries: a CI release matrix (macOS/Windows/Linux) builds
  the trial-then-key app and attaches the bundles to the release.
- Move the site to the **dmosh.com** custom domain (apex hosting).
- Brand icons from the datamosh art: rounded squircle on macOS, square on
  Windows/Linux; plus a designed DMG install background.
- Native app menu + keyboard shortcuts; native Save dialog on desktop; an
  About/Sponsor modal; a faster bake; and a small mosh sprite.

## v0.2.0 - 2026-06-06

- Add a native **desktop app** (Tauri): the same UI backed by a Rust engine
  (`dmosh-core`, a port of the AVI/ops code) running native ffmpeg — much faster,
  no browser memory ceiling, built for large files.
- Bundle ffmpeg as a Tauri sidecar (static fetch on win/linux; `DMOSH_FFMPEG_BIN`
  drop-in on macOS).
- Add trial-then-key **license gating** for official builds (offline Ed25519 keys,
  `licctl` keygen/sign tool); self-compiled builds are fully unlocked.
- Add a `/buy` page and a header desktop modal (buy prebuilt, or compile free).
- Redesign the UI: light, research-grade theme with a real-time GPU effect
  preview, technical effect names, a mosh-range scrubber, keep-audio, and a
  per-load accent colour.
- Make the header release badge auto-update from the latest GitHub release.
- Fix a "stuck at 100%" hang by patching AVI header frame counts after moshing.

## v0.1.0 - 2026-06-06

- Establish the first public dmosh release for the browser datamosher.
- Add codec-backed effects for P-frame duplication, peak-frame repeat, interval repeat, shuffle, residual sort, reversal, and two-clip transition moshing.
- Add the GPU optical-flow warp path for a browser-native smear effect.
- Add exact baked previews that use the same backend options as final export.
- Add release metadata in the app header, a GitHub repo link, and a custom SVG favicon.
- Document the release with README badges, GitHub Pages deployment context, and release notes.
