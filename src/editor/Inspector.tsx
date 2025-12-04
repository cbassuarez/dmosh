import { useMemo } from 'react'
import { Project } from '../engine/types'
import { formatHash, useProject } from '../shared/hooks/useProject'
import { useSourceThumbnail } from './thumbnailService'

const Label = ({ children }: { children: string }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{children}</p>
)

const InfoRow = ({ label, value }: { label: string; value: string | number | undefined }) => (
  <div className="flex items-center justify-between text-xs text-slate-300">
    <span className="text-slate-500">{label}</span>
    <span className="font-mono text-[11px] text-white">{value ?? '—'}</span>
  </div>
)

const Inspector = ({ project }: { project: Project }) => {
  const { selection, setProject, createDropKeyframes, createFreezeReference, createRedirectFrames, addAutomationCurve } =
    useProject()
  const activeClip = project.timeline.clips.find((clip) => clip.id === selection.selectedClipId)
  const activeSource = project.sources.find((s) => s.id === activeClip?.sourceId)
  const { url: inspectorThumb, isLoading: inspectorThumbLoading } = useSourceThumbnail(activeSource)

  const clipDuration = useMemo(() => (activeClip ? activeClip.endFrame - activeClip.startFrame + 1 : null), [activeClip])

  return (
    <div className="flex h-full flex-col divide-y divide-surface-300/60">
      <div className="space-y-3 p-4">
        <Label>Inspector</Label>
        <div className="space-y-2 rounded-lg border border-surface-300/60 bg-surface-300/60 p-3">
          <p className="text-xs text-slate-400">Project</p>
          <input
            className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1 text-sm text-white"
            value={project.metadata.name}
            onChange={(e) => setProject({ ...project, metadata: { ...project.metadata, name: e.target.value } })}
          />
          <input
            className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1 text-sm text-white"
            placeholder="Author"
            value={project.metadata.author}
            onChange={(e) => setProject({ ...project, metadata: { ...project.metadata, author: e.target.value } })}
          />
          <InfoRow label="Resolution" value={`${project.settings.width}x${project.settings.height}`} />
          <InfoRow label="FPS" value={project.settings.fps} />
          <InfoRow label="Block size" value={project.settings.blockSize} />
        </div>

        {activeSource && activeClip && (
          <div className="space-y-2 rounded-lg border border-surface-300/60 bg-surface-300/60 p-3">
            <p className="text-xs text-slate-400">Source</p>
            <div className="overflow-hidden rounded-md bg-surface-400/30">
              {inspectorThumb && (
                <img src={inspectorThumb} alt={`${activeSource.originalName} preview`} className="h-28 w-full object-cover" />
              )}
              {!inspectorThumb && inspectorThumbLoading && <div className="h-28 w-full animate-pulse bg-surface-500/40" />}
              {!inspectorThumb && !inspectorThumbLoading && (
                <div className="flex h-28 items-center justify-center text-xs text-slate-500">Preview unavailable</div>
              )}
            </div>
            <p className="text-sm text-white">{activeSource.originalName}</p>
            <InfoRow label="Hash" value={formatHash(activeSource.hash)} />
            <InfoRow label="Duration" value={`${activeSource.durationFrames}f`} />
            <InfoRow label="Audio" value={activeSource.audioPresent ? 'Yes' : 'No'} />
            <InfoRow label="Pixel format" value={activeSource.pixelFormat} />
            <p className="text-xs text-slate-500">{activeSource.normalizedProfile ? 'Normalized' : 'Not normalized'}</p>
            <hr className="border-surface-300/60" />
            <p className="text-xs text-slate-400">Clip</p>
            <InfoRow label="Track" value={activeClip.trackId} />
            <InfoRow label="Timeline start" value={activeClip.timelineStartFrame} />
            <InfoRow label="In" value={activeClip.startFrame} />
            <InfoRow label="Out" value={activeClip.endFrame} />
            <InfoRow label="Duration" value={clipDuration ?? '—'} />
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                onClick={createDropKeyframes}
                className="rounded-md border border-surface-300/60 px-3 py-1 text-white transition hover:border-accent"
              >
                Drop I-frames in selection
              </button>
              <button
                onClick={createFreezeReference}
                className="rounded-md border border-surface-300/60 px-3 py-1 text-white transition hover:border-accent"
              >
                Freeze reference
              </button>
              <button
                onClick={() => createRedirectFrames(activeClip.id)}
                className="rounded-md border border-surface-300/60 px-3 py-1 text-white transition hover:border-accent"
              >
                Redirect frames
              </button>
              <button
                onClick={() =>
                  addAutomationCurve(
                    project.operations.dropKeyframes[project.operations.dropKeyframes.length - 1]?.id ?? 'op',
                    'scale',
                    selection.timeRange?.startFrame ?? 0,
                    selection.timeRange?.endFrame ?? activeClip.endFrame,
                  )
                }
                className="rounded-md border border-surface-300/60 px-3 py-1 text-white transition hover:border-accent"
              >
                Add automation curve
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Inspector

