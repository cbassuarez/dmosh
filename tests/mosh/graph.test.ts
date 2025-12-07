import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIMELINE_ID,
  createDefaultNode,
  createEmptyMoshGraph,
  moshScopeKey,
  type MoshScopeId,
} from '../../src/mosh/moshModel'
import { getGraphForScope, upsertGraphRecord } from '../../src/mosh/moshState'

const timelineScope: MoshScopeId = { kind: 'timeline', timelineId: DEFAULT_TIMELINE_ID }
const clipScope: MoshScopeId = {
  kind: 'clip',
  timelineId: DEFAULT_TIMELINE_ID,
  trackId: 'track-1',
  clipId: 'clip-1',
}

describe('mosh graph state helpers', () => {
  it('creates an empty graph when none exists for the scope', () => {
    const graph = getGraphForScope(undefined, timelineScope)
    expect(graph.scope).toEqual(timelineScope)
    expect(graph.nodes).toHaveLength(0)
  })

  it('upserts graphs per scope without clobbering existing entries', () => {
    const firstRecord = upsertGraphRecord({}, timelineScope, (graph) => ({ ...graph, nodes: [createDefaultNode('ClassicDatamosh')] }))
    const secondRecord = upsertGraphRecord(firstRecord, clipScope, (graph) => ({ ...graph, nodes: [createDefaultNode('DropIntraFrames')] }))

    const timelineGraph = firstRecord[moshScopeKey(timelineScope)]
    const clipGraph = secondRecord[moshScopeKey(clipScope)]

    expect(timelineGraph?.nodes[0].op).toBe('ClassicDatamosh')
    expect(clipGraph?.nodes[0].op).toBe('DropIntraFrames')
  })

  it('appends palette nodes to the end of the graph', () => {
    const baseGraph = createEmptyMoshGraph(timelineScope)
    const firstNode = createDefaultNode('DropIntraFrames')
    const secondNode = createDefaultNode('ClassicDatamosh')

    const record = upsertGraphRecord({}, timelineScope, () => ({ ...baseGraph, nodes: [firstNode] }))
    const next = upsertGraphRecord(record, timelineScope, (graph) => ({ ...graph, nodes: [...graph.nodes, secondNode] }))

    const updatedGraph = getGraphForScope(next, timelineScope)
    expect(updatedGraph.nodes.map((node) => node.op)).toEqual(['DropIntraFrames', 'ClassicDatamosh'])
  })
})
