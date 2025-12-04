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
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-slate-100">
      <SiteNav />

      <main className="mx-auto max-w-6xl px-4 py-10 space-y-16">
        {/* HERO */}
        <section className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
          {/* Hero text */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-black/60 px-3 py-1 text-[0.65rem] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              <span>v{DMOSH_VERSION}</span>
              <span className="text-slate-600">·</span>
              <span>ffmpeg-powered datamosh lab</span>
            </div>

            <motion.h1
              className="text-4xl font-semibold leading-tight md:text-5xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <span className="block">dmosh· codec-level glitch editor</span>
              <span className="mt-2 block text-base font-normal text-slate-400">
                in your browser
              </span>
            </motion.h1>

            <p className="max-w-xl text-sm text-slate-300">
              dmosh is a focused lab for datamoshing that treats inter-frame prediction, masks,
              and motion-vector transforms as first-class tools, not accidents.
            </p>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link
                to="/app"
                className="rounded-full bg-teal-400 px-4 py-2 font-medium text-black transition hover:bg-teal-300"
              >
                Open app
              </Link>
              <a
                href="/dmosh/docs/"
                className="rounded-full border border-slate-800 px-4 py-2 text-slate-200 transition hover:border-teal-400 hover:text-slate-200"
              >
                Read docs
              </a>
              <Link
                to="/spec"
                className="text-xs text-slate-400 underline underline-offset-4 hover:text-slate-100"
              >
                Project spec
              </Link>
            </div>
          </div>

          {/* Hero preview card */}
          <motion.div
            className="rounded-2xl border border-slate-800 bg-black/60 p-4 shadow-xl shadow-black/70"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <div className="mb-3 flex items-center justify-between text-[0.65rem] text-slate-400">
              <span className="font-mono">preview.mp4</span>
              <span className="rounded-full border border-slate-800 px-2 py-0.5 text-slate-500">
                I · P · B
              </span>
            </div>

            <div className="aspect-video overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
              <div className="h-full w-full bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.25)_0,_transparent_55%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.9)_0,_transparent_55%)]" />
            </div>

            <div className="mt-3 h-10 rounded-md border border-slate-800 bg-black/80">
              <div className="flex h-full items-center gap-1 px-2 text-[0.6rem] text-slate-500">
                <span className="h-2 w-8 rounded-sm bg-teal-400/70" />
                <span className="h-1 w-14 rounded-sm bg-slate-600/70" />
                <span className="h-1 w-10 rounded-sm bg-slate-500/60" />
                <span className="h-1 w-8 rounded-sm bg-slate-500/50" />
                <span className="ml-auto font-mono text-[0.6rem] text-slate-500">
                  keyframes · masks · curves
                </span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* FEATURES */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Features
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {featureCards.map((card) => (
              <div
                key={card.title}
                className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-sm"
              >
                <h3 className="mb-1 text-sm font-semibold text-slate-100">{card.title}</h3>
                <p className="text-xs text-slate-400">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            How it works
          </h2>
          <div className="grid gap-4 md:grid-cols-3 text-xs text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-black/60 p-3">
              <div className="mb-1 text-[0.7rem] font-semibold text-slate-200">1 · Import</div>
              <p>Load any clip ffmpeg can decode. dmosh normalizes it into a mosh-friendly profile.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-black/60 p-3">
              <div className="mb-1 text-[0.7rem] font-semibold text-slate-200">2 · Author</div>
              <p>Define operations, masks, and curves. You edit a project spec, not baked-in glitches.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-black/60 p-3">
              <div className="mb-1 text-[0.7rem] font-semibold text-slate-200">3 · Export</div>
              <p>Render a glitched video and JSON you can replay, batch, or hand off to other tools.</p>
            </div>
          </div>
        </section>

        {/* SPEC & ECOSYSTEM */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Spec & ecosystem
          </h2>
          <div className="rounded-xl border border-slate-800 bg-black/60 p-4 text-xs text-slate-300">
            <p className="mb-2">
              dmosh is built around an explicit project spec so the same mosh program can drive the
              web app, a CLI renderer, or host plugins.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-slate-400">
              <li>
                Open <span className="font-mono">DmoshProject</span> JSON format under{" "}
                <Link
                  to="/spec"
                  className="underline underline-offset-2 hover:text-slate-100"
                >
                  /spec
                </Link>
              </li>
              <li>
                Docs at{" "}
                <a
                  href="/dmosh/docs/"
                  className="underline underline-offset-2 hover:text-slate-100"
                >
                  /docs
                </a>
              </li>
              <li>
                Source and issues: {" "}
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

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-black/80 py-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <span>© {new Date().getFullYear()} dmosh</span>
          <span>
            v{DMOSH_VERSION} ·{" "}
            <a
              href="https://github.com/cbassuarez/dmosh"
              className="underline underline-offset-2 hover:text-slate-200"
            >
              GitHub
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
