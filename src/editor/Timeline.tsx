import { motion } from 'framer-motion'
import { Project } from '../engine/types'

interface Props {
  project: Project
}

const colors = ['bg-orange-500', 'bg-slate-500', 'bg-emerald-500']

const Timeline = ({ project }: Props) => {
  return (
    <div className="rounded-xl border border-surface-300/60 bg-surface-200/80 p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Timeline</p>
          <p className="text-sm text-slate-300">
            {project.settings.width}x{project.settings.height} @ {project.settings.fps}fps
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <button className="rounded-md border border-surface-300/60 px-2 py-1 hover:border-accent">-
          </button>
          <button className="rounded-md border border-surface-300/60 px-2 py-1 hover:border-accent">+
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {project.timeline.tracks
          .slice()
          .sort((a, b) => a.index - b.index)
          .map((track) => (
            <div key={track.id} className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="rounded border border-surface-300/60 px-2 py-1 font-mono text-[11px] text-white">{track.name}</span>
                <span className="text-slate-500">Video track</span>
              </div>
              <div className="relative h-16 rounded-lg border border-surface-300/60 bg-surface-300/60">
                {project.timeline.clips
                  .filter((clip) => clip.trackId === track.id)
                  .map((clip, idx) => {
                    const width = Math.max(16, clip.endFrame - clip.startFrame)
                    const left = clip.timelineStartFrame
                    return (
                      <motion.div
                        key={clip.id}
                        layout
                        style={{ width: `${width}px`, left: `${left}px` }}
                        className={`absolute top-2 h-12 rounded-md ${colors[idx % colors.length]} bg-opacity-70 px-3 py-2`}
                        whileHover={{ scale: 1.01 }}
                      >
                        <p className="text-sm font-medium text-white">{clip.id}</p>
                        <p className="text-[11px] text-white/70">{clip.startFrame} → {clip.endFrame}</p>
                      </motion.div>
                    )
                  })}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export default Timeline
