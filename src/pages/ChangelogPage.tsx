import { SiteNav } from "../components/layout/SiteNav";

export function ChangelogPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-16 text-sm">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Changelog</p>
          <h1 className="text-3xl font-semibold">Release notes</h1>
        </header>

        <section className="space-y-4 text-xs text-slate-300">
          <article className="rounded-xl border border-slate-800 bg-black/60 p-4">
            <h2 className="text-sm font-semibold text-slate-100">v0.1.0</h2>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-400">
              <li>Initial multi-page site: landing, app, docs, spec, changelog, about.</li>
              <li>Editor shell with codec-aware timeline placeholder and inspector.</li>
              <li>VitePress docs integration and GitHub Pages deployment.</li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}
