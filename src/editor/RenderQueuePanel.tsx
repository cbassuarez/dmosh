import { Play, RefreshCcw, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useProject, type RenderJobStatus } from '../shared/hooks/useProject'

const statusColors: Record<RenderJobStatus, string> = {
  queued: 'bg-slate-500/40 text-slate-200',
  rendering: 'bg-accent/20 text-accent',
  completed: 'bg-emerald-500/20 text-emerald-300',
  error: 'bg-rose-500/20 text-rose-200',
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
  const { renderQueue, startRenderJob, removeRenderJob } = useProject()
  const sortedQueue = useMemo(
    () => [...renderQueue].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [renderQueue],
  )

  return (
    <div className="flex h-full flex-col divide-y divide-surface-300/60">
      <div className="space-y-2 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Render queue</p>
        {sortedQueue.length === 0 && <p className="text-xs text-slate-500">No renders queued.</p>}
        <div className="space-y-3">
          {sortedQueue.map((job) => (
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
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <ProgressBar value={job.progress} />
              {job.errorMessage && <p className="text-[11px] text-rose-300">{job.errorMessage}</p>}
              <div className="flex justify-end gap-2">
                {job.status === 'queued' && (
                  <button
                    onClick={() => startRenderJob(job.id)}
                    className="flex items-center gap-1 rounded-md border border-surface-300/60 px-2 py-1 text-white transition hover:border-accent/70"
                  >
                    <Play className="h-3 w-3" /> Start
                  </button>
                )}
                {job.status === 'error' && (
                  <button
                    onClick={() => startRenderJob(job.id)}
                    className="flex items-center gap-1 rounded-md border border-surface-300/60 px-2 py-1 text-white transition hover:border-accent/70"
                  >
                    <RefreshCcw className="h-3 w-3" /> Retry
                  </button>
                )}
                {job.status !== 'rendering' && (
                  <button
                    onClick={() => removeRenderJob(job.id)}
                    className="flex items-center gap-1 rounded-md border border-surface-300/60 px-2 py-1 text-slate-200 transition hover:border-rose-400 hover:text-white"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default RenderQueuePanel
