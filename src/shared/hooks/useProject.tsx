/* eslint-disable react-refresh/only-export-components */
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  AutomationCurve,
  DropKeyframesOp,
  FreezeReferenceOp,
  Project,
  RedirectFramesOp,
  Source,
  TimelineClip,
  TimelineRange,
  TimelineTrack,
} from '../../engine/types'

const STORAGE_KEY = 'datamosh-current-project'

type SelectionState = {
  selectedClipId: string | null
  currentFrame: number
  timeRange: TimelineRange | null
}

export type ProjectContextShape = {
  project: Project | null
  selection: SelectionState
  setProject: (next: Project | null) => void
  newProject: () => void
  loadProjectFromFile: (file: File) => Promise<void>
  exportProject: () => void
  importSources: (files: File[]) => Promise<void>
  addTrack: () => void
  placeClipFromSource: (sourceId: string, timelineFrame: number, trackId?: string) => void
  moveClip: (clipId: string, deltaFrames: number) => void
  trimClip: (clipId: string, edge: 'start' | 'end', delta: number) => void
  selectClip: (clipId: string | null) => void
  setCurrentFrame: (frame: number) => void
  setTimeRange: (range: TimelineRange | null) => void
  createDropKeyframes: () => void
  createFreezeReference: () => void
  createRedirectFrames: (targetClipId: string) => void
  addAutomationCurve: (
    operationId: string,
    param: AutomationCurve['target']['param'],
    start: number,
    end: number,
  ) => void
  error: string | null
}

const ProjectContext = createContext<ProjectContextShape | null>(null)

const defaultSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  blockSize: 16,
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
    tracks: [],
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
    currentFrame: 0,
    timeRange: null,
  })

  const save = useCallback(
    (next: Project | null) => {
      setProject(next)
      if (next) persist({ ...next, metadata: { ...next.metadata, updatedAt: new Date().toISOString() } })
    },
    [setProject],
  )

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (isProject(parsed)) {
        setProject(parsed)
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  const newProject = useCallback(() => {
    setError(null)
    save(createEmptyProject())
  }, [save])

  const loadProjectFromFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        if (!isProject(parsed)) {
          throw new Error('Invalid project schema')
        }
        setError(null)
        save(parsed)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to parse project file'
        setError(message)
      }
    },
    [save],
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
      save({
        ...project,
        timeline: {
          ...project.timeline,
          clips: project.timeline.clips.map((clip) =>
            clip.id === clipId
              ? { ...clip, timelineStartFrame: Math.max(0, Math.round(clip.timelineStartFrame + deltaFrames)) }
              : clip,
          ),
        },
      })
    },
    [project, save],
  )

  const trimClip = useCallback(
    (clipId: string, edge: 'start' | 'end', delta: number) => {
      if (!project) return
      save({
        ...project,
        timeline: {
          ...project.timeline,
          clips: project.timeline.clips.map((clip) => {
            if (clip.id !== clipId) return clip
            if (edge === 'start') {
              const nextStart = Math.min(clip.endFrame, Math.max(0, Math.round(clip.startFrame + delta)))
              return { ...clip, startFrame: nextStart }
            }
            const nextEnd = Math.max(clip.startFrame, Math.round(clip.endFrame + delta))
            return { ...clip, endFrame: nextEnd }
          }),
        },
      })
    },
    [project, save],
  )

  const selectClip = useCallback((clipId: string | null) => {
    setSelection((prev) => ({ ...prev, selectedClipId: clipId }))
  }, [])

  const setCurrentFrame = useCallback((frame: number) => {
    setSelection((prev) => ({ ...prev, currentFrame: frame }))
  }, [])

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

  const value = useMemo<ProjectContextShape>(
    () => ({
      project,
      selection,
      setProject: save,
      newProject,
      loadProjectFromFile,
      exportProject,
      importSources,
      addTrack,
      placeClipFromSource,
      moveClip,
      trimClip,
      selectClip,
      setCurrentFrame,
      setTimeRange,
      createDropKeyframes,
      createFreezeReference,
      createRedirectFrames,
      addAutomationCurve,
      error,
    }),
    [
      addAutomationCurve,
      addTrack,
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
      project,
      save,
      selectClip,
      selection,
      setCurrentFrame,
      setTimeRange,
      trimClip,
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

