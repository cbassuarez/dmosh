import type { RenderSettings } from './renderTypes'
import { OPERATION_PRIORITY, Operation, Operations, Project } from './types'

export type { RenderSettings } from './renderTypes'

export type PreviewScale = 'full' | 'half' | 'quarter'

export type PlaybackMode = 'realTime' | 'frameAccurate'

export type EnginePhase = 'idle' | 'normalizing' | 'indexing' | 'rendering' | 'encoding'

export interface EngineProgress {
  phase: EnginePhase
  progress: number
  message?: string
}

export type EngineWorkerErrorCode =
  | 'NORMALIZATION_FAILED'
  | 'INVALID_PROJECT'
  | 'RENDER_FAILED'
  | 'EXPORT_FAILED'
  | 'SOURCE_MISSING'
  | 'UNSUPPORTED_PRESET'

export interface EngineWorkerError {
  code: EngineWorkerErrorCode
  message: string
  details?: unknown
  sourceId?: string
  preset?: string
}

export interface VideoEngine {
  loadProject(project: Project): Promise<void>
  analyze(): Promise<void>
  renderFrame(timelineFrame: number, previewScale: PreviewScale): Promise<ImageBitmap>
  exportVideo(settings: RenderSettings, onProgress: (p: EngineProgress) => void): Promise<Blob>
}

const selectOperationKey = (operation: Operation): string => {
  if (operation.type === 'DropKeyframes') {
    return `${operation.type}-${operation.clipId ?? 'all'}-${operation.timelineRange.startFrame}-${operation.timelineRange.endFrame}`
  }
  if (operation.type === 'FreezeReference') {
    return `${operation.type}-${operation.clipId ?? operation.sourceId ?? 'all'}-${operation.anchorFrame}`
  }
  if (operation.type === 'RedirectFrames') {
    return `${operation.type}-${operation.toAnchor.clipId}-${operation.fromRange.startFrame}-${operation.fromRange.endFrame}`
  }
  if (operation.type === 'HoldSmear') {
    return `${operation.type}-${operation.clipId ?? 'global'}-${operation.range.startFrame}-${operation.range.endFrame}`
  }
  return `${operation.type}-${operation.timelineRange.startFrame}-${operation.timelineRange.endFrame}-${operation.maskId ?? 'none'}`
}

const composeOperations = (operations: Operations): Operation[] => {
  const ordered: Operation[] = []
  OPERATION_PRIORITY.forEach((kind) => {
    const seen = new Map<string, Operation>()
    operations[kind].forEach((operation) => {
      const key = selectOperationKey(operation)
      seen.set(key, operation)
    })
    seen.forEach((op) => ordered.push(op))
  })
  return ordered
}

export const selectEffectiveOperations = composeOperations
