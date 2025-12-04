import { motion } from 'framer-motion'
import { Mask } from '../../hooks/useMasks'
import { TimelineClip } from '../../hooks/useTimelineData'
import CurveEditor from './CurveEditor'
import { useAutomationCurves } from '../../hooks/useAutomationCurves'

interface Props {
  selectedClip?: TimelineClip
  activeMask?: Mask
}

const Inspector = ({ selectedClip, activeMask }: Props) => {
  const { points, updatePoint } = useAutomationCurves()

  return (
    <motion.div
      initial={{ opacity: 0.9, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.24, ease: 'easeInOut' }}
      className="flex h-full flex-col gap-3 rounded-xl border border-surface-300/60 bg-surface-200/70 p-4 shadow-panel"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Inspector</p>
        <span className="rounded-full border border-surface-300/60 px-3 py-1 text-[10px] font-mono text-slate-300">Contextual</span>
      </div>

      {selectedClip && (
        <div className="rounded-lg border border-surface-300/60 bg-surface-300/60 p-3 text-sm text-slate-200">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Clip</p>
          <p className="text-white">{selectedClip.label}</p>
          <p className="text-xs text-slate-400">In {selectedClip.start}s · Out {selectedClip.end}s</p>
        </div>
      )}

      {activeMask && (
        <div className="rounded-lg border border-surface-300/60 bg-surface-300/60 p-3 text-sm text-slate-200">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mask</p>
          <p className="text-white">{activeMask.name}</p>
          <p className="text-xs text-slate-400">{activeMask.type} · mode {activeMask.mode}</p>
        </div>
      )}

      <div className="flex-1 overflow-hidden rounded-lg border border-surface-300/60 bg-surface-300/60 p-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Automation</p>
        <CurveEditor
          points={points}
          onChange={(idx, next) => updatePoint(idx, next)}
          className="mt-2 h-48"
        />
      </div>
    </motion.div>
  )
}

export default Inspector
