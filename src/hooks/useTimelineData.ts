import { useMemo, useState } from 'react'

export interface TimelineClip {
  id: string
  label: string
  start: number
  end: number
  color: string
  type: 'video' | 'mask' | 'automation'
}

export const useTimelineData = () => {
  const [selectedClip, setSelectedClip] = useState<string>('clip-a')
  const clips = useMemo<TimelineClip[]>(
    () => [
      { id: 'clip-a', label: 'Intro.mov', start: 0, end: 18, color: '#ff755f', type: 'video' },
      { id: 'clip-b', label: 'Vectors.mp4', start: 18, end: 36, color: '#7c3aed', type: 'video' },
      { id: 'mask-1', label: 'Ellipse mask', start: 6, end: 28, color: '#22c55e', type: 'mask' },
      { id: 'auto-1', label: 'Jitter curve', start: 10, end: 34, color: '#38bdf8', type: 'automation' },
    ],
    [],
  )

  return { clips, selectedClip, setSelectedClip }
}
