import { SiteNav } from "../components/layout/SiteNav";

export function SpecPage() {
  return (
    <div className="min-h-screen bg-dm-bg text-slate-100">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-4 text-2xl font-semibold">Project spec</h1>
        <p className="mb-4 text-sm text-slate-300">
          dmosh is driven by an explicit project JSON structure so the same mosh program can be replayed across the web app, CLI, and potential host plugins.
        </p>
        <section className="space-y-2 text-xs">
          <h2 className="text-sm font-semibold text-slate-200">DmoshProject (v0.1.0)</h2>
          <pre className="dm-code overflow-auto">{`{
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
}`}</pre>
          <p className="text-slate-400">
            Refer to the docs under <a href="/dmosh/docs/" className="underline underline-offset-2 hover:text-slate-100">/docs</a> for detailed type definitions and examples.
          </p>
        </section>
      </main>
    </div>
  );
}
