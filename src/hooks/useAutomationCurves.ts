import { useMemo, useState } from 'react'

export interface CurvePoint {
  time: number
  value: number
}

export const useAutomationCurves = () => {
  const [points, setPoints] = useState<CurvePoint[]>([
    { time: 0, value: 0.2 },
    { time: 0.25, value: 0.8 },
    { time: 0.55, value: 0.45 },
    { time: 1, value: 0.7 },
  ])

  const addPoint = (point: CurvePoint) => setPoints((prev) => [...prev, point].sort((a, b) => a.time - b.time))
  const updatePoint = (index: number, value: CurvePoint) =>
    setPoints((prev) => prev.map((pt, idx) => (idx === index ? value : pt)).sort((a, b) => a.time - b.time))

  return useMemo(() => ({ points, addPoint, updatePoint }), [points])
}
