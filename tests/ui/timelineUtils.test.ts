import { describe, expect, it } from 'vitest'
import { framesToPx, generateFramePattern } from '../../src/editor/Timeline'

describe('timeline helpers', () => {
  it('creates a deterministic frame pattern', () => {
    const pattern = generateFramePattern(10)
    expect(pattern[0]).toBe('I')
    expect(pattern[1]).toBe('B')
    expect(pattern[3]).toBe('P')
  })

  it('converts frames to pixels with minimum width', () => {
    expect(framesToPx(0, 1)).toBe(2)
    expect(framesToPx(10, 1)).toBe(10)
    expect(framesToPx(10, 0.1)).toBe(2)
  })
})

