import { NormalizationError, NormalizedProfile, Project, Source, TimelineClip, TimelineTrack } from '../../engine/types'

export type WizardDetails = {
  name: string
  author: string
  description?: string
  seed?: number
}

export type WizardMediaItem = {
  id: string
  fileName: string
  hash?: string
  hasAudio?: boolean
  pixelFormat?: string
  profile?: NormalizedProfile
  durationFrames?: number
  normalizationError?: NormalizationError
}

export type WizardSettings = {
  width: number
  height: number
  fps: number
  blockSize: number
  autoCreateTrack: boolean
}

export type WizardState = {
  details: WizardDetails
  media: WizardMediaItem[]
  settings: WizardSettings
}

const emptyOperations = {
  dropKeyframes: [],
  freezeReference: [],
  redirectFrames: [],
  holdSmear: [],
  motionVectorTransforms: [],
}

export const buildProjectFromWizard = (state: WizardState): Project => {
  const createdAt = new Date().toISOString()
  const seed = Number.isFinite(state.details.seed) ? state.details.seed! : Math.floor(Math.random() * 10_000_000)

  const sources: Source[] = state.media.map((item, index) => ({
    id: item.id || `src-${index + 1}`,
    originalName: item.fileName,
    hash: item.hash || `hash-${index + 1}`,
    audioPresent: item.hasAudio ?? false,
    pixelFormat: item.pixelFormat ?? 'unknown',
    normalizedProfile: item.profile,
    durationFrames: item.durationFrames ?? Math.max(1, Math.round(state.settings.fps * 5)),
    normalizationError: item.normalizationError,
  }))

  const track: TimelineTrack = { id: 'track-1', kind: 'video', index: 0, name: 'Video 1' }
  const timelineClips = buildInitialClips(state.settings.autoCreateTrack, sources, track)

  return {
    version: '0.1.0',
    metadata: {
      name: state.details.name,
      author: state.details.author,
      description: state.details.description,
      createdAt,
      updatedAt: createdAt,
    },
    seed,
    settings: {
      width: state.settings.width,
      height: state.settings.height,
      fps: state.settings.fps,
      blockSize: state.settings.blockSize,
    },
    sources,
    timeline: {
      fps: state.settings.fps,
      width: state.settings.width,
      height: state.settings.height,
      tracks: [track],
      clips: timelineClips,
    },
    masks: [],
    operations: emptyOperations,
    automationCurves: [],
  }
}

export const buildInitialClips = (
  autoCreateTrack: boolean,
  sources: Source[],
  track: TimelineTrack,
): TimelineClip[] => {
  if (!autoCreateTrack || !sources.length) return []
  const clips: TimelineClip[] = []
  let cursor = 0

  sources.forEach((source, index) => {
    const duration = Math.max(1, source.durationFrames)
    const clip: TimelineClip = {
      id: `clip-${index + 1}`,
      sourceId: source.id,
      trackId: track.id,
      startFrame: 0,
      endFrame: duration - 1,
      timelineStartFrame: cursor,
    }
    clips.push(clip)
    cursor += duration
  })

  return clips
}

export const suggestFps = (media: WizardMediaItem[], fallback = 30) => {
  const counts = new Map<number, number>()
  media.forEach((item) => {
    const fps = item.profile?.fps
    if (!fps) return
    counts.set(fps, (counts.get(fps) ?? 0) + 1)
  })
  if (!counts.size) return fallback
  let best = fallback
  let bestCount = 0
  counts.forEach((count, fps) => {
    if (count > bestCount || (count === bestCount && fps > best)) {
      best = fps
      bestCount = count
    }
  })
  return best
}

export const suggestResolution = (
  media: WizardMediaItem[],
  fallback: { width: number; height: number } = { width: 1920, height: 1080 },
) => {
  const counts = new Map<string, { width: number; height: number; count: number }>()
  media.forEach((item) => {
    const width = item.profile?.width
    const height = item.profile?.height
    if (!width || !height) return
    const key = `${width}x${height}`
    counts.set(key, { width, height, count: (counts.get(key)?.count ?? 0) + 1 })
  })
  if (!counts.size) return fallback
  let best = { ...fallback, count: 0 }
  counts.forEach((entry) => {
    const area = entry.width * entry.height
    const bestArea = best.width * best.height
    if (entry.count > best.count || (entry.count === best.count && area > bestArea)) {
      best = entry
    }
  })
  return { width: best.width, height: best.height }
}

export const totalDurationSeconds = (media: WizardMediaItem[], fps: number) => {
  if (!media.length) return 0
  const frames = media.reduce((sum, item) => sum + (item.durationFrames ?? fps * 5), 0)
  return frames / Math.max(1, fps)
}

