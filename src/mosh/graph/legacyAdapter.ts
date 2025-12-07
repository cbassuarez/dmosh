import type { RenderSettings } from '../../engine/renderTypes'
import { CLASSIC_DATAMOSH_ID } from '../ops/composites/classicDatamosh'
import type { LegacyMoshGraph } from './types'

const isClassicDatamoshGraph = (graph: LegacyMoshGraph): boolean => {
  if (graph.id === CLASSIC_DATAMOSH_ID) return true
  const dropNode = graph.nodes.find((node) => node.kind === 'DropIntraFrames')
  const holdNode = graph.nodes.find((node) => node.kind === 'HoldReferenceFrame')
  if (!dropNode || !holdNode) return false
  return graph.edges.some(
    (edge) => edge.fromNodeId === dropNode.id && edge.toNodeId === holdNode.id && edge.kind === 'frame',
  )
}

const extractClassicOperations = (graph: LegacyMoshGraph): string[] => graph.nodes.map((node) => node.kind)

/**
 * Maps a structured mosh graph onto legacy render settings flags for backward compatibility.
 */
export function applyMoshGraphToRenderSettings(
  graph: LegacyMoshGraph | null | undefined,
  settings: RenderSettings,
): RenderSettings {
  if (!graph) return settings

  if (isClassicDatamoshGraph(graph)) {
    return {
      ...settings,
      datamosh: { mode: 'timeline', operations: extractClassicOperations(graph) },
    }
  }

  return settings
}
