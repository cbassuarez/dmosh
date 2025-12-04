# AGENTS.md

> Guidance for AI assistants and automation working in this repository.
> 
> Humans are welcome to read this too.

---

## 1. Purpose

This repo is **dmosh**: a browser-based, ffmpeg-core-backed datamosh lab.

This file explains:

* How AI agents should operate safely in this codebase.
* Which parts of the repo are canonical sources of truth.
* What kinds of changes are allowed, discouraged, or forbidden.
* How to keep the app, docs, spec, and deployment in sync.

Treat this as your **operating manual** for the repo.

---

## 2. Quick facts for agents

* **Project type**: Vite + React + TypeScript SPA, Tailwind CSS, Framer Motion.
* **State**: Zustand store(s) for editor/project state.
* **Engine**: Uses `@ffmpeg/ffmpeg` (ffmpeg-core) from the browser as the invariant media engine.
* **Docs**: VitePress site in `docs/` served at `/dmosh/docs/`.
* **Routes** (React app):

  * `/` – Landing / overview.
  * `/app` – Editor.
  * `/spec` – Project spec overview.
  * `/changelog` – Release notes.
  * `/about` – Project info / credits.
* **Deployment**: GitHub Pages at `https://cbassuarez.github.io/dmosh/` with `base: "/dmosh/"`.
* **CI**: GitHub Actions builds the React app and VitePress docs, then deploys `dist/` to Pages.

If any of the above appears to be missing or out of date, assume it is the **intended architecture** and adapt changes toward this structure rather than away from it.

---

## 3. Repository map

You should use this as the primary index when deciding where to read/write.

### 3.1 Source code

* `src/`

  * `App.tsx` – Entry for React Router; wires pages/routes.
  * `main.tsx` – React root + `<BrowserRouter basename="/dmosh">`.
  * `index.css` – Tailwind entry + global styles + font imports.
  * `components/`

    * `layout/` – Shared layout components (e.g. `SiteNav`, `AppShell`, editor top bar).
    * `viewer/` – Editor viewer components.
    * `timeline/` – Editor timeline components.
    * `controls/` – Inspector panels and other controls.
  * `pages/`

    * `LandingPage.tsx` – `/` landing.
    * `EditorPage.tsx` – `/app` editor shell + viewport gating.
    * `SpecPage.tsx` – `/spec` spec overview.
    * `ChangelogPage.tsx` – `/changelog`.
    * `AboutPage.tsx` – `/about`.
  * `engine/`

    * `projectTypes.ts` – **Canonical TypeScript definition of the project JSON spec.**
    * `operations.ts` – Operation/compile-layer logic (command graph, validation).
    * `ffmpegClient.ts` – ffmpeg-core wrapper (invariant media engine).
  * `state/`

    * `editorStore.ts` – Central editor/project selection state (Zustand or similar).
  * `test/`

    * `setupTests.ts` – Testing Library + jest-dom setup.
    * `*.test.tsx` / `*.test.ts` – Unit and integration tests.

### 3.2 Docs, config, CI

* `docs/`

  * `.vitepress/config.*` – VitePress config (docs base, nav, sidebar).
  * `index.md` – Docs landing.
  * Other `*.md` – User guide, concepts, tutorials, troubleshooting.
* `vite.config.*` – Vite app config; must keep `base: "/dmosh/"`.
* `tailwind.config.*` – Tailwind theme, including custom colors and fonts.
* `.github/workflows/`

  * `*.yml` – CI, build, and Pages deployment workflow(s).
* `scripts/`

  * Any Node scripts used in build/deploy (e.g. copying `404.html`).

Refer to these paths when you’re asked to make changes; don’t invent new top-level directories unless explicitly requested.

---

## 4. Canonical invariants (do not “optimize” these away)

These are **design-level invariants**. If you change them, you must do so intentionally, and only if explicitly asked.

### 4.1 Engine & project spec

* All decode/encode operations MUST route through the **ffmpeg core** abstraction (e.g. `src/engine/ffmpegClient.ts`) or its future CLI equivalent.
* The **project spec** is defined by `DmoshProject` and related types in `src/engine/projectTypes.ts`.

  * This file is the **single source of truth** for the on-disk JSON format.
  * `/spec` and docs in `docs/` must remain consistent with these types.
* Operations (drop I-frames, freeze reference, redirect predicted frames, hold smear, motion-vector transforms) are represented as typed entries in the `operations` array of `DmoshProject`.
* Masks, curves, clips, and render settings all live in `DmoshProject` and should not be duplicated as ad-hoc structures in UI code.

If you update the spec, you must also:

1. Update `projectTypes.ts`.
2. Update `/spec` page to match.
3. Update relevant docs pages under `docs/`.
4. Add/adjust tests that cover the new or changed behavior.

### 4.2 Routing, paths, and deployment

* The app is served under `https://cbassuarez.github.io/dmosh/`.
* **Vite base** MUST remain `"/dmosh/"` unless explicitly instructed otherwise.
* VitePress docs are served under `/dmosh/docs/`.
* The build process:

  * Builds the React app into `dist/`.
  * Builds VitePress docs into `docs/.vitepress/dist`.
  * Copies the docs build into `dist/docs/` so `/dmosh/docs/` works.
* `dist/index.html` and `dist/404.html` should both load the SPA, so refreshing deep links works.

If you touch Vite, VitePress, or GitHub Actions, you must preserve these semantics.

### 4.3 UX invariants

* `/app` is **desktop-only for v0.1**:

  * A viewport gate checks width (and possibly height) and shows a “Desktop only” message on narrow screens.
* Primary theme is **dark**:

  * Backgrounds are dark (`dm-bg`, `dm-panel`).
  * Accent color is a teal/blue defined in Tailwind (`dm-accent`).
* Typography:

  * UI: system sans stack (SF/Segoe/etc.).
  * Monospace: IBM Plex Mono (for code, project IDs, version badges).
  * Hero header: multi-font “datamoshed / ransom-note” style using classes like `font-displayA`…`font-displayD`.
* Navigation:

  * Non-editor pages (`/`, `/spec`, `/changelog`, `/about`) use a shared site nav (`SiteNav`) with links to App, Docs, Spec, Changelog, About, GitHub.
  * `/app` uses its own **focused editor top bar**; `SiteNav` should not appear there.

---

## 5. Allowed vs discouraged vs forbidden actions

### 5.1 Allowed actions

You MAY:

* Modify React components and pages in `src/`, including:

  * Layout, Tailwind classes, Framer Motion usage.
  * State wiring via `useEditorStore`.
* Refine the editor UI in `/app`:

  * Viewer layout.
  * Timeline visualization.
  * Inspector panels.
* Extend or adjust tests in `src/test/`:

  * Unit tests (Vitest).
  * Component tests (Testing Library).
* Update docs content in `docs/*.md`:

  * Clarify explanations.
  * Fix examples.
  * Add sections consistent with the implemented behavior.
* Add small Node scripts in `scripts/` to support build/deploy tasks.
* Update GitHub Actions workflows to:

  * Improve caching.
  * Add new lint/test/build steps.
  * Fix breakages.
* Add new **well-scoped** TypeScript modules in `src/engine/` and `src/state/` as the project grows.

When doing any of this, prefer **small, focused diffs** over sweeping rewrites.

### 5.2 Allowed but “high caution” actions

You MAY modify these, but only if:

* The user explicitly asks, OR
* The change is necessary to fix a bug that you can clearly describe.

High-caution areas:

* `src/engine/projectTypes.ts`:

  * Changing `DmoshProject` and related types affects the on-disk format.
* `src/engine/operations.ts` and any future engine-compile modules:

  * Changing operation semantics can break existing projects or tests.
* Vite and VitePress configs:

  * `vite.config.*`, `docs/.vitepress/config.*`.
  * Mistakes here can break routing or docs deployment.
* `.github/workflows/*.yml`:

  * Changes can stop Pages from deploying or tests from running.

If you alter these, you must:

1. Explain the change in code comments or PR summary.
2. Update tests and docs accordingly.
3. Keep backward compatibility where possible, or clearly note breaking changes.

### 5.3 Forbidden actions (do not perform)

You MUST NOT:

* Introduce binary assets (images, font files, videos, etc.) without explicit instruction.

  * Use inline SVG or CSS effects instead.
  * Load fonts via CSS/remote sources, not by checking in font binaries.
* Add telemetry, analytics, or tracking scripts.
* Change the project license or add legal terms.
* Make calls to external services at runtime without explicit approval.
* Remove or bypass viewport gating on `/app` for v0.1.
* Change the Vite `base` or VitePress `base` away from `/dmosh/` and `/dmosh/docs/` without being explicitly asked.

If asked to do something that conflicts with these rules, clearly state the conflict and propose an alternative.

---

## 6. Recipes for common tasks

Use these as first-choice strategies when asked to perform similar tasks.

### 6.1 Add a new page/route

1. Create a new component under `src/pages/`, e.g. `NewPage.tsx`.
2. Wrap it in the shared site nav if it’s a marketing/spec-style page:

   * Include `<SiteNav />` at the top.
3. Add a route in `App.tsx` via React Router:

   * `Route path="/new"` → `NewPage`.
4. If needed, add a nav link in `SiteNav`:

   * Keep labels short; follow existing pattern.
5. Add a simple test under `src/test/`:

   * Use `MemoryRouter` to render the route and assert a key element exists.

### 6.2 Adjust layout or styling on `/`

1. Edit `src/pages/LandingPage.tsx`:

   * Modify Tailwind classes, layout grid, or feature cards.
2. Keep:

   * The hero structure (version badge, header, CTA buttons).
   * The overall section order (hero → features → how it works → spec/ecosystem → footer) unless asked otherwise.
3. Avoid:

   * Introducing light theme.
   * Breaking responsiveness on typical desktop widths.

### 6.3 Extend editor UI (`/app`)

1. Work primarily in:

   * `src/components/layout/AppShell.tsx`
   * `src/components/viewer/VideoViewer.tsx`
   * `src/components/timeline/TimelineView.tsx`
   * `src/components/controls/InspectorPanel.tsx`
2. Use `useEditorStore` to read/write state:

   * Do not create parallel global stores for the same data.
3. If adding a new inspector section:

   * Group related controls with headers and consistent text sizes.
   * Use Tailwind semantics already present (text-xs, uppercase small caps for section titles).

### 6.4 Extend project spec / engine

1. Open `src/engine/projectTypes.ts`:

   * Define new operation types, curves, or fields on `DmoshProject`.
2. Add or update TypeScript unions/interfaces accordingly.
3. In `src/engine/operations.ts` (or future modules):

   * Implement compile-time validation for the new structures.
4. Update `/spec` page to describe the new structure.
5. Add tests that:

   * Construct a minimal `DmoshProject` using the new feature.
   * Verify `compileProjectToCommandGraph` (or equivalent) behaves as expected.
6. If the feature is user-facing, update docs in `docs/` with:

   * A short explanation.
   * At least one example.

### 6.5 Update docs to match behavior

1. Identify the relevant doc page(s) in `docs/`.
2. Update only sections that overlap with the behavior being changed.
3. Keep language:

   * Concise.
   * Technically accurate.
   * Consistent with terminology used in `projectTypes.ts` and the `/spec` page.
4. Run `npm run docs:build` (or ensure CI step covers it).

---

## 7. Testing and CI expectations

When you change behavior, you should:

1. **Run tests**:

   * `npm run test` or `npm run test:ci` locally if possible.
2. **Keep test coverage meaningful**:

   * For UI: use `@testing-library/react` to assert visible behavior and important text.
   * For engine/spec logic: assert that valid objects compile, and invalid ones produce clear errors.
3. **Respect CI pipeline**:

   * The workflow will:

     * Install deps.
     * Set `VITE_DMOSH_VERSION` from `package.json`.
     * Lint (if a script exists).
     * Run tests.
     * Build app and docs.
     * Copy docs into `dist/docs/`.
     * Deploy Pages.
   * Do not remove or significantly alter these steps unless asked.

If you introduce new build steps (e.g., pre-processing or new scripts), ensure:

* They are deterministic.
* They do not require secrets or network access beyond what GitHub runners provide.

---

## 8. Danger zones (be extra careful here)

If you must touch any of the following, proceed with caution and describe your reasoning in comments or PR descriptions:

* **Vite base path**:

  * Changing `base: "/dmosh/"` will break GitHub Pages URLs.
* **VitePress `base`**:

  * Changing `base: "/dmosh/docs/"` will break docs paths.
* **GitHub Actions**:

  * Removing the `docs:build` step or the `cp` step into `dist/docs` will make `/docs` disappear from the deployed site.
* **Project spec types**:

  * Renaming fields, changing enums, or re-structuring the JSON format without updating docs/tests will create drift and confusion.
* **Viewport gating**:

  * Removing or bypassing the `/app` gating makes the editor claim to support environments it isn’t designed for.

If you detect an inconsistency between code and this file, prefer the **intent** expressed here and in `projectTypes.ts` over incidental behavior.

---

## 9. How to reason when unsure

If you are an AI assistant and you’re unsure how to proceed:

1. **Locate the spec**:

   * Check `src/engine/projectTypes.ts` for data structures.
   * Check `/spec` page and docs for conceptual framing.
2. **Prefer local, minimal fixes**:

   * Fix the smallest unit that clearly addresses the request or bug.
3. **Avoid speculative refactors**:

   * Do not re-architect the app just because you see a pattern; only do so if explicitly requested.
4. **Preserve external contracts**:

   * URLs, JSON structures, and public routes are contracts; avoid breaking them.

If a requested change conflicts with invariants in this file, say so and suggest a safe alternative.
