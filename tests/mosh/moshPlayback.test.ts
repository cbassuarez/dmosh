import { describe, expect, it } from 'vitest'
import { getMoshFrameIndexMapping } from '../../src/editor/moshPlayback'
import type { MoshNode } from '../../src/mosh/moshModel'

const makeNode = (): MoshNode => ({
  id: 'node-1',
  op: 'ClassicDatamosh',
  bypass: false,
  params: { enabled: true },
})

describe('getMoshFrameIndexMapping', () => {
  it('returns identity mapping when mosh is disabled', () => {
    const mapping = getMoshFrameIndexMapping(5, false, [makeNode()])
    expect(mapping).toEqual([0, 1, 2, 3, 4])
  })

  it('returns identity mapping when no nodes are present', () => {
    const mapping = getMoshFrameIndexMapping(4, true, [])
    expect(mapping).toEqual([0, 1, 2, 3])
  })

  it('drops odd frames when mosh is enabled and nodes exist', () => {
    const mapping = getMoshFrameIndexMapping(6, true, [makeNode()])
    expect(mapping).toEqual([0, 2, 4])
  })
})
