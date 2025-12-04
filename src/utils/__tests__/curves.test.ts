import { describe, expect, it } from 'vitest'
import { insertPoint, updatePointValue } from '../curves'

const base = [
  { time: 0, value: 0.2 },
  { time: 0.5, value: 0.8 },
]

describe('curve math helpers', () => {
  it('inserts points in order and clamps', () => {
    const next = insertPoint(base, { time: 1.4, value: -0.2 })
    expect(next[2]).toEqual({ time: 1, value: 0 })
    expect(next[1].time).toBe(0.5)
  })

  it('updates a point with clamping', () => {
    const next = updatePointValue(base, 0, { time: -0.4, value: 1.4 })
    expect(next[0]).toEqual({ time: 0, value: 1 })
  })
})
