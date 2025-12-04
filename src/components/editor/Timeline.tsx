import { motion } from 'framer-motion'
import { TimelineClip } from '../../hooks/useTimelineData'

interface Props {
  clips: TimelineClip[]
  onSelect: (id: string) => void
  selectedId: string
}

const colorsByType: Record<TimelineClip['type'], string> = {
  video: 'bg-accent/60',
  mask: 'bg-success/60',
  automation: 'bg-sky-500/50',
}

const Timeline = ({ clips, onSelect, selectedId }: Props) => {
  const totalDuration = Math.max(...clips.map((c) => c.end))

  return (
    <div className="rounded-xl border border-surface-300/60 bg-surface-200/70 p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
        <span className="uppercase tracking-[0.3em] text-slate-500">Timeline</span>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-surface-300/60 px-3 py-1 hover:border-accent/60">-</button>
          <button className="rounded-md border border-surface-300/60 px-3 py-1 hover:border-accent/60">+</button>
        </div>
      </div>
      <div className="relative h-36 overflow-hidden rounded-lg border border-surface-300/60 bg-surface-300/40">
        <div className="absolute left-16 top-0 h-full w-px bg-surface-400" />
        <div className="absolute left-0 top-0 h-full w-16 border-r border-surface-300/60 bg-surface-200/80 p-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Tracks
        </div>
        <div className="ml-16 h-full space-y-2 px-4 py-3">
          {['Video', 'Masks', 'Automation'].map((lane, laneIdx) => (
            <div key={lane} className="relative h-7">
              <span className="absolute -left-12 top-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">{lane}</span>
              {clips
                .filter((clip) =>
                  laneIdx === 0 ? clip.type === 'video' : laneIdx === 1 ? clip.type === 'mask' : clip.type === 'automation',
                )
                .map((clip) => {
                  const left = (clip.start / totalDuration) * 100
                  const width = ((clip.end - clip.start) / totalDuration) * 100
                  const isSelected = selectedId === clip.id
                  return (
                    <motion.button
                      key={clip.id}
                      onClick={() => onSelect(clip.id)}
                      whileHover={{ scale: 1.01 }}
                      animate={isSelected ? { boxShadow: '0 0 0 1px rgba(255,81,53,0.7)' } : {}}
                      className={`absolute inset-y-0 rounded-md px-3 text-xs font-semibold text-slate-900 ${colorsByType[clip.type]}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      {clip.label}
                    </motion.button>
                  )
                })}
            </div>
          ))}
        </div>
        <motion.div
          initial={{ x: '30%' }}
          animate={{ x: '42%' }}
          transition={{ duration: 2.4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          className="pointer-events-none absolute inset-y-0 w-px bg-accent shadow-glow"
        />
        <div className="absolute bottom-1 right-2 rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1 text-[10px] font-mono text-slate-400">
          I / P / B frame markers pending engine hookup
        </div>
      </div>
    </div>
  )
}

export default Timeline
