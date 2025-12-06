import { Download, Play, RefreshCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useProject, type RenderJobStatus } from '../shared/hooks/useProject'

const statusColors: Record<RenderJobStatus, string> = {
  queued: 'bg-slate-500/40 text-slate-200',
  rendering: 'bg-accent/20 text-accent',
  complete: 'bg-emerald-500/20 text-emerald-300',
  failed: 'bg-rose-500/20 text-rose-200',
  cancelled: 'bg-slate-500/20 text-slate-300',
}

const StatusBadge = ({ status }: { status: RenderJobStatus }) => (
  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusColors[status] ?? ''}`}>
    {status}
  </span>
)

const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-500/60">
    <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
)

const formatTarget = (kind: string) => {
  if (kind === 'timeline') return 'Timeline'
  if (kind === 'clip') return 'Clip'
  if (kind === 'source') return 'Source'
  return kind
}

const RenderQueuePanel = () => {
  const {
    renderQueue,
    startRenderJob,
    removeRenderJob,
    exportPreferences,
    setExportPreferences,
    downloadRenderJob,
  } = useProject()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const sortedQueue = useMemo(
    () => [...renderQueue].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [renderQueue],
  )

  const handleToggleAutoDownload = (checked: boolean) => {
    setExportPreferences({ autoDownloadOnComplete: checked })
  }

  return (
    <div className="flex h-full flex-col divide-y divide-surface-300/60">
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between rounded-lg border border-surface-300/60 bg-surface-200/80 px-3 py-2 text-xs text-slate-300">
          <div className="flex flex-col">
            <span className="font-medium text-slate-100">Export queue</span>
            <span className="text-[11px] text-slate-500">
              Render jobs will appear here. Enable auto-download to save files when they complete.
            </span>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={exportPreferences.autoDownloadOnComplete}
              onChange={(event) => handleToggleAutoDownload(event.target.checked)}
            />
            <span>Auto-download on completion</span>
          </label>
        </div>
        {sortedQueue.length === 0 && <p className="text-xs text-slate-500">No renders queued.</p>}
        <div className="space-y-3">
          {sortedQueue.map((job) => {
            const showDownload = job.status === 'complete'
            const isQueued = job.status === 'queued'
            const isError = job.status === 'failed'
            const isCompleted = job.status === 'complete'

            const estimatedSizeMb =
              job.result?.size != null ? Math.max(1, Math.round(job.result.size / (1024 * 1024))) : null

            return (
              <div
                key={job.id}
                className="space-y-2 rounded-xl border border-surface-300/60 bg-surface-200/80 p-3 text-xs shadow-panel"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="truncate font-medium text-slate-100">{job.settings.fileName}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatTarget(job.settings.source.kind)} · {job.settings.container.toUpperCase()} ·{' '}
                      {job.settings.videoCodec.toUpperCase()}
                      {estimatedSizeMb && (
                        <span className="ml-2 text-[11px] text-slate-500">~{estimatedSizeMb} MB</span>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                <ProgressBar value={job.progress} />
                {job.status === 'failed' && job.errorMessage && (
                  <div className="mt-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">
                    {job.errorMessage}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  {isQueued && (
                    <button
                      onClick={() => startRenderJob(job.id)}
                      className="flex items-center gap-1 rounded-md border border-surface-300/60 px-2 py-1 text-white transition hover:border-accent/70"
                    >
                      <Play className="h-3 w-3" /> Start
                    </button>
                  )}
                  {isError && (
                    <button
                      onClick={() => startRenderJob(job.id)}
                      className="flex items-center gap-1 rounded-md border border-surface-300/60 px-2 py-1 text-white transition hover:border-accent/70"
                    >
                      <RefreshCcw className="h-3 w-3" /> Retry
                    </button>
                  )}
                  {showDownload && (
                    <button
                      onClick={async () => {
                        setDownloadingId(job.id)
                        try {
                          await downloadRenderJob(job.id)
                        } finally {
                          setDownloadingId((current) => (current === job.id ? null : current))
                        }
                      }}
                      disabled={downloadingId === job.id}
                      className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-black transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="h-3 w-3" /> {downloadingId === job.id ? 'Downloading…' : 'Download'}
                    </button>
                  )}
                  {(isCompleted || isError || isQueued) && (
                    <button
                      onClick={() => removeRenderJob(job.id)}
                      className="flex items-center gap-1 rounded-md border border-surface-300/60 px-2 py-1 text-slate-200 transition hover:border-rose-400 hover:text-white"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default RenderQueuePanel
