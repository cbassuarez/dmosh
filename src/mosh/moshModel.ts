export type MoshOperationType =
  | 'DropIntraFrames'
  | 'DropPredictedFrames'
  | 'HoldReferenceFrame'
  | 'ClassicDatamosh'
  | 'ClampLongMotionVectors'
  | 'PerturbMotionVectors'
  | 'QuantizeResiduals'
  | 'VisualizeQuantizationNoise'

export interface BaseMoshNode {
  id: string
  op: MoshOperationType
  bypass: boolean
}

export type MoshScopeKind = 'timeline' | 'track' | 'clip'

export const DEFAULT_TIMELINE_ID = 'timeline-1'

export interface MoshScopeId {
  kind: MoshScopeKind
  timelineId: string
  trackId?: string
  clipId?: string
}

export interface DropIntraFramesNode extends BaseMoshNode {
  op: 'DropIntraFrames'
  params: {
    firstIntraOnly: boolean
    probability: number
  }
}

export interface DropPredictedFramesNode extends BaseMoshNode {
  op: 'DropPredictedFrames'
  params: {
    targetTypes: Array<'P' | 'B'>
    probability: number
  }
}

export interface HoldReferenceFrameNode extends BaseMoshNode {
  op: 'HoldReferenceFrame'
  params: {
    mode: 'FirstIntra' | 'LastIntra' | 'SpecificFrameIndex'
    specificFrameIndex?: number | null
    durationMode: 'UntilNextIntra' | 'FixedFrames' | 'FixedSeconds'
    fixedFrames?: number | null
    fixedSeconds?: number | null
  }
}

export interface ClassicDatamoshNode extends BaseMoshNode {
  op: 'ClassicDatamosh'
  params: {
    enabled: boolean
  }
}

export interface StubNode extends BaseMoshNode {
  op: 'ClampLongMotionVectors' | 'PerturbMotionVectors' | 'QuantizeResiduals' | 'VisualizeQuantizationNoise'
  params: Record<string, never>
}

export type MoshNode =
  | DropIntraFramesNode
  | DropPredictedFramesNode
  | HoldReferenceFrameNode
  | ClassicDatamoshNode
  | StubNode

export interface MoshGraph {
  scope: MoshScopeId
  nodes: MoshNode[]
}

export const moshScopeKey = (scope: MoshScopeId): string => {
  const parts = [scope.kind, scope.timelineId, scope.trackId ?? '', scope.clipId ?? ''].filter(Boolean)
  return parts.join('::')
}

export const createEmptyMoshGraph = (scope: MoshScopeId): MoshGraph => ({
  scope,
  nodes: [],
})

export const createDefaultNode = (op: MoshOperationType): MoshNode => {
  const id = `${op}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(16)}`
  const base: BaseMoshNode = { id, op, bypass: false }
  switch (op) {
    case 'DropIntraFrames':
      return { ...base, op, params: { firstIntraOnly: false, probability: 100 } }
    case 'DropPredictedFrames':
      return { ...base, op, params: { targetTypes: ['P'], probability: 100 } }
    case 'HoldReferenceFrame':
      return {
        ...base,
        op,
        params: {
          mode: 'FirstIntra',
          durationMode: 'UntilNextIntra',
          specificFrameIndex: null,
          fixedFrames: null,
          fixedSeconds: null,
        },
      }
    case 'ClassicDatamosh':
      return { ...base, op, params: { enabled: true } }
    case 'ClampLongMotionVectors':
    case 'PerturbMotionVectors':
    case 'QuantizeResiduals':
    case 'VisualizeQuantizationNoise':
      return { ...base, op, params: {} }
    default:
      return { ...base, op, params: {} }
  }
}
