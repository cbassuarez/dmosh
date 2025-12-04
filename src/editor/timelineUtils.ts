import { Timeline, TimelineClip, TimelineTrack } from '../engine/types'

export const FRAME_COLORS = {
  I: 'bg-emerald-500',
  P: 'bg-blue-500',
  B: 'bg-slate-400',
}

export const generateFramePattern = (length: number) => {
  const pattern: ('I' | 'P' | 'B')[] = []
  for (let i = 0; i < length; i += 1) {
    if (i % 30 === 0) {
      pattern.push('I')
    } else if (i % 3 === 0) {
      pattern.push('P')
    } else {
      pattern.push('B')
    }
  }
  return pattern
}

export const framesToPx = (frames: number, zoom: number) => Math.max(2, frames * zoom)

export const hasOverlapOnTrack = (
  clips: TimelineClip[],
  trackId: string,
  candidate: { startFrame: number; endFrame: number; timelineStartFrame: number; clipId?: string },
) => {
  const candidateStart = candidate.timelineStartFrame
  const candidateEnd = candidate.timelineStartFrame + (candidate.endFrame - candidate.startFrame)
  return clips
    .filter((clip) => clip.trackId === trackId && clip.id !== candidate.clipId)
    .some((clip) => {
      const start = clip.timelineStartFrame
      const end = clip.timelineStartFrame + (clip.endFrame - clip.startFrame)
      return !(candidateEnd <= start || candidateStart >= end)
    })
}

export const reorderTracks = (tracks: TimelineTrack[], sourceId: string, targetId: string) => {
  const sourceIndex = tracks.findIndex((t) => t.id === sourceId)
  const targetIndex = tracks.findIndex((t) => t.id === targetId)
  if (sourceIndex === -1 || targetIndex === -1) return tracks
  const copy = tracks.slice()
  const [removed] = copy.splice(sourceIndex, 1)
  copy.splice(targetIndex, 0, removed)
  return copy.map((track, index) => ({ ...track, index }))
}

export const timelineEndFrame = (timeline: Timeline) => {
  if (!timeline.clips.length) return 0
  return timeline.clips.reduce((max, clip) => {
    const end = clip.timelineStartFrame + (clip.endFrame - clip.startFrame)
    return Math.max(max, end)
  }, 0)
}
