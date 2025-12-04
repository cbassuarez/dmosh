import { describe, expect, it } from 'vitest'
import { Project } from '../../src/engine/types'
import { validateProject } from '../../src/engine/validation'

const validProject: Project = {
  version: '0.1.0',
  metadata: {
    name: 'Valid project',
    author: 'tester',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  seed: 1,
  settings: { width: 1920, height: 1080, fps: 24, blockSize: 16 },
  sources: [
    {
      id: 'src-1',
      originalName: 'clip.mp4',
      hash: 'hash',
      audioPresent: false,
      pixelFormat: 'yuv420p',
      durationFrames: 100,
      previewUrl: 'blob://clip.mp4',
      normalizedProfile: { codec: 'h264', width: 1920, height: 1080, fps: 24, hasBFrames: true, gopSize: 12 },
    },
  ],
  timeline: {
    fps: 24,
    width: 1920,
    height: 1080,
    tracks: [{ id: 'track-1', kind: 'video', index: 0 }],
    clips: [
      { id: 'clip-1', trackId: 'track-1', sourceId: 'src-1', startFrame: 0, endFrame: 90, timelineStartFrame: 0 },
    ],
  },
  masks: [
    {
      id: 'mask-1',
      shape: 'rect',
      mode: 'inside',
      keyframes: [{ timelineFrame: 0, transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0 } }],
      interpolation: 'linear',
    },
  ],
  operations: {
    dropKeyframes: [
      { id: 'drop-1', type: 'DropKeyframes', timelineRange: { startFrame: 0, endFrame: 10 }, clipId: 'clip-1', pattern: { everyNth: 2 } },
    ],
    freezeReference: [],
    redirectFrames: [],
    holdSmear: [],
    motionVectorTransforms: [
      { id: 'mvt-1', type: 'MotionVectorTransform', timelineRange: { startFrame: 0, endFrame: 10 }, params: {} },
    ],
  },
  automationCurves: [
    {
      id: 'curve-1',
      target: { kind: 'operationParam', operationId: 'mvt-1', param: 'scale' },
      points: [{ t: 0, value: 1 }],
      interpolation: 'linear',
    },
  ],
}

describe('validation', () => {
  it('accepts a well formed project', () => {
    const result = validateProject(validProject)
    expect(result.valid).toBe(true)
  })

  it('fails unknown automation references', () => {
    const project: Project = {
      ...validProject,
      automationCurves: [
        {
          id: 'curve-missing',
          target: { kind: 'operationParam', operationId: 'missing', param: 'jitter' },
          points: [{ t: 0, value: 0.5 }],
          interpolation: 'linear',
        },
      ],
    }
    const result = validateProject(project)
    expect(result.valid).toBe(false)
  })

  it('detects invalid parameter ranges', () => {
    const project: Project = {
      ...validProject,
      automationCurves: [
        {
          id: 'curve-bad',
          target: { kind: 'operationParam', operationId: 'mvt-1', param: 'scale' },
          points: [{ t: 0, value: 10 }],
          interpolation: 'linear',
        },
      ],
    }
    const result = validateProject(project)
    expect(result.valid).toBe(false)
  })
})
