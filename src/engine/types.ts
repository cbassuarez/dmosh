import type { RenderSettings } from './renderTypes'

export interface Project {
  version: string
  metadata: ProjectMetadata
  seed: number
  settings: ProjectSettings
  sources: Source[]
  timeline: Timeline
  masks: Mask[]
  operations: Operations
  automationCurves: AutomationCurve[]
}

export interface ProjectMetadata {
  name: string
  createdAt: string
  updatedAt: string
  author: string
  description?: string
  notes?: string
}

export interface ProjectSettings {
  width: number
  height: number
  fps: number
  blockSize: number
}

export interface Source {
  id: string
  originalName: string
  hash: string
  audioPresent: boolean
  pixelFormat: string
  normalizedProfile?: NormalizedProfile
  durationFrames: number
  normalizationError?: NormalizationError
  previewUrl: string
  thumbnailUrl?: string
  serverUploaded?: boolean
  serverExt?: string | null
}

export interface NormalizedProfile {
  codec: string
  width: number
  height: number
  fps: number
  hasBFrames: boolean
  gopSize: number | null
}

export interface NormalizationError {
  code: string
  message: string
}

export const cleanupSourcePreviewUrls = (project?: Project | null, activeUrls?: Set<string>) => {
  if (!project) return
  project.sources.forEach((source) => {
    if (source.previewUrl?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(source.previewUrl)
        activeUrls?.delete(source.previewUrl)
      } catch {
        /* noop */
      }
    }
  })
}

export interface Timeline {
  fps: number
  width: number
  height: number
  tracks: TimelineTrack[]
  clips: TimelineClip[]
}

export interface TimelineTrack {
  id: string
  kind: 'video'
  name?: string
  index: number
}

export interface TimelineClip {
  id: string
  trackId: string
  sourceId: string
  startFrame: number
  endFrame: number
  timelineStartFrame: number
}

export interface Mask {
  id: string
  name?: string
  shape: 'rect' | 'ellipse'
  mode: 'inside' | 'outside'
  appliesTo?: {
    clipIds?: string[]
    timelineRanges?: TimelineRange[]
  }
  keyframes: MaskKeyframe[]
  interpolation: 'linear' | 'step'
}

export interface TimelineRange {
  startFrame: number
  endFrame: number
}

export interface MaskKeyframe {
  timelineFrame: number
  transform: MaskTransform
}

export interface MaskTransform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface Operations {
  dropKeyframes: DropKeyframesOp[]
  freezeReference: FreezeReferenceOp[]
  redirectFrames: RedirectFramesOp[]
  holdSmear: HoldSmearOp[]
  motionVectorTransforms: MotionVectorTransformOp[]
}

export type Operation =
  | DropKeyframesOp
  | FreezeReferenceOp
  | RedirectFramesOp
  | HoldSmearOp
  | MotionVectorTransformOp

export interface DropKeyframesOp {
  id: string
  type: 'DropKeyframes'
  timelineRange: TimelineRange
  clipId?: string
  pattern?: {
    everyNth?: number
    offsets?: number[]
  }
}

export interface FreezeReferenceOp {
  id: string
  type: 'FreezeReference'
  sourceId?: string
  clipId?: string
  anchorFrame: number
  targetRange: TimelineRange
}

export interface RedirectFramesOp {
  id: string
  type: 'RedirectFrames'
  fromRange: TimelineRange
  toAnchor: {
    clipId: string
    anchorFrame: number
  }
}

export interface HoldSmearOp {
  id: string
  type: 'HoldSmear'
  anchorFrame: number
  range: TimelineRange
  clipId?: string
  maskId?: string
}

export interface MotionVectorTransformOp {
  id: string
  type: 'MotionVectorTransform'
  timelineRange: TimelineRange
  maskId?: string
  seed?: number
  params: {
    scaleCurveId?: string
    jitterCurveId?: string
    quantizeCurveId?: string
    driftXCurveId?: string
    driftYCurveId?: string
  }
}

export type AutomationTargetKind = 'operationParam'

export interface AutomationCurve {
  id: string
  name?: string
  target: {
    kind: AutomationTargetKind
    operationId: string
    param: 'scale' | 'jitter' | 'quantize' | 'driftX' | 'driftY'
  }
  points: AutomationPoint[]
  interpolation: 'linear' | 'smooth' | 'step'
}

export interface AutomationPoint {
  t: number
  value: number
}

export interface EngineProgress {
  phase: 'idle' | 'analyzing' | 'rendering'
  progress: number
  message?: string
}

export type EngineErrorCode = 'NORMALIZATION_FAILED' | 'INVALID_PROJECT' | 'RENDER_FAILED'

export interface EngineError {
  code: EngineErrorCode
  message: string
  details?: unknown
}

export interface EngineResult {
  topologySummary: unknown
}

export interface Engine {
  analyze(project: Project): Promise<void>
  render(project: Project, settings?: RenderSettings): Promise<EngineResult>
  getProgress(): EngineProgress
}

export type { RenderSettings }

export const OPERATION_PRIORITY: (keyof Operations)[] = [
  'dropKeyframes',
  'freezeReference',
  'redirectFrames',
  'holdSmear',
  'motionVectorTransforms',
]

export const PARAMETER_RANGES = {
  scale: [0, 4] as const,
  jitter: [0, 1] as const,
  quantize: [0, 8] as const,
  drift: [-50, 50] as const,
}
