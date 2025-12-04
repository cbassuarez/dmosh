const DocsPage = () => (
  <div className="mx-auto max-w-5xl px-6 pb-16 text-slate-200">
    <h2 className="text-3xl font-semibold text-white">Documentation</h2>
    <section className="mt-6 space-y-4 rounded-xl border border-surface-300/60 bg-surface-200/80 p-6">
      <h3 className="text-xs uppercase tracking-[0.25em] text-slate-400">Project format</h3>
      <p className="text-sm text-slate-300">
        A project is a JSON manifest describing clips, masks, operations, and automation curves. Each clip references a
        media URI and codec hints; masks define geometry and modes; operations define transforms applied per segment.
      </p>
      <div className="rounded-lg border border-surface-300/60 bg-surface-300/60 p-4 font-mono text-xs text-slate-200">
        {`{
  "version": "0.1",
  "clips": [{ "id": "clipA", "src": "drop.mov", "fps": 24 }],
  "masks": [{ "id": "m1", "type": "ellipse", "mode": "add" }],
  "operations": [{ "clip": "clipA", "type": "vector-smear", "intensity": 0.7 }],
  "automation": [{ "target": "operation.intensity", "points": [[0,0.2],[0.5,0.8],[1,0.3]] }]
}`}
      </div>
    </section>
    <section className="mt-6 space-y-3 rounded-xl border border-surface-300/60 bg-surface-200/80 p-6">
      <h3 className="text-xs uppercase tracking-[0.25em] text-slate-400">Engine overview</h3>
      <p className="text-sm text-slate-300">
        The engine parses the manifest, resolves clip metadata, and computes frame-level operations before feeding
        ffmpeg. Hooks like <span className="font-mono text-xs">useEngineStatus</span> and <span className="font-mono text-xs">useTimelineData</span> expose
        status to the UI. Render jobs are pluggable to native or web codecs.
      </p>
    </section>
  </div>
)

export default DocsPage
