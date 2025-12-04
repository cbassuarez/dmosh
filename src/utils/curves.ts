import { CurvePoint } from '../hooks/useAutomationCurves'

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export const insertPoint = (points: CurvePoint[], point: CurvePoint): CurvePoint[] => {
  const clamped: CurvePoint = { time: clamp01(point.time), value: clamp01(point.value) }
  return [...points, clamped].sort((a, b) => a.time - b.time)
}

export const updatePointValue = (points: CurvePoint[], index: number, value: CurvePoint): CurvePoint[] => {
  return points
    .map((pt, idx) => (idx === index ? { time: clamp01(value.time), value: clamp01(value.value) } : pt))
    .sort((a, b) => a.time - b.time)
}
