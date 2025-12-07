import { motion, useReducedMotion } from 'framer-motion'

export type SpriteKind = 'export' | 'upload' | 'generic'
export type SpriteLoadState = 'idle' | 'busy' | 'overloaded'

export interface StatusSpriteProps {
  kind?: SpriteKind
  loadState: SpriteLoadState
  queueLength?: number
  oldestQueuedSeconds?: number
  estimatedWaitSeconds?: number
  labelOverride?: string
  className?: string
}

const formatEta = (seconds?: number): string | null => {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null
  if (seconds < 90) return `~${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const rem = Math.round(seconds % 60)
  if (mins < 10 && rem > 0) return `~${mins}m ${rem}s`
  return `~${mins}m`
}

const getLabels = (props: {
  loadState: SpriteLoadState
  queueLength?: number
  oldestQueuedSeconds?: number
  estimatedWaitSeconds?: number
  labelOverride?: string
}): { title: string; subtitle: string } => {
  if (props.labelOverride) {
    return {
      title: props.labelOverride,
      subtitle: '',
    }
  }

  const eta = formatEta(props.estimatedWaitSeconds)

  if (props.loadState === 'busy') {
    return {
      title: 'Renderer is chewing through frames…',
      subtitle: eta
        ? `This may take ${eta}. You can keep working while it runs.`
        : 'You can keep working while your jobs render in the background.',
    }
  }

  if (props.loadState === 'overloaded') {
    const queueInfo = props.queueLength && props.queueLength > 1 ? `${props.queueLength} jobs in queue.` : ''
    return {
      title: 'Render farm is under heavy load.',
      subtitle: eta
        ? `${queueInfo} Estimated wait ${eta}. Jobs will complete in order.`
        : `${queueInfo} Jobs are queued and will complete in order. You can close this panel; progress is tracked here.`,
    }
  }

  return {
    title: 'System idle.',
    subtitle: 'No active render jobs.',
  }
}

export const StatusSprite = (props: StatusSpriteProps) => {
  const { loadState, queueLength, oldestQueuedSeconds, estimatedWaitSeconds, className } = props
  const shouldReduceMotion = useReducedMotion()

  const animVariant: SpriteLoadState =
    loadState === 'overloaded' ? 'overloaded' : loadState === 'busy' ? 'busy' : 'idle'

  const { title, subtitle } = getLabels({
    loadState,
    queueLength,
    oldestQueuedSeconds,
    estimatedWaitSeconds,
    labelOverride: props.labelOverride,
  })

  const variants = {
    idle: { scale: 1, y: 0, boxShadow: '0 0 0 rgba(0,0,0,0)' },
    busy: { scale: 1.04, y: -2, boxShadow: '0 0 18px rgba(0,0,0,0.45)' },
    overloaded: { scale: 1.06, y: -3, boxShadow: '0 0 24px rgba(0,0,0,0.6)' },
  } as const

  const transition = shouldReduceMotion
    ? { duration: 0.3 }
    : { duration: 1.4, repeat: Infinity, repeatType: 'reverse' as const }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-surface-300/60 bg-surface-200/80 px-3 py-2 shadow-panel ${
        className ?? ''
      }`}
    >
      <motion.div
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent/10"
        variants={variants}
        animate={animVariant}
        transition={transition}
      >
        <motion.div
          className="absolute h-10 w-10 rounded-full border border-accent/60"
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  scale: [1, 1.05, 1],
                  opacity: [0.6, 0.9, 0.6],
                }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0.4 }
              : { duration: 2.2, repeat: Infinity, repeatType: 'loop' }
          }
        />

        <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-accent/80">
          <div className="flex gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-surface-900/90" />
            <div className="h-1.5 w-1.5 rounded-full bg-surface-900/90" />
          </div>
        </div>
      </motion.div>

      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-100">{title}</p>
        {subtitle && <p className="truncate text-[11px] text-slate-400">{subtitle}</p>}
      </div>
    </div>
  )
}
