import {
  AutomationCurve,
  EngineError,
  EngineErrorCode,
  OPERATION_PRIORITY,
  Operation,
  Operations,
  PARAMETER_RANGES,
  Project,
  TimelineClip,
} from './types'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export class ValidationError extends Error {
  constructor(message: string, public errors: string[]) {
    super(message)
    this.name = 'ValidationError'
  }
}

const isInRange = (value: number, [min, max]: readonly [number, number]) => value >= min && value <= max

const collectClipIds = (clips: TimelineClip[]): Set<string> => new Set(clips.map((clip) => clip.id))

export const validateAutomationCurve = (curve: AutomationCurve, operations: Operations): string[] => {
  const errors: string[] = []
  const operationList = getOperationList(operations)
  const targetOperation = operationList.find((op) => 'id' in op && op.id === curve.target.operationId)
  if (!targetOperation) {
    errors.push(`Unknown operation reference ${curve.target.operationId} for curve ${curve.id}`)
  }
  const range =
    curve.target.param === 'quantize' ? PARAMETER_RANGES.quantize : curve.target.param === 'jitter' ? PARAMETER_RANGES.jitter : curve.target.param === 'scale' ? PARAMETER_RANGES.scale : PARAMETER_RANGES.drift
  curve.points.forEach((point) => {
    if (!isInRange(point.value, range)) {
      errors.push(`Point ${point.value} for curve ${curve.id} is out of range for ${curve.target.param}`)
    }
  })
  return errors
}

export const getOperationList = (operations: Operations): Operation[] => {
  return OPERATION_PRIORITY.flatMap((key) => operations[key] as Operation[])
}

export const validateProject = (project: Project): ValidationResult => {
  const errors: string[] = []
  if (!project.metadata.name) errors.push('Project name is required')
  if (project.settings.blockSize <= 0) errors.push('Block size must be positive')
  if (project.timeline.tracks.length === 0) errors.push('At least one track is required')
  const trackIds = new Set(project.timeline.tracks.map((track) => track.id))
  const clipIds = collectClipIds(project.timeline.clips)
  project.timeline.clips.forEach((clip) => {
    if (!trackIds.has(clip.trackId)) {
      errors.push(`Clip ${clip.id} references missing track ${clip.trackId}`)
    }
    if (!project.sources.some((source) => source.id === clip.sourceId)) {
      errors.push(`Clip ${clip.id} references missing source ${clip.sourceId}`)
    }
    if (clip.startFrame > clip.endFrame) {
      errors.push(`Clip ${clip.id} has invalid frame range`)
    }
  })

  const allOperations = getOperationList(project.operations)
  allOperations.forEach((operation) => {
    if (!operation.id) {
      errors.push('Operation id is required')
    }
    if (operation.type === 'DropKeyframes' && operation.pattern?.everyNth !== undefined && operation.pattern.everyNth <= 0) {
      errors.push('DropKeyframes everyNth must be positive')
    }
    if ('clipId' in operation && operation.clipId && !clipIds.has(operation.clipId)) {
      errors.push(`${operation.type} references missing clip ${operation.clipId}`)
    }
  })

  project.automationCurves.forEach((curve) => {
    errors.push(...validateAutomationCurve(curve, project.operations))
  })

  project.masks.forEach((mask) => {
    if (mask.appliesTo?.clipIds) {
      mask.appliesTo.clipIds.forEach((clipId) => {
        if (!clipIds.has(clipId)) {
          errors.push(`Mask ${mask.id} references missing clip ${clipId}`)
        }
      })
    }
    mask.keyframes.forEach((kf) => {
      if (kf.transform.width <= 0 || kf.transform.height <= 0) {
        errors.push(`Mask ${mask.id} has invalid dimensions at frame ${kf.timelineFrame}`)
      }
    })
  })

  const invalidOperationKinds = Object.keys(project.operations).filter(
    (key) => !OPERATION_PRIORITY.includes(key as keyof Operations),
  )
  if (invalidOperationKinds.length) {
    errors.push(`Unknown operation kinds: ${invalidOperationKinds.join(', ')}`)
  }

  return { valid: errors.length === 0, errors }
}

export const assertValidProject = (project: Project): void => {
  const { valid, errors } = validateProject(project)
  if (!valid) {
    throw new ValidationError(`Project validation failed: ${errors.join(', ')}`, errors)
  }
}

export const toEngineError = (code: EngineErrorCode, details: string | string[]): EngineError => ({
  code,
  message: Array.isArray(details) ? details.join('; ') : details,
  details,
})
