import { SiteNav } from "../components/layout/SiteNav";

export function SpecPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-16">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Spec</p>
          <h1 className="text-3xl font-semibold">Project spec</h1>
          <p className="max-w-3xl text-sm text-slate-300">
            dmosh is driven by an explicit project JSON structure so the same mosh program can be
            replayed across the web app, CLI, and potential host plugins.
          </p>
        </header>

        <section className="space-y-3 text-sm">
          <h2 className="text-sm font-semibold text-slate-200">DmoshProject (v0.1.0)</h2>
          <div className="overflow-auto rounded-lg border border-slate-800 bg-black/60 p-3 text-xs text-slate-200">
            {`{
  "version": "0.1.0",
  "id": "string",
  "name": "string",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "sources": [/* SourceAsset */],
  "clips": [/* ClipRef */],
  "masks": [/* MaskDefinition */],
  "curves": [/* ParameterCurve */],
  "operations": [/* Operation */],
  "renderSettings": {
    "codecProfile": "web | nle",
    "resolutionStrategy": "original | downscale"
  }
}`}
          </div>
          <p className="text-xs text-slate-400">
            Refer to the docs under{" "}
            <a
              href="/dmosh/docs/"
              className="underline underline-offset-2 hover:text-slate-100"
            >
              /docs
            </a>{" "}
            for detailed type definitions and examples.
          </p>
        </section>
      </main>
    </div>
  );
}
