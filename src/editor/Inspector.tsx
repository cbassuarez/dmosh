import { Project } from '../engine/types'

interface Props {
  project: Project
}

const Inspector = ({ project }: Props) => {
  const activeClip = project.timeline.clips[0]
  const activeMask = project.masks[0]
  const activeOperation = project.operations.motionVectorTransforms[0]

  return (
    <div className="flex h-full flex-col divide-y divide-surface-300/60">
      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Inspector</p>
        <div className="mt-3 space-y-2 rounded-lg border border-surface-300/60 bg-surface-300/60 p-3">
          <p className="text-xs text-slate-400">Active clip</p>
          <p className="text-sm text-white">{activeClip?.id}</p>
          <p className="text-xs text-slate-400">
            Frames {activeClip?.startFrame}–{activeClip?.endFrame} on track {activeClip?.trackId}
          </p>
        </div>
        <div className="mt-3 space-y-2 rounded-lg border border-surface-300/60 bg-surface-300/60 p-3">
          <p className="text-xs text-slate-400">Mask</p>
          <p className="text-sm text-white">{activeMask?.name}</p>
          <p className="text-xs text-slate-400">{activeMask?.shape} • {activeMask?.mode}</p>
        </div>
        <div className="mt-3 space-y-2 rounded-lg border border-surface-300/60 bg-surface-300/60 p-3">
          <p className="text-xs text-slate-400">Operation</p>
          <p className="font-mono text-sm text-white">{activeOperation?.type}</p>
          <p className="text-xs text-slate-400">
            Range {activeOperation?.timelineRange.startFrame}–{activeOperation?.timelineRange.endFrame}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Inspector
