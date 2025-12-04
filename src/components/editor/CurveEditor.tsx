import { motion } from 'framer-motion'
import { CurvePoint } from '../../hooks/useAutomationCurves'

interface Props {
  points: CurvePoint[]
  onChange: (index: number, value: CurvePoint) => void
  className?: string
}

const CurveEditor = ({ points, onChange, className }: Props) => {
  const width = 260
  const height = 140

  const handleDrag = (index: number, info: { point: { x: number; y: number } }) => {
    const boundedX = Math.min(Math.max(info.point.x, 0), width)
    const boundedY = Math.min(Math.max(info.point.y, 0), height)
    const time = +(boundedX / width).toFixed(2)
    const value = +(1 - boundedY / height).toFixed(2)
    onChange(index, { time, value })
  }

  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <defs>
          <linearGradient id="curve" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#ff755f" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} rx={10} className="fill-surface-200 stroke-surface-300/60" />
        <polyline
          points={points.map((p) => `${p.time * width},${(1 - p.value) * height}`).join(' ')}
          fill="none"
          stroke="url(#curve)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {points.map((point, idx) => (
          <g key={idx}>
            <circle cx={point.time * width} cy={(1 - point.value) * height} r={10} fill="#ff755f" opacity={0.2} />
            <motion.circle
              cx={point.time * width}
              cy={(1 - point.value) * height}
              r={6}
              fill="#ff5135"
              stroke="#ffffff55"
              drag
              dragConstraints={{ left: 0, right: width, top: 0, bottom: height }}
              dragMomentum={false}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 1.05 }}
              onDrag={(_, info) => handleDrag(idx, info)}
            />
          </g>
        ))}
      </svg>
      <div className="absolute left-2 top-2 rounded-full border border-surface-300/60 bg-surface-200/90 px-2 py-1 text-[10px] font-mono text-slate-400">
        time/value
      </div>
    </div>
  )
}

export default CurveEditor
