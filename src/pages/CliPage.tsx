const CliPage = () => (
  <div className="mx-auto max-w-4xl px-6 pb-16 text-slate-200">
    <h2 className="text-3xl font-semibold text-white">CLI Integration</h2>
    <p className="mt-4 text-sm text-slate-300">
      Render project JSON via native ffmpeg on a workstation. The CLI will mirror the editor manifest and surface
      deterministic render logs.
    </p>
    <div className="mt-6 rounded-xl border border-surface-300/60 bg-surface-200/80 p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mock usage</p>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-surface-300/60 bg-surface-300/50 p-4 font-mono text-xs text-slate-100">
{`$ dmosh render project.json \\
  --out mosh.mov \\
  --codec h264 --bitrate 12M \\
  --passes 2 --threads 12 \\
  --inspect masks,automation`}
      </pre>
    </div>
  </div>
)

export default CliPage
