import { Play, Pause, Upload, Download, HardDrive } from 'lucide-react'
import { motion } from 'framer-motion'
import { EngineState } from '../../hooks/useEngineStatus'

interface Props {
  projectName: string
  status: { state: EngineState; timecode: string; fps: number; message: string }
}

const TopBar = ({ projectName, status }: Props) => {
  return (
    <div className="flex items-center justify-between rounded-xl border border-surface-300/60 bg-surface-200/70 px-4 py-3 shadow-panel">
      <div className="flex items-center gap-3 text-sm">
        <span className="rounded-md border border-surface-300/60 bg-surface-300/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-400">
          {projectName}
        </span>
        <div className="flex items-center gap-2 text-slate-300">
          <Upload className="h-4 w-4 text-slate-400" />
          <span className="hover:text-white">Import</span>
          <Download className="ml-4 h-4 w-4 text-slate-400" />
          <span className="hover:text-white">Export</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm font-mono text-slate-200">
        <div className="flex items-center gap-2 rounded-md border border-surface-300/60 px-3 py-1">
          <Play className="h-4 w-4 text-accent" />
          <Pause className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-400">{status.fps} fps</span>
        </div>
        <span className="text-accent">{status.timecode}</span>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2 rounded-md border border-surface-300/80 bg-surface-300/40 px-3 py-1"
        >
          <HardDrive className="h-4 w-4 text-slate-400" />
          <span className="text-xs uppercase tracking-[0.15em] text-slate-400">{status.state}</span>
          <span className="text-xs text-slate-300">{status.message}</span>
        </motion.div>
      </div>
    </div>
  )
}

export default TopBar
