import type { MoshGraph, MoshNode, MoshOperationType, MoshScopeId } from './moshModel'
import type { MoshPipeline, MoshScopeKind, MoshScopePipeline, MoshOpInstance, MoshOpKind } from './moshPipeline'
import type { MoshGraphRecord } from './moshState'

const mapScopeKind = (scope: MoshScopeId): MoshScopeKind => {
  if (scope.kind === 'timeline') return 'timeline'
  if (scope.kind === 'track') return 'track'
  if (scope.kind === 'clip') return 'clip'
  return 'project'
}

const mapOperationKind = (op: MoshOperationType): MoshOpKind => {
  switch (op) {
    case 'DropIntraFrames':
      return 'DropIntraFrames'
    case 'HoldReferenceFrame':
      return 'FreezeReferenceFrame'
    case 'ClassicDatamosh':
      return 'ClassicDatamosh'
    case 'DropPredictedFrames':
      return 'HoldMotionVectors'
    case 'ClampLongMotionVectors':
      return 'MotionVectorNoise'
    case 'PerturbMotionVectors':
      return 'ReferenceChainRandomize'
    case 'QuantizeResiduals':
      return 'QuantizerBias'
    case 'VisualizeQuantizationNoise':
    default:
      return 'SpatialCoherenceScramble'
  }
}

const mapNodeToInstance = (node: MoshNode): MoshOpInstance => ({
  id: node.id,
  kind: mapOperationKind(node.op),
  enabled: !node.bypass,
  params: { ...node.params },
})

const graphToScopePipeline = (graph: MoshGraph): MoshScopePipeline => ({
  scope: mapScopeKind(graph.scope),
  chain: graph.nodes.map(mapNodeToInstance),
})

export const buildPipelineFromGraphs = (
  record: MoshGraphRecord | undefined,
  globalBypass: boolean | undefined,
): MoshPipeline => {
  const scopes = Object.values(record ?? {}).map(graphToScopePipeline)
  return {
    globalBypass: Boolean(globalBypass),
    scopes,
  }
}
