import type { MoshEdge, MoshGraph, MoshNode } from '../../graph/types'

export const CLASSIC_DATAMOSH_ID = 'ClassicDatamosh' as const

/**
 * Canonical "classic datamosh" macro: drop all intra frames after the first
 * and hold the initial reference frame for subsequent predicted frames.
 */
export function createClassicDatamoshGraph(): MoshGraph {
  const nodes: MoshNode[] = [
    {
      id: 'drop-intra',
      kind: 'DropIntraFrames',
      scope: 'timeline',
      label: 'Drop intra frames (except first)',
      params: [
        {
          id: 'dropAllIntraExceptFirst',
          label: 'Drop all intra after first',
          value: true,
        },
      ],
      ui: { x: 100, y: 100 },
    },
    {
      id: 'hold-ref',
      kind: 'HoldReferenceFrame',
      scope: 'timeline',
      label: 'Hold initial reference frame',
      params: [
        {
          id: 'referenceSelectionMode',
          label: 'Reference selection mode',
          value: 'firstIntra',
        },
        {
          id: 'maxHoldSeconds',
          label: 'Max hold duration (s)',
          value: 9999,
        },
      ],
      ui: { x: 350, y: 100 },
    },
  ]

  const edges: MoshEdge[] = [
    {
      id: 'drop-to-hold',
      fromNodeId: 'drop-intra',
      toNodeId: 'hold-ref',
      kind: 'frame',
    },
  ]

  return {
    id: CLASSIC_DATAMOSH_ID,
    nodes,
    edges,
    paramLinks: [],
  }
}
