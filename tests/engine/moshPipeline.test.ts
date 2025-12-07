import { describe, expect, it } from 'vitest'
import { buildPipelineFromGraphs } from '../../src/mosh/pipelineAdapter'
import { applyMoshPipeline, type StructuralStream, type MoshPipeline } from '../../src/mosh/moshPipeline'
import { buildStructuralStream } from '../../src/mosh/structuralStream'
import { DEFAULT_TIMELINE_ID, type MoshGraph } from '../../src/mosh/moshModel'

describe('applyMoshPipeline', () => {
  const baseStream: StructuralStream = [
    { index: 0, type: 'I', refIndices: [], keyframe: true },
    { index: 1, type: 'P', refIndices: [0], keyframe: false },
    { index: 2, type: 'B', refIndices: [1], keyframe: false },
    { index: 3, type: 'I', refIndices: [], keyframe: true },
  ]

  it('returns original stream when pipeline is null', () => {
    const result = applyMoshPipeline(baseStream, null, 'timeline')
    expect(result).toEqual(baseStream)
  })

  it('returns original stream when globally bypassed', () => {
    const pipeline: MoshPipeline = { globalBypass: true, scopes: [] }
    const result = applyMoshPipeline(baseStream, pipeline, 'timeline')
    expect(result).toEqual(baseStream)
  })

  it('drops intra frames for DropIntraFrames op', () => {
    const pipeline: MoshPipeline = {
      globalBypass: false,
      scopes: [
        { scope: 'timeline', chain: [{ id: 'drop', kind: 'DropIntraFrames', enabled: true, params: {} }] },
      ],
    }

    const result = applyMoshPipeline(baseStream, pipeline, 'timeline')
    expect(result.map((f) => f.type)).toEqual(['P', 'B'])
  })

  it('drops intra frames for ClassicDatamosh op', () => {
    const pipeline: MoshPipeline = {
      globalBypass: false,
      scopes: [
        { scope: 'timeline', chain: [{ id: 'classic', kind: 'ClassicDatamosh', enabled: true, params: {} }] },
      ],
    }

    const result = applyMoshPipeline(baseStream, pipeline, 'timeline')
    expect(result.every((f) => f.type !== 'I')).toBe(true)
  })

  it('overwrites reference indices for FreezeReferenceFrame', () => {
    const pipeline: MoshPipeline = {
      globalBypass: false,
      scopes: [
        {
          scope: 'timeline',
          chain: [
            {
              id: 'freeze',
              kind: 'FreezeReferenceFrame',
              enabled: true,
              params: { referenceIndex: 0 },
            },
          ],
        },
      ],
    }

    const result = applyMoshPipeline(baseStream, pipeline, 'timeline')
    expect(result[1].refIndices).toEqual([0])
    expect(result[2].refIndices).toEqual([0])
  })

  it('treats stub ops as pass-through', () => {
    const pipeline: MoshPipeline = {
      globalBypass: false,
      scopes: [
        {
          scope: 'timeline',
          chain: [
            {
              id: 'stub',
              kind: 'QuantizerBias',
              enabled: true,
              params: {},
            },
          ],
        },
      ],
    }

    const result = applyMoshPipeline(baseStream, pipeline, 'timeline')
    expect(result).toEqual(baseStream)
  })
})

describe('pipeline adapters', () => {
  it('builds a pipeline from graph records', () => {
    const graph: MoshGraph = {
      scope: { kind: 'timeline', timelineId: DEFAULT_TIMELINE_ID },
      nodes: [
        { id: 'a', op: 'DropIntraFrames', bypass: false, params: { firstIntraOnly: false, probability: 100 } },
        { id: 'b', op: 'ClassicDatamosh', bypass: true, params: { enabled: true } },
      ],
    }

    const pipeline = buildPipelineFromGraphs({ Custom: graph }, false)
    expect(pipeline.globalBypass).toBe(false)
    expect(pipeline.scopes).toHaveLength(1)
    expect(pipeline.scopes[0].chain[0].kind).toBe('DropIntraFrames')
    expect(pipeline.scopes[0].chain[1].enabled).toBe(false)
  })

  it('produces predictable synthetic streams', () => {
    const stream = buildStructuralStream(5, 2)
    expect(stream[0].type).toBe('I')
    expect(stream[1].type).toBe('P')
    expect(stream[2].type === 'B' || stream[2].type === 'I').toBe(true)
  })
})
