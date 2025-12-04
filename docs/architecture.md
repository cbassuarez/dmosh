# Architecture Notes

- **Theme tokens** live in `tailwind.config.js` (surface shades, accent, danger/success) and drive the dark, grading-suite feel.
- **Routing** uses `HashRouter` for GitHub Pages compatibility. Route transitions are animated via `AnimatePresence` in `src/App.tsx`.
- **Layout**: `/app` uses a three-column shell (`EditorPage`) with resizable side panels via `panelSizing.ts`. Minimum center width is enforced to keep the viewer/timeline usable.
- **Motion**: Framer Motion handles route fades, panel slides, clip highlights, and curve interactions (`CurveEditor`). Durations align with the brief: 200–260ms for panels, ~120–180ms for micro-interactions.
- **Stub hooks**: `useEngineStatus`, `useTimelineData`, `useMasks`, and `useAutomationCurves` expose mock data so the UI wiring mirrors the eventual engine API.
- **Testing**: Vitest covers panel math and curve clamping. Playwright smoke test checks the editor shell renders and panels toggle.
- **Deployment**: `vite.config.ts` sets `base: '/dmosh/'` for GitHub Pages; GitHub Actions workflow builds and deploys from the `work` branch.
