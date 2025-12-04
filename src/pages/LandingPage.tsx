import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { SiteNav } from "../components/layout/SiteNav";
import { DMOSH_VERSION } from "../version";

const featureCards = [
  {
    title: "Codec-aware timeline",
    body: "Inspect I/P/B frames, drop keyframes, and control reference relationships directly.",
  },
  {
    title: "Spatial masks",
    body: "Rect and ellipse masks aligned to macroblock grids so glitches land where you intend.",
  },
  {
    title: "Glitch curves",
    body: "Automate motion-vector transforms with per-parameter curves: scale, jitter, drift.",
  },
  {
    title: "ffmpeg-core engine",
    body: "Browser-based lab built on an invariant ffmpeg core and an open project spec.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-dm-bg to-black text-slate-100">
      <SiteNav />
      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-16 pt-10">
        <section className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-dm-border bg-black/50 px-3 py-1 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-dm-accent" />
              <span>v{DMOSH_VERSION}</span>
              <span className="text-slate-600">·</span>
              <span>ffmpeg-powered datamosh lab</span>
            </div>

            <motion.h1
              className="dm-hero-title text-4xl font-semibold leading-tight md:text-5xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="font-displayA">d</span>
              <span className="font-displayB">m</span>
              <span className="font-displayC">o</span>
              <span className="font-displayD">s</span>
              <span className="font-displayB">h</span>
              <span className="ml-2 text-base font-normal text-slate-500">
                · codec-level glitch editor in your browser
              </span>
            </motion.h1>

            <p className="max-w-xl text-sm text-slate-300">
              dmosh is a focused lab for datamoshing that treats inter-frame prediction, masks, and motion-vector transforms as first-class tools, not accidents.
            </p>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link
                to="/app"
                className="rounded-full bg-dm-accent px-4 py-2 font-medium text-black transition hover:bg-teal-300"
              >
                Open app
              </Link>
              <a
                href="/dmosh/docs/"
                className="rounded-full border border-dm-border px-4 py-2 text-slate-200 transition hover:border-dm-accent hover:text-dm-accent"
              >
                Read docs
              </a>
              <Link
                to="/spec"
                className="text-xs text-slate-400 underline-offset-4 hover:text-slate-100 hover:underline"
              >
                Project spec
              </Link>
            </div>
          </div>

          <motion.div
            className="rounded-2xl border border-dm-border bg-black/60 p-4 shadow-xl shadow-black/60"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
          >
            <div className="mb-3 flex items-center justify-between text-[0.65rem] text-slate-400">
              <span className="font-mono">preview.mp4</span>
              <span className="rounded-full border border-dm-border px-2 py-0.5 text-slate-500">I · P · B</span>
            </div>
            <div className="aspect-video rounded-lg border border-dm-border bg-gradient-to-br from-slate-900 via-black to-slate-950">
              <div className="h-full w-full bg-[radial-gradient(circle_at_top,_#22c1c3_0,_transparent_55%),radial-gradient(circle_at_bottom,_#0f172a_0,_transparent_55%)] opacity-80" />
            </div>
            <div className="mt-3 h-10 rounded-md border border-dm-border bg-black/70">
              <div className="flex h-full items-center gap-1 px-2 text-[0.6rem] text-slate-500">
                <span className="h-2 w-6 rounded-sm bg-emerald-500/60" />
                <span className="h-1 w-12 rounded-sm bg-slate-600/60" />
                <span className="h-1 w-10 rounded-sm bg-slate-500/50" />
                <span className="h-1 w-8 rounded-sm bg-slate-500/40" />
                <span className="ml-auto font-mono text-[0.6rem] text-slate-500">keyframes · masks · curves</span>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Features</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {featureCards.map((card) => (
              <div
                key={card.title}
                className="rounded-xl border border-dm-border bg-black/50 p-4 text-sm text-slate-200"
              >
                <h3 className="mb-1 text-sm font-semibold">{card.title}</h3>
                <p className="text-xs text-slate-400">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">How it works</h2>
          <div className="grid gap-4 text-xs text-slate-300 md:grid-cols-3">
            <div className="rounded-xl border border-dm-border bg-black/50 p-3">
              <div className="mb-2 text-[0.7rem] font-semibold text-slate-200">1 · Import</div>
              <p>Load any clip ffmpeg can decode. dmosh normalizes it into a mosh-friendly profile.</p>
            </div>
            <div className="rounded-xl border border-dm-border bg-black/50 p-3">
              <div className="mb-2 text-[0.7rem] font-semibold text-slate-200">2 · Author</div>
              <p>Define operations, masks, and curves. You’re editing a project spec, not baking glitches in-place.</p>
            </div>
            <div className="rounded-xl border border-dm-border bg-black/50 p-3">
              <div className="mb-2 text-[0.7rem] font-semibold text-slate-200">3 · Export</div>
              <p>Render a glitched video and a JSON project file that can be replayed or batch-rendered later.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Spec & ecosystem</h2>
          <div className="rounded-xl border border-dm-border bg-black/50 p-4 text-xs text-slate-300">
            <p className="mb-2">
              dmosh is built around an explicit project spec so the same mosh program can drive the web app, a CLI renderer, or host plugins.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-slate-400">
              <li>
                Open <span className="font-mono">DmoshProject</span> JSON format under <Link to="/spec" className="underline underline-offset-2 hover:text-slate-100">/spec</Link>
              </li>
              <li>
                Docs at <a href="/dmosh/docs/" className="underline underline-offset-2 hover:text-slate-100">/docs</a>
              </li>
              <li>
                Source and issues at{" "}
                <a
                  href="https://github.com/cbassuarez/dmosh"
                  className="underline underline-offset-2 hover:text-slate-100"
                >
                  github.com/cbassuarez/dmosh
                </a>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-dm-border bg-black/80 py-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <span>© {new Date().getFullYear()} dmosh</span>
          <span>
            v{DMOSH_VERSION} · <a href="https://github.com/cbassuarez/dmosh" className="underline underline-offset-2 hover:text-slate-200">GitHub</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
