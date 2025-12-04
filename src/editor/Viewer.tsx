import { motion } from 'framer-motion'
import { Project } from '../engine/types'
import { useProject } from '../shared/hooks/useProject'

interface Props {
  project: Project
}

const Viewer = ({ project }: Props) => {
  const { selection } = useProject()
  const seconds = selection.currentFrame / project.settings.fps
  const timecode = new Date(seconds * 1000).toISOString().substring(14, 23)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26 }}
      className="relative overflow-hidden rounded-xl border border-surface-300/60 bg-surface-200/80 shadow-panel"
    >
      <div className="flex items-center justify-between border-b border-surface-300/60 px-4 py-2 text-xs text-slate-400">
        <span className="uppercase tracking-[0.16em]">Viewer</span>
        <span className="font-mono text-[11px] text-slate-300">
          {project.settings.width}x{project.settings.height} @ {project.settings.fps}fps
        </span>
      </div>
      <div className="flex h-[320px] flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-200 to-surface-300 text-center">
        <p className="text-lg font-semibold text-white">Preview not implemented yet</p>
        <p className="text-sm text-slate-300">Timeline scrubbing updates the current frame only.</p>
        <span className="rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-1 font-mono text-sm text-white">
          {timecode}
        </span>
      </div>
    </motion.div>
  )
}

export default Viewer
