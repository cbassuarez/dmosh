import { useState } from 'react'
import { motion } from 'framer-motion'
import { Expand, Scissors, ZoomIn, ZoomOut, ScanLine } from 'lucide-react'

const framePlaceholder = 'linear-gradient(135deg, #1f2937 0%, #111827 100%)'

const Viewer = () => {
  const [dual, setDual] = useState(false)

  return (
    <div className="rounded-xl border border-surface-300/60 bg-surface-200/70 p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-surface-300/60 px-3 py-1 hover:border-accent/60 hover:text-white">
            <Scissors className="mr-2 inline h-4 w-4 text-slate-400" /> Draw mask
          </button>
          <button className="rounded-md border border-surface-300/60 px-3 py-1 hover:border-accent/60 hover:text-white">
            <ScanLine className="mr-2 inline h-4 w-4 text-slate-400" /> Safe frame
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-surface-300/60 p-2 hover:border-accent/60 hover:text-white">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button className="rounded-md border border-surface-300/60 p-2 hover:border-accent/60 hover:text-white">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDual((v) => !v)}
            className={`rounded-md border px-3 py-1 text-xs transition ${dual ? 'border-accent text-white' : 'border-surface-300/60 text-slate-300'}`}
          >
            {dual ? 'Dual view' : 'Single view'}
          </button>
        </div>
      </div>
      <div className={`grid gap-3 ${dual ? 'md:grid-cols-2' : ''}`}>
        {[0, dual ? 1 : null]
          .filter((v) => v !== null)
          .map((idx) => (
            <motion.div
              key={idx as number}
              initial={{ opacity: 0.85, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="relative aspect-video overflow-hidden rounded-lg border border-surface-300/60 bg-surface-300/70"
              style={{ backgroundImage: framePlaceholder }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                {idx === 0 ? 'Current frame' : 'Reference frame'}
              </div>
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-surface-300/60 bg-surface-200/80 px-3 py-1 text-xs text-slate-300">
                <Expand className="h-3.5 w-3.5 text-accent" /> 1920x1080 · 24fps
              </div>
            </motion.div>
          ))}
      </div>
    </div>
  )
}

export default Viewer
