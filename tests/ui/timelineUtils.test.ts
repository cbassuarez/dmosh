import { describe, expect, it } from 'vitest'
import { framesToPx, generateFramePattern, hasOverlapOnTrack, reorderTracks } from '../../src/editor/timelineUtils'
import { TimelineClip, TimelineTrack } from '../../src/engine/types'

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

  it('detects overlaps on the same track only', () => {
    const clips: TimelineClip[] = [
      { id: 'a', trackId: 't1', sourceId: 's', startFrame: 0, endFrame: 10, timelineStartFrame: 0 },
      { id: 'b', trackId: 't1', sourceId: 's', startFrame: 0, endFrame: 5, timelineStartFrame: 20 },
    ]
    expect(
      hasOverlapOnTrack(clips, 't1', { startFrame: 0, endFrame: 5, timelineStartFrame: 8, clipId: 'candidate' }),
    ).toBe(true)
    expect(
      hasOverlapOnTrack(clips, 't1', { startFrame: 0, endFrame: 5, timelineStartFrame: 12, clipId: 'candidate' }),
    ).toBe(false)
    expect(
      hasOverlapOnTrack(clips, 't2', { startFrame: 0, endFrame: 5, timelineStartFrame: 8, clipId: 'candidate' }),
    ).toBe(false)
  })

  it('reorders tracks and reindexes', () => {
    const tracks: TimelineTrack[] = [
      { id: 't1', kind: 'video', index: 0 },
      { id: 't2', kind: 'video', index: 1 },
    ]
    const reordered = reorderTracks(tracks, 't2', 't1')
    expect(reordered[0].id).toBe('t2')
    expect(reordered[0].index).toBe(0)
    expect(reordered[1].id).toBe('t1')
  })
})

