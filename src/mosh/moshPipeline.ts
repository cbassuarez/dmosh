export type MoshScopeKind = 'project' | 'timeline' | 'track' | 'clip'

export type MoshOpKind =
  | 'DropIntraFrames'
  | 'FreezeReferenceFrame'
  | 'HoldMotionVectors'
  | 'ClassicDatamosh'
  | 'QuantizerBias'
  | 'MotionVectorNoise'
  | 'ReferenceChainRandomize'
  | 'ReferenceChainTruncate'
  | 'SpatialCoherenceScramble'
  | 'GopTopologyRewrite'

export interface MoshOpInstance {
  id: string
  kind: MoshOpKind
  enabled: boolean
  params: Record<string, unknown>
}

export interface MoshScopePipeline {
  scope: MoshScopeKind
  chain: MoshOpInstance[]
}

export interface MoshPipeline {
  globalBypass: boolean
  scopes: MoshScopePipeline[]
}

export type FrameType = 'I' | 'P' | 'B'

export interface StructuralFrame {
  index: number
  type: FrameType
  refIndices: number[]
  keyframe: boolean
}

export type StructuralStream = StructuralFrame[]

export type StructuralTransform = (
  stream: StructuralStream,
  params: Record<string, unknown>,
) => StructuralStream

export const MOSH_OP_IMPL: Record<MoshOpKind, StructuralTransform> = {
  DropIntraFrames: (stream) => stream.filter((f) => f.type !== 'I'),

  FreezeReferenceFrame: (stream, params) => {
    const defaultRefIndex = stream.find((f) => f.type === 'I')?.index ?? 0
    const refIndex =
      typeof params.referenceIndex === 'number' ? params.referenceIndex : defaultRefIndex

    return stream.map((f) => {
      if (f.type === 'I') return f
      return { ...f, refIndices: [refIndex] }
    })
  },

  HoldMotionVectors: (stream) => stream,

  ClassicDatamosh: (stream) => stream.filter((f) => f.type !== 'I'),

  QuantizerBias: (stream) => stream,
  MotionVectorNoise: (stream) => stream,
  ReferenceChainRandomize: (stream) => stream,
  ReferenceChainTruncate: (stream) => stream,
  SpatialCoherenceScramble: (stream) => stream,
  GopTopologyRewrite: (stream) => stream,
}

export function applyMoshPipeline(
  stream: StructuralStream,
  pipeline: MoshPipeline | null | undefined,
  scope: MoshScopeKind,
): StructuralStream {
  if (!pipeline || pipeline.globalBypass) return stream

  const scopePipe = pipeline.scopes.find((s) => s.scope === scope)
  if (!scopePipe || scopePipe.chain.length === 0) return stream

  return scopePipe.chain.reduce<StructuralStream>((acc, node) => {
    if (!node.enabled) return acc
    const impl = MOSH_OP_IMPL[node.kind]
    if (!impl) return acc
    return impl(acc, node.params ?? {})
  }, stream)
}
