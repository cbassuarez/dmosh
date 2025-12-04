const examples = [
  { title: 'Breathing glass', desc: 'Slow smear with pulsing spatial mask.', tags: ['smear', 'mask', 'ambient'] },
  { title: 'Vector stutter', desc: 'Intermittent drift on B-frames.', tags: ['stutter', 'drift'] },
  { title: 'Heat bloom', desc: 'Chromatic offsets and dual-view blending.', tags: ['offset', 'dual'] },
  { title: 'Pulse quantize', desc: 'Temporal quantization synced to automation curve.', tags: ['quantize', 'automation'] },
]

const ExamplesPage = () => (
  <div className="mx-auto max-w-6xl px-6 pb-16 text-slate-200">
    <h2 className="text-3xl font-semibold text-white">Examples & Presets</h2>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {examples.map((item) => (
        <div
          key={item.title}
          className="rounded-xl border border-surface-300/60 bg-surface-200/80 p-5 shadow-panel transition hover:border-accent/60"
        >
          <p className="text-lg font-semibold text-white">{item.title}</p>
          <p className="text-sm text-slate-400">{item.desc}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-surface-300/60 px-2 py-1 font-mono">
                {tag}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)

export default ExamplesPage
