import { SiteNav } from "../components/layout/SiteNav";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-16 text-sm">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">About</p>
          <h1 className="text-3xl font-semibold">dmosh</h1>
        </header>
        <div className="space-y-3">
          <p className="max-w-4xl text-slate-300">
            dmosh is an experimental, browser-based datamosh lab built on an ffmpeg core. It
            treats frame types, prediction references, masks, and motion-vector transforms as
            editable material rather than opaque codec behavior.
          </p>
          <p className="max-w-4xl text-xs text-slate-400">
            The project is designed for artists who want to work closer to the codec, and for
            developers who want a clear spec for interoperable tools (CLI renderers, host plugins,
            etc.).
          </p>
          <p className="text-xs text-slate-500">
            Source code, issues, and roadmap live at{" "}
            <a
              href="https://github.com/cbassuarez/dmosh"
              className="underline underline-offset-2 hover:text-slate-200"
            >
              github.com/cbassuarez/dmosh
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
