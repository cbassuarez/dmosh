import { SiteNav } from "../components/layout/SiteNav";

export function ChangelogPage() {
  return (
    <div className="min-h-screen bg-dm-bg text-slate-100">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-10 text-sm">
        <h1 className="mb-4 text-2xl font-semibold">Changelog</h1>
        <section className="space-y-3 text-xs text-slate-300">
          <article>
            <h2 className="text-sm font-semibold text-slate-100">v0.1.0</h2>
            <ul className="list-disc space-y-1 pl-4 text-slate-400">
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
