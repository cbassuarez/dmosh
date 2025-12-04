import { AutomationCurve } from '../engine/types'

interface Props {
  curves: AutomationCurve[]
}

const AutomationCurvesPanel = ({ curves }: Props) => {
  return (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Automation</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {curves.map((curve) => (
          <div key={curve.id} className="rounded-lg border border-surface-300/60 bg-surface-300/60 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white">{curve.name ?? curve.id}</p>
              <span className="font-mono text-[11px] uppercase text-accent">{curve.target.param}</span>
            </div>
            <p className="text-xs text-slate-400">{curve.points.length} key points • {curve.interpolation}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AutomationCurvesPanel
