import { describe, expect, it, vi } from 'vitest'
import { applyMoshNodes, buildStructuralStream } from '../moshEngine'
import type { MoshNode } from '../moshModel'

describe('moshEngine structural helpers', () => {
  it('builds a synthetic structural stream', () => {
    const stream = buildStructuralStream(5)
    expect(stream).toHaveLength(5)
    expect(stream[0]).toEqual({ index: 0, type: 'I' })
    expect(stream[1].type).toBe('P')
    expect(stream[2].type).toBe('B')
  })

  it('passes through when no nodes are provided', () => {
    const stream = buildStructuralStream(3)
    const result = applyMoshNodes(stream, [])
    expect(result).toBe(stream)
  })

  it('drops intra frames for DropIntraFrames', () => {
    const stream = buildStructuralStream(6)
    const node: MoshNode = {
      id: 'drop-i',
      op: 'DropIntraFrames',
      bypass: false,
      params: { firstIntraOnly: false, probability: 100 },
    }
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = applyMoshNodes(stream, [node])
    expect(result.every((frame) => frame.type !== 'I')).toBe(true)
    vi.restoreAllMocks()
  })

  it('drops predicted frames for DropPredictedFrames', () => {
    const stream = buildStructuralStream(5)
    const node: MoshNode = {
      id: 'drop-pred',
      op: 'DropPredictedFrames',
      bypass: false,
      params: { targetTypes: ['P', 'B'], probability: 100 },
    }
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = applyMoshNodes(stream, [node])
    expect(result.map((f) => f.type)).toEqual(['I'])
    vi.restoreAllMocks()
  })

  it('treats ClassicDatamosh like DropIntraFrames for now', () => {
    const stream = buildStructuralStream(4)
    const node: MoshNode = { id: 'classic', op: 'ClassicDatamosh', bypass: false, params: { enabled: true } }
    const result = applyMoshNodes(stream, [node])
    expect(result.every((frame) => frame.type !== 'I')).toBe(true)
  })
})
