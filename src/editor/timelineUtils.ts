import { Project, Timeline, TimelineClip, TimelineTrack } from '../engine/types'

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

export const computeTimelineLastFrame = (timeline: Timeline) => timelineEndFrame(timeline)

export const getActiveClipAtFrame = (project: { timeline: Timeline }, frame: number): TimelineClip | null => {
  if (!project.timeline.clips.length) return null
  const trackById = new Map(project.timeline.tracks.map((track) => [track.id, track]))

  const matches = project.timeline.clips.filter((clip) => {
    const clipStart = clip.timelineStartFrame
    const clipEnd = clip.timelineStartFrame + (clip.endFrame - clip.startFrame)
    return frame >= clipStart && frame <= clipEnd
  })

  if (!matches.length) return null

  return matches.reduce((top, candidate) => {
    const candidateTrack = trackById.get(candidate.trackId)
    const topTrack = top ? trackById.get(top.trackId) : null
    if (!topTrack) return candidate
    if (!candidateTrack) return top
    return candidateTrack.index > topTrack.index ? candidate : top
  }, null as TimelineClip | null)
}

export const deleteTrackAndClips = (project: Project, trackId: string): Project => {
  const remainingTracks = project.timeline.tracks.filter((track) => track.id !== trackId)
  const reindexedTracks: TimelineTrack[] = remainingTracks.map((track, index) => ({ ...track, index }))
  const remainingClips = project.timeline.clips.filter((clip) => clip.trackId !== trackId)

  return {
    ...project,
    timeline: {
      ...project.timeline,
      tracks: reindexedTracks,
      clips: remainingClips,
    },
  }
}
