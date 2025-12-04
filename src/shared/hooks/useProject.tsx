/* eslint-disable react-refresh/only-export-components */
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  AutomationCurve,
  DropKeyframesOp,
  FreezeReferenceOp,
  cleanupSourcePreviewUrls,
  Mask,
  Operation,
  Operations,
  Project,
  RedirectFramesOp,
  Source,
  TimelineClip,
  TimelineRange,
  TimelineTrack,
} from '../../engine/types'
import { deleteTrackAndClips, hasOverlapOnTrack, reorderTracks, timelineEndFrame } from '../../editor/timelineUtils'
import { ViewerMode, ViewerOverlays, ViewerResolution, ViewerState } from '../../editor/viewerState'

const STORAGE_KEY = 'datamosh-current-project'

type SelectionState = {
  selectedClipId: string | null
  selectedMaskId: string | null
  selectedOperationId: string | null
  selectedCurveId: string | null
  currentFrame: number
  timeRange: TimelineRange | null
}

export type PlayState = 'stopped' | 'playing' | 'paused'

type TransportState = {
  playState: PlayState
  currentTimelineFrame: number
  fps: number
}

export type ProjectContextShape = {
  project: Project | null
  selection: SelectionState
  transport: TransportState
  viewer: ViewerState
  setProject: (next: Project | null) => void
  newProject: () => void
  loadProjectFromFile: (file: File) => Promise<void>
  exportProject: () => void
  importSources: (files: File[]) => Promise<void>
  addTrack: () => void
  removeTrack: (trackId: string) => void
  reorderTrack: (sourceId: string, targetId: string) => void
  placeClipFromSource: (sourceId: string, timelineFrame: number, trackId?: string) => void
  moveClip: (clipId: string, deltaFrames: number) => void
  trimClip: (clipId: string, edge: 'start' | 'end', delta: number) => void
  selectClip: (clipId: string | null) => void
  selectMask: (maskId: string | null) => void
  selectOperation: (operationId: string | null) => void
  selectCurve: (curveId: string | null) => void
  setCurrentFrame: (frame: number) => void
  setTimeRange: (range: TimelineRange | null) => void
  setTimelineFrame: (frame: number) => void
  createDropKeyframes: () => void
  createFreezeReference: () => void
  createRedirectFrames: (targetClipId: string) => void
  addAutomationCurve: (
    operationId: string,
    param: AutomationCurve['target']['param'],
    start: number,
    end: number,
  ) => void
  addMask: (mask: Mask) => void
  addOperation: (type: keyof Operations, op: Operation) => void
  play: () => void
  pause: () => void
  stop: () => void
  setPlayState: (state: PlayState) => void
  stepForward: (frames?: number) => void
  stepBackward: (frames?: number) => void
  setViewerMode: (mode: ViewerMode) => void
  setViewerResolution: (resolution: ViewerResolution) => void
  setViewerOverlays: (overlays: Partial<ViewerOverlays>) => void
  error: string | null
}

const ProjectContext = createContext<ProjectContextShape | null>(null)

const defaultSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  blockSize: 16,
}

const defaultViewerState: ViewerState = {
  mode: 'original',
  resolution: 'half',
  overlays: {
    safeArea: false,
    grid: false,
    timecode: true,
    clipName: false,
    masks: false,
    motionVectors: false,
    glitchIntensity: false,
  },
}

let untitledCounter = 1

const createEmptyProject = (): Project => ({
  version: '0.1.0',
  metadata: {
    name: `Untitled Project ${untitledCounter++}`,
    author: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  seed: Math.floor(Math.random() * 10_000_000),
  settings: defaultSettings,
  sources: [],
  timeline: {
    fps: defaultSettings.fps,
    width: defaultSettings.width,
    height: defaultSettings.height,
    tracks: [
      {
        id: 'track-1',
        kind: 'video',
        name: 'Video 1',
        index: 0,
      },
    ],
    clips: [],
  },
  masks: [],
  operations: {
    dropKeyframes: [],
    freezeReference: [],
    redirectFrames: [],
    holdSmear: [],
    motionVectorTransforms: [],
  },
  automationCurves: [],
})

const isProject = (value: unknown): value is Project => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Project
  return (
    typeof candidate.version === 'string' &&
    candidate.metadata !== undefined &&
    Array.isArray(candidate.sources) &&
    Array.isArray(candidate.timeline?.tracks ?? []) &&
    Array.isArray(candidate.timeline?.clips ?? [])
  )
}

const ensureVideoTracks = (project: Project): Project => {
  if (project.timeline.tracks.length > 0) return project
  const track: TimelineTrack = { id: 'track-1', kind: 'video', index: 0, name: 'Video 1' }
  return {
    ...project,
    timeline: {
      ...project.timeline,
      tracks: [track],
    },
  }
}

const ensureSourcePreviewUrls = (project: Project): Project => ({
  ...project,
  sources: project.sources.map((source) => ({
    ...source,
    previewUrl: source.previewUrl ?? '',
    thumbnailUrl: source.thumbnailUrl,
  })),
})

const shortHash = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-4)}`

const computeHash = async (file: File) => {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const persist = (project: Project | null) => {
  if (!project) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
}

export const ProjectProvider = ({ children }: PropsWithChildren) => {
  const [project, setProject] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionState>({
    selectedClipId: null,
    selectedMaskId: null,
    selectedOperationId: null,
    selectedCurveId: null,
    currentFrame: 0,
    timeRange: null,
  })
  const [transport, setTransport] = useState<TransportState>({
    playState: 'stopped',
    currentTimelineFrame: 0,
    fps: defaultSettings.fps,
  })
  const [viewer, setViewer] = useState<ViewerState>(defaultViewerState)
  const projectRef = useRef<Project | null>(null)

  const save = useCallback(
    (next: Project | null) => {
      if (next) {
        const normalized = ensureSourcePreviewUrls(ensureVideoTracks(next))
        setProject(normalized)
        persist({ ...normalized, metadata: { ...normalized.metadata, updatedAt: new Date().toISOString() } })
      } else {
        cleanupSourcePreviewUrls(project)
        setProject(next)
      }
    },
    [project, setProject],
  )

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (isProject(parsed)) {
        setProject(ensureSourcePreviewUrls(ensureVideoTracks(parsed)))
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    projectRef.current = project
  }, [project])

  useEffect(() => () => cleanupSourcePreviewUrls(projectRef.current), [])

  useEffect(() => {
    if (!project) return
    setTransport((prev) => ({ ...prev, fps: project.timeline.fps }))
    setSelection((prev) => ({
      ...prev,
      currentFrame: Math.min(prev.currentFrame, timelineEndFrame(project.timeline)),
    }))
  }, [project])

  const clampFrame = useCallback(
    (frame: number) => {
      const max = project ? timelineEndFrame(project.timeline) : Number.POSITIVE_INFINITY
      return Math.max(0, Math.min(frame, max))
    },
    [project],
  )

  const syncFrame = useCallback(
    (frame: number) => {
      const next = clampFrame(frame)
      setSelection((prev) => ({ ...prev, currentFrame: next }))
      setTransport((prev) => ({ ...prev, currentTimelineFrame: next }))
    },
    [clampFrame],
  )

  const newProject = useCallback(() => {
    setError(null)
    cleanupSourcePreviewUrls(project)
    save(createEmptyProject())
  }, [project, save])

  const loadProjectFromFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        if (!isProject(parsed)) {
          throw new Error('Invalid project schema')
        }
        setError(null)
        cleanupSourcePreviewUrls(project)
        save(parsed)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to parse project file'
        setError(message)
      }
    },
    [project, save],
  )

  const exportProject = useCallback(() => {
    if (!project) return
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.metadata.name || 'datamosh-project'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [project])

  const addTrack = useCallback(() => {
    if (!project) return
    const nextIndex = project.timeline.tracks.length
    const track: TimelineTrack = {
      id: `track-${nextIndex + 1}`,
      kind: 'video',
      name: `Video ${nextIndex + 1}`,
      index: nextIndex,
    }
    save({
      ...project,
      timeline: { ...project.timeline, tracks: [...project.timeline.tracks, track] },
    })
  }, [project, save])

  const removeTrack = useCallback(
    (trackId: string) => {
      if (!project) return
      const removedClipIds = project.timeline.clips.filter((clip) => clip.trackId === trackId).map((clip) => clip.id)
      const nextProject = deleteTrackAndClips(project, trackId)
      save(nextProject)
      if (removedClipIds.includes(selection.selectedClipId ?? '')) {
        setSelection((prev) => ({ ...prev, selectedClipId: null }))
      }
    },
    [project, save, selection.selectedClipId],
  )

  const reorderTrack = useCallback(
    (sourceId: string, targetId: string) => {
      if (!project) return
      const reordered = reorderTracks(project.timeline.tracks, sourceId, targetId)
      save({ ...project, timeline: { ...project.timeline, tracks: reordered } })
    },
    [project, save],
  )

  const importSources = useCallback(
    async (files: File[]) => {
      if (!project) return
      const newSources: Source[] = []
      for (const file of files) {
        const projectedDuration = project.settings.fps * 10
        const seconds = projectedDuration / project.settings.fps
        if (seconds > 60) {
          const proceed = window.confirm('This clip is longer than 60 seconds; performance may be degraded. Continue?')
          if (!proceed) continue
        }
        const hash = await computeHash(file)
        const id = `src-${project.sources.length + newSources.length + 1}`
        newSources.push({
          id,
          originalName: file.name,
          hash,
          audioPresent: false,
          pixelFormat: 'unknown',
          durationFrames: projectedDuration,
          previewUrl: URL.createObjectURL(file),
          thumbnailUrl: undefined,
        })
      }
      if (!newSources.length) return
      save({ ...project, sources: [...project.sources, ...newSources] })
    },
    [project, save],
  )

  const placeClipFromSource = useCallback(
    (sourceId: string, timelineFrame: number, trackId?: string) => {
      if (!project) return
      let tracks = project.timeline.tracks
      let targetTrack = trackId ? tracks.find((t) => t.id === trackId) : tracks[0]
      if (!targetTrack) {
        targetTrack = { id: 'track-1', kind: 'video', index: 0, name: 'Video 1' }
        tracks = [targetTrack]
      }
      const source = project.sources.find((s) => s.id === sourceId)
      if (!targetTrack || !source) return
      const clip: TimelineClip = {
        id: `clip-${project.timeline.clips.length + 1}`,
        sourceId,
        trackId: targetTrack.id,
        startFrame: 0,
        endFrame: source.durationFrames - 1,
        timelineStartFrame: Math.max(0, Math.round(timelineFrame)),
      }
      const overlaps = hasOverlapOnTrack(project.timeline.clips, targetTrack.id, {
        startFrame: clip.startFrame,
        endFrame: clip.endFrame,
        timelineStartFrame: clip.timelineStartFrame,
      })
      if (overlaps) {
        setError('Clips cannot overlap on the same track')
        return
      }
      save({
        ...project,
        timeline: { ...project.timeline, tracks, clips: [...project.timeline.clips, clip] },
      })
    },
    [project, save],
  )

  const moveClip = useCallback(
    (clipId: string, deltaFrames: number) => {
      if (!project) return
      const nextClips = project.timeline.clips.map((clip) =>
        clip.id === clipId
          ? { ...clip, timelineStartFrame: Math.max(0, Math.round(clip.timelineStartFrame + deltaFrames)) }
          : clip,
      )
      const moved = nextClips.find((clip) => clip.id === clipId)
      if (moved && hasOverlapOnTrack(nextClips.filter((c) => c.id !== clipId), moved.trackId, moved)) {
        setError('Clips cannot overlap on the same track')
        return
      }
      save({
        ...project,
        timeline: {
          ...project.timeline,
          clips: nextClips,
        },
      })
    },
    [project, save],
  )

  const trimClip = useCallback(
    (clipId: string, edge: 'start' | 'end', delta: number) => {
      if (!project) return
      const nextClips = project.timeline.clips.map((clip) => {
        if (clip.id !== clipId) return clip
        if (edge === 'start') {
          const nextStart = Math.min(clip.endFrame, Math.max(0, Math.round(clip.startFrame + delta)))
          return { ...clip, startFrame: nextStart }
        }
        const nextEnd = Math.max(clip.startFrame, Math.round(clip.endFrame + delta))
        return { ...clip, endFrame: nextEnd }
      })
      const trimmed = nextClips.find((clip) => clip.id === clipId)
      if (trimmed && hasOverlapOnTrack(nextClips.filter((c) => c.id !== clipId), trimmed.trackId, trimmed)) {
        setError('Clips cannot overlap on the same track')
        return
      }
      save({
        ...project,
        timeline: {
          ...project.timeline,
          clips: nextClips,
        },
      })
    },
    [project, save],
  )

  const selectClip = useCallback((clipId: string | null) => {
    setSelection((prev) => ({
      ...prev,
      selectedClipId: clipId,
      selectedMaskId: null,
      selectedOperationId: null,
      selectedCurveId: null,
    }))
  }, [])

  const selectMask = useCallback((maskId: string | null) => {
    setSelection((prev) => ({
      ...prev,
      selectedMaskId: maskId,
      selectedClipId: null,
      selectedOperationId: null,
      selectedCurveId: null,
    }))
  }, [])

  const selectOperation = useCallback((operationId: string | null) => {
    setSelection((prev) => ({
      ...prev,
      selectedOperationId: operationId,
      selectedClipId: null,
      selectedMaskId: null,
      selectedCurveId: null,
    }))
  }, [])

  const selectCurve = useCallback((curveId: string | null) => {
    setSelection((prev) => ({
      ...prev,
      selectedCurveId: curveId,
      selectedClipId: null,
      selectedMaskId: null,
      selectedOperationId: null,
    }))
  }, [])

  const setCurrentFrame = useCallback(
    (frame: number) => {
      syncFrame(frame)
    },
    [syncFrame],
  )

  const setTimelineFrame = useCallback(
    (frame: number) => {
      syncFrame(frame)
    },
    [syncFrame],
  )

  const setTimeRange = useCallback((range: TimelineRange | null) => {
    setSelection((prev) => ({ ...prev, timeRange: range }))
  }, [])

  const createDropKeyframes = useCallback(() => {
    if (!project || !selection.timeRange) return
    const op: DropKeyframesOp = {
      id: `drop-${project.operations.dropKeyframes.length + 1}`,
      type: 'DropKeyframes',
      timelineRange: selection.timeRange,
      clipId: selection.selectedClipId ?? undefined,
    }
    save({
      ...project,
      operations: { ...project.operations, dropKeyframes: [...project.operations.dropKeyframes, op] },
    })
  }, [project, save, selection.selectedClipId, selection.timeRange])

  const createFreezeReference = useCallback(() => {
    if (!project) return
    const op: FreezeReferenceOp = {
      id: `freeze-${project.operations.freezeReference.length + 1}`,
      type: 'FreezeReference',
      anchorFrame: selection.currentFrame,
      targetRange: selection.timeRange ?? { startFrame: selection.currentFrame, endFrame: selection.currentFrame },
      clipId: selection.selectedClipId ?? undefined,
    }
    save({
      ...project,
      operations: { ...project.operations, freezeReference: [...project.operations.freezeReference, op] },
    })
  }, [project, save, selection.currentFrame, selection.selectedClipId, selection.timeRange])

  const createRedirectFrames = useCallback(
    (targetClipId: string) => {
      if (!project || !selection.timeRange) return
      const op: RedirectFramesOp = {
        id: `redirect-${project.operations.redirectFrames.length + 1}`,
        type: 'RedirectFrames',
        fromRange: selection.timeRange,
        toAnchor: { clipId: targetClipId, anchorFrame: selection.currentFrame },
      }
      save({
        ...project,
        operations: { ...project.operations, redirectFrames: [...project.operations.redirectFrames, op] },
      })
    },
    [project, save, selection.currentFrame, selection.timeRange],
  )

  const addAutomationCurve = useCallback(
    (operationId: string, param: AutomationCurve['target']['param'], start: number, end: number) => {
      if (!project) return
      const curve: AutomationCurve = {
        id: `curve-${project.automationCurves.length + 1}`,
        target: { kind: 'operationParam', operationId, param },
        points: [
          { t: start, value: 0 },
          { t: end, value: 0 },
        ],
        interpolation: 'linear',
      }
      save({ ...project, automationCurves: [...project.automationCurves, curve] })
    },
    [project, save],
  )

  const addMask = useCallback(
    (mask: Mask) => {
      if (!project) return
      save({ ...project, masks: [...project.masks, mask] })
    },
    [project, save],
  )

  const addOperation = useCallback(
    (type: keyof Operations, op: Operation) => {
      if (!project) return
      save({ ...project, operations: { ...project.operations, [type]: [...project.operations[type], op] } })
    },
    [project, save],
  )

  const play = useCallback(() => setTransport((prev) => ({ ...prev, playState: 'playing' })), [])
  const pause = useCallback(() => setTransport((prev) => ({ ...prev, playState: 'paused' })), [])
  const stop = useCallback(() => {
    setTransport((prev) => ({ ...prev, playState: 'stopped' }))
    syncFrame(0)
  }, [syncFrame])

  const setPlayState = useCallback((state: PlayState) => {
    setTransport((prev) => ({ ...prev, playState: state }))
  }, [])

  const stepForward = useCallback(
    (frames = 1) => {
      syncFrame(selection.currentFrame + frames)
      setTransport((prev) => ({ ...prev, playState: 'paused' }))
    },
    [selection.currentFrame, syncFrame],
  )

  const stepBackward = useCallback(
    (frames = 1) => {
      syncFrame(selection.currentFrame - frames)
      setTransport((prev) => ({ ...prev, playState: 'paused' }))
    },
    [selection.currentFrame, syncFrame],
  )

  const setViewerMode = useCallback((mode: ViewerMode) => {
    setViewer((prev) => ({ ...prev, mode }))
  }, [])

  const setViewerResolution = useCallback((resolution: ViewerResolution) => {
    setViewer((prev) => ({ ...prev, resolution }))
  }, [])

  const setViewerOverlays = useCallback((overlays: Partial<ViewerOverlays>) => {
    setViewer((prev) => ({ ...prev, overlays: { ...prev.overlays, ...overlays } }))
  }, [])

  const value = useMemo<ProjectContextShape>(
    () => ({
      project,
      selection,
      transport,
      viewer,
      setProject: save,
      newProject,
      loadProjectFromFile,
      exportProject,
      importSources,
      addTrack,
      removeTrack,
      reorderTrack,
      placeClipFromSource,
      moveClip,
      trimClip,
      selectClip,
      selectMask,
      selectOperation,
      selectCurve,
      setCurrentFrame,
      setTimelineFrame,
      setTimeRange,
      createDropKeyframes,
      createFreezeReference,
      createRedirectFrames,
      addAutomationCurve,
      addMask,
      addOperation,
      play,
      pause,
      stop,
      setPlayState,
      stepForward,
      stepBackward,
      setViewerMode,
      setViewerResolution,
      setViewerOverlays,
      error,
    }),
    [
      addAutomationCurve,
      addMask,
      addOperation,
      addTrack,
      removeTrack,
      reorderTrack,
      createDropKeyframes,
      createFreezeReference,
      createRedirectFrames,
      error,
      exportProject,
      importSources,
      loadProjectFromFile,
      moveClip,
      newProject,
      placeClipFromSource,
      play,
      pause,
      project,
      save,
      selectClip,
      selectMask,
      selectOperation,
      selectCurve,
      selection,
      setPlayState,
      stepBackward,
      stepForward,
      stop,
      transport,
      viewer,
      setCurrentFrame,
      setTimelineFrame,
      setTimeRange,
      trimClip,
      setViewerMode,
      setViewerResolution,
      setViewerOverlays,
    ],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export const useProject = () => {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}

export const formatHash = (hash: string) => shortHash(hash)

