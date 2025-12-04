import {
  Engine,
  EngineProgress,
  EngineResult,
  Operation,
  Operations,
  OPERATION_PRIORITY,
  Project,
  RenderSettings,
} from './types'
import { toEngineError, validateProject } from './validation'

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

const seededRandom = (seed: number): (() => number) => {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

export const selectEffectiveOperations = composeOperations

export class PipelineEngine implements Engine {
  private progress: EngineProgress = { phase: 'idle', progress: 0 }

  getProgress(): EngineProgress {
    return this.progress
  }

  async analyze(project: Project): Promise<void> {
    const result = validateProject(project)
    if (!result.valid) {
      const error = toEngineError('INVALID_PROJECT', result.errors)
      const err = new Error(error.message) as Error & { code?: string; details?: unknown }
      err.code = error.code
      err.details = error.details
      throw err
    }
    const invalidSources = project.sources.filter((source) => source.normalizationError)
    if (invalidSources.length) {
      const error = toEngineError(
        'NORMALIZATION_FAILED',
        invalidSources.map((s) => `${s.id}:${s.normalizationError?.code}`),
      )
      const err = new Error(error.message) as Error & { code?: string; details?: unknown }
      err.code = error.code
      err.details = error.details
      throw err
    }
    this.progress = { phase: 'analyzing', progress: 1, message: 'Validation complete' }
  }

  async render(project: Project, settings?: RenderSettings): Promise<EngineResult> {
    await this.analyze(project)
    this.progress = { phase: 'rendering', progress: 0.1, message: 'Applying operations' }
    const ordered = composeOperations(project.operations)
    const rng = seededRandom(project.seed)
    const topologySummary = {
      preset: settings?.preset ?? 'web',
      appliedOperations: ordered.map((op) => op.id),
      checksum: ordered.reduce((acc, op) => acc + op.id.length, 0) + Math.floor(rng() * 1000),
    }
    this.progress = { phase: 'rendering', progress: 1, message: 'Done' }
    return { topologySummary }
  }
}

export const createEngine = (): Engine => new PipelineEngine()
