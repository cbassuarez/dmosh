import { motion } from 'framer-motion'
import type { DragEvent } from 'react'
import { Operation, Project } from '../engine/types'
import AutomationCurvesPanel from './AutomationCurvesPanel'

const SectionHeader = ({ title }: { title: string }) => (
  <div className="flex items-center justify-between border-b border-surface-300/60 px-4 py-2">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</p>
  </div>
)

const ProjectPanel = ({ project }: { project: Project }) => {
  return (
    <div className="flex h-full flex-col divide-y divide-surface-300/60">
      <div className="flex-1 overflow-y-auto scrollbar-dark">
        <SectionHeader title="Clips" />
        <div className="space-y-2 p-4 text-sm">
          {project.sources.length === 0 && <p className="text-xs text-slate-500">Import clips to begin.</p>}
          {project.sources.map((source) => (
            <div
              key={source.id}
              draggable
              onDragStart={(e: DragEvent<HTMLDivElement>) => e.dataTransfer.setData('text/source-id', source.id)}
              className="cursor-grab rounded-lg border border-surface-300/60 bg-surface-300/60 p-3 transition hover:-translate-y-px hover:border-accent/60"
            >
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-400">{source.id}</span>
                <span className="text-slate-400">{Math.round(source.durationFrames)}f</span>
              </div>
              <p className="mt-1 text-sm text-white">{source.originalName}</p>
              <p className="text-xs text-slate-400">Drag to timeline to place</p>
            </div>
          ))}
        </div>
        <SectionHeader title="Placed clips" />
        <div className="space-y-2 p-4 text-sm">
          {project.timeline.clips.map((clip) => {
            const source = project.sources.find((s) => s.id === clip.sourceId)
            return (
              <motion.div
                key={clip.id}
                whileHover={{ scale: 1.01 }}
                className="rounded-lg border border-surface-300/60 bg-surface-300/60 p-3"
              >
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-400">{clip.id}</span>
                  <span className="text-slate-400">Track {clip.trackId}</span>
                </div>
                <p className="mt-1 text-sm text-white">{source?.originalName}</p>
                <p className="text-xs text-slate-400">
                  Frames {clip.startFrame}–{clip.endFrame} @ {clip.timelineStartFrame}
                </p>
              </motion.div>
            )
          })}
        </div>
        <SectionHeader title="Masks" />
        <div className="space-y-2 p-4 text-sm">
          {project.masks.map((mask) => (
            <motion.div
              key={mask.id}
              whileHover={{ scale: 1.01 }}
              className="rounded-lg border border-surface-300/60 bg-surface-300/60 p-3"
            >
              <p className="text-sm text-white">{mask.name ?? mask.id}</p>
              <p className="text-xs text-slate-400">{mask.shape} • {mask.mode}</p>
            </motion.div>
          ))}
        </div>
        <SectionHeader title="Operations" />
        <div className="space-y-2 p-4 text-sm">
          {Object.entries(project.operations).map(([key, list]) => (
            <div key={key} className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{key}</p>
              {list.map((op: Operation) => (
                <motion.div
                  key={op.id}
                  whileHover={{ scale: 1.01 }}
                  className="rounded-lg border border-surface-300/60 bg-surface-300/60 p-3"
                >
                  <p className="font-mono text-xs text-white">{op.type}</p>
                  {'timelineRange' in op && op.timelineRange && (
                    <p className="text-[11px] text-slate-400">
                      {op.timelineRange.startFrame}–{op.timelineRange.endFrame}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <AutomationCurvesPanel curves={project.automationCurves} />
    </div>
  )
}

export default ProjectPanel
