const releases = [
  {
    version: '0.1.0',
    date: '2024-12-02',
    notes: ['Initial shell UI', 'Landing + docs stubs', 'Resizable panels baseline'],
  },
  {
    version: '0.2.0',
    date: '2025-01-10',
    notes: ['Timeline refinements', 'Mask drawer polish', 'Automation curve hover states'],
  },
]

const ChangelogPage = () => (
  <div className="mx-auto max-w-4xl px-6 pb-16 text-slate-200">
    <h2 className="text-3xl font-semibold text-white">Changelog</h2>
    <div className="mt-6 space-y-6">
      {releases.map((entry) => (
        <div key={entry.version} className="rounded-xl border border-surface-300/60 bg-surface-200/80 p-5">
          <p className="font-mono text-sm text-accent">v{entry.version}</p>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{entry.date}</p>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-slate-300">
            {entry.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
)

export default ChangelogPage
