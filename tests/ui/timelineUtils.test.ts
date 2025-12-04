import { describe, expect, it } from 'vitest'
import {
  deleteTrackAndClips,
  framesToPx,
  generateFramePattern,
  getActiveClipAtFrame,
  hasOverlapOnTrack,
  reorderTracks,
} from '../../src/editor/timelineUtils'
import { Project, TimelineClip, TimelineTrack } from '../../src/engine/types'

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

  it('resolves active clip at a frame preferring higher tracks', () => {
    const project: Project = {
      version: '0.1',
      metadata: { name: 'test', author: '', createdAt: '', updatedAt: '' },
      seed: 1,
      settings: { width: 1920, height: 1080, fps: 24, blockSize: 16 },
      sources: [],
      timeline: {
        fps: 24,
        width: 1920,
        height: 1080,
        tracks: [
          { id: 't1', kind: 'video', index: 0 },
          { id: 't2', kind: 'video', index: 1 },
        ],
        clips: [
          { id: 'a', trackId: 't1', sourceId: 's', startFrame: 0, endFrame: 9, timelineStartFrame: 0 },
          { id: 'b', trackId: 't2', sourceId: 's', startFrame: 0, endFrame: 9, timelineStartFrame: 5 },
        ],
      },
      masks: [],
      operations: { dropKeyframes: [], freezeReference: [], redirectFrames: [], holdSmear: [], motionVectorTransforms: [] },
      automationCurves: [],
    }

    expect(getActiveClipAtFrame(project, 2)?.id).toBe('a')
    expect(getActiveClipAtFrame(project, 6)?.id).toBe('b')
    expect(getActiveClipAtFrame(project, 20)).toBeNull()
  })

  it('deletes tracks and associated clips while reindexing', () => {
    const project: Project = {
      version: '0.1',
      metadata: { name: 'test', author: '', createdAt: '', updatedAt: '' },
      seed: 1,
      settings: { width: 1920, height: 1080, fps: 24, blockSize: 16 },
      sources: [],
      timeline: {
        fps: 24,
        width: 1920,
        height: 1080,
        tracks: [
          { id: 't1', kind: 'video', index: 0 },
          { id: 't2', kind: 'video', index: 1 },
          { id: 't3', kind: 'video', index: 2 },
        ],
        clips: [
          { id: 'a', trackId: 't1', sourceId: 's', startFrame: 0, endFrame: 9, timelineStartFrame: 0 },
          { id: 'b', trackId: 't2', sourceId: 's', startFrame: 0, endFrame: 9, timelineStartFrame: 0 },
          { id: 'c', trackId: 't3', sourceId: 's', startFrame: 0, endFrame: 9, timelineStartFrame: 0 },
        ],
      },
      masks: [],
      operations: { dropKeyframes: [], freezeReference: [], redirectFrames: [], holdSmear: [], motionVectorTransforms: [] },
      automationCurves: [],
    }

    const result = deleteTrackAndClips(project, 't2')
    expect(result.timeline.tracks.map((t) => t.id)).toEqual(['t1', 't3'])
    expect(result.timeline.tracks.map((t) => t.index)).toEqual([0, 1])
    expect(result.timeline.clips.some((clip) => clip.trackId === 't2')).toBe(false)
    expect(result.timeline.clips.every((clip) => result.timeline.tracks.some((track) => track.id === clip.trackId))).toBe(true)
  })
})

