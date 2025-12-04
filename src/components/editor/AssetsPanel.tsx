import { useState } from 'react'
import { Film, Shapes, Workflow } from 'lucide-react'
import { motion } from 'framer-motion'
import { Mask } from '../../hooks/useMasks'
import { TimelineClip } from '../../hooks/useTimelineData'

interface Props {
  masks: Mask[]
  clips: TimelineClip[]
}

const tabs = [
  { id: 'clips', label: 'Clips', icon: <Film className="h-4 w-4" /> },
  { id: 'masks', label: 'Masks', icon: <Shapes className="h-4 w-4" /> },
  { id: 'ops', label: 'Operations', icon: <Workflow className="h-4 w-4" /> },
] as const

type TabId = (typeof tabs)[number]['id']

const AssetsPanel = ({ masks, clips }: Props) => {
  const [active, setActive] = useState<TabId>('clips')

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
        Project
      </div>
      <div className="flex gap-2 text-xs text-slate-300">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-2 rounded-md border border-surface-300/60 px-3 py-2 transition hover:border-accent/60 hover:text-white ${
              active === tab.id ? 'border-accent/60 text-white shadow-glow' : ''
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-surface-300/60 bg-surface-200/70 p-3 scrollbar-dark">
        {active === 'clips' && (
          <ul className="space-y-2 text-sm">
            {clips
              .filter((c) => c.type === 'video')
              .map((clip) => (
                <motion.li
                  key={clip.id}
                  whileHover={{ scale: 1.01 }}
                  className="flex items-center justify-between rounded-lg border border-surface-300/60 bg-surface-300/60 px-3 py-2"
                >
                  <div>
                    <p className="text-white">{clip.label}</p>
                    <p className="text-xs text-slate-400">{clip.start}s → {clip.end}s</p>
                  </div>
                  <span className="rounded-full px-2 py-1 text-[10px] font-mono" style={{ backgroundColor: clip.color }}>
                    {clip.id}
                  </span>
                </motion.li>
              ))}
          </ul>
        )}
        {active === 'masks' && (
          <ul className="space-y-2 text-sm">
            {masks.map((mask) => (
              <motion.li
                key={mask.id}
                whileHover={{ scale: 1.01 }}
                className="flex items-center justify-between rounded-lg border border-surface-300/60 bg-surface-300/60 px-3 py-2"
              >
                <div>
                  <p className="text-white">{mask.name}</p>
                  <p className="text-xs text-slate-400">{mask.type.toUpperCase()}</p>
                </div>
                <span className="rounded-full border border-surface-300/60 px-2 py-1 text-[10px] font-mono text-slate-200">
                  {mask.mode}
                </span>
              </motion.li>
            ))}
          </ul>
        )}
        {active === 'ops' && (
          <div className="space-y-3 text-sm text-slate-300">
            <p className="font-semibold text-white">Mosh operations</p>
            <p className="text-xs text-slate-400">Vector smear · Drift · Quantize · Frame shuffle</p>
            <p className="text-xs text-slate-400">Preset lanes ready—engine binding forthcoming.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AssetsPanel
