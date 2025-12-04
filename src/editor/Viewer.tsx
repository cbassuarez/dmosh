import { motion } from 'framer-motion'
import { Project } from '../engine/types'

interface Props {
  project: Project
}

const Viewer = ({ project }: Props) => {
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
      <div className="flex h-[320px] items-center justify-center bg-gradient-to-br from-surface-200 to-surface-300 text-center">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-white">Preview placeholder</p>
          <p className="text-sm text-slate-300">Motion, masks, and glitch overlays animate here.</p>
        </div>
      </div>
    </motion.div>
  )
}

export default Viewer
