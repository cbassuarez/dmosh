import { describe, expect, it } from 'vitest'
import { selectEffectiveOperations } from '../../src/engine/engine'
import { Project } from '../../src/engine/types'
import { assertValidProject } from '../../src/engine/validation'

const baseProject: Project = {
  version: '0.1.0',
  metadata: {
    name: 'Test project',
    author: 'tester',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  seed: 1,
  settings: { width: 1920, height: 1080, fps: 24, blockSize: 16 },
  sources: [
    {
      id: 'src',
      originalName: 'a.mp4',
      hash: 'hash',
      audioPresent: true,
      pixelFormat: 'yuv420p',
      durationFrames: 100,
      normalizedProfile: { codec: 'h264', width: 1920, height: 1080, fps: 24, hasBFrames: true, gopSize: 12 },
    },
  ],
  timeline: {
    fps: 24,
    width: 1920,
    height: 1080,
    tracks: [{ id: 'v1', kind: 'video', index: 0 }],
    clips: [
      { id: 'clip-a', trackId: 'v1', sourceId: 'src', startFrame: 0, endFrame: 50, timelineStartFrame: 0 },
      { id: 'clip-b', trackId: 'v1', sourceId: 'src', startFrame: 10, endFrame: 80, timelineStartFrame: 20 },
    ],
  },
  masks: [],
  operations: {
    dropKeyframes: [],
    freezeReference: [],
    redirectFrames: [],
    holdSmear: [],
    motionVectorTransforms: [],
  },
  automationCurves: [],
}

describe('operation precedence', () => {
  it('resolves precedence across kinds', () => {
    const operations: Project['operations'] = {
      dropKeyframes: [
        { id: 'drop-a', type: 'DropKeyframes', timelineRange: { startFrame: 0, endFrame: 10 } },
        { id: 'drop-b', type: 'DropKeyframes', timelineRange: { startFrame: 0, endFrame: 10 } },
      ],
      freezeReference: [
        { id: 'freeze-a', type: 'FreezeReference', anchorFrame: 5, targetRange: { startFrame: 5, endFrame: 15 }, clipId: 'clip-a' },
      ],
      redirectFrames: [
        {
          id: 'redirect-a',
          type: 'RedirectFrames',
          fromRange: { startFrame: 0, endFrame: 10 },
          toAnchor: { clipId: 'clip-b', anchorFrame: 2 },
        },
      ],
      holdSmear: [
        { id: 'smear-a', type: 'HoldSmear', anchorFrame: 2, range: { startFrame: 2, endFrame: 6 }, clipId: 'clip-a' },
      ],
      motionVectorTransforms: [
        { id: 'mvt-a', type: 'MotionVectorTransform', timelineRange: { startFrame: 0, endFrame: 10 }, params: {} },
      ],
    }
    const order = selectEffectiveOperations(operations).map((op) => op.id)
    expect(order[0]).toBe('drop-b')
    expect(order).toContain('freeze-a')
    expect(order[order.length - 1]).toBe('mvt-a')
  })

  it('prefers later operations of the same kind', () => {
    const operations: Project['operations'] = {
      dropKeyframes: [
        { id: 'drop-a', type: 'DropKeyframes', timelineRange: { startFrame: 0, endFrame: 10 }, clipId: 'clip-a' },
        { id: 'drop-b', type: 'DropKeyframes', timelineRange: { startFrame: 0, endFrame: 10 }, clipId: 'clip-a' },
      ],
      freezeReference: [],
      redirectFrames: [],
      holdSmear: [],
      motionVectorTransforms: [],
    }
    const order = selectEffectiveOperations(operations).map((op) => op.id)
    expect(order).toEqual(['drop-b'])
  })
})

describe('validation semantics', () => {
  it('throws on missing clip references', () => {
    const project: Project = {
      ...baseProject,
      operations: {
        ...baseProject.operations,
        freezeReference: [
          {
            id: 'freeze-invalid',
            type: 'FreezeReference',
            anchorFrame: 1,
            targetRange: { startFrame: 0, endFrame: 4 },
            clipId: 'missing-clip',
          },
        ],
      },
    }
    expect(() => assertValidProject(project)).toThrowError(/missing clip/i)
  })
})
