import { useMemo, useState } from 'react'
import { Project } from '../../engine/types'

const createDefaultProject = (): Project => ({
  version: '0.1.0',
  metadata: {
    name: 'Untitled Datamosh',
    author: 'anonymous',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  seed: 42,
  settings: {
    width: 1920,
    height: 1080,
    fps: 24,
    blockSize: 16,
  },
  sources: [
    {
      id: 'src-a',
      originalName: 'source-a.mp4',
      hash: 'hash-a',
      audioPresent: true,
      pixelFormat: 'yuv420p',
      normalizedProfile: {
        codec: 'h264',
        width: 1920,
        height: 1080,
        fps: 24,
        hasBFrames: true,
        gopSize: 12,
      },
      durationFrames: 240,
    },
  ],
  timeline: {
    fps: 24,
    width: 1920,
    height: 1080,
    tracks: [
      { id: 'track-1', kind: 'video', index: 0, name: 'V1' },
      { id: 'track-2', kind: 'video', index: 1, name: 'V2' },
    ],
    clips: [
      {
        id: 'clip-1',
        trackId: 'track-1',
        sourceId: 'src-a',
        startFrame: 0,
        endFrame: 120,
        timelineStartFrame: 0,
      },
      {
        id: 'clip-2',
        trackId: 'track-2',
        sourceId: 'src-a',
        startFrame: 60,
        endFrame: 180,
        timelineStartFrame: 30,
      },
    ],
  },
  masks: [
    {
      id: 'mask-1',
      name: 'Ellipse focus',
      shape: 'ellipse',
      mode: 'inside',
      keyframes: [
        { timelineFrame: 0, transform: { x: 600, y: 320, width: 400, height: 240, rotation: 0 } },
        { timelineFrame: 90, transform: { x: 700, y: 340, width: 380, height: 220, rotation: 12 } },
      ],
      interpolation: 'linear',
    },
  ],
  operations: {
    dropKeyframes: [
      {
        id: 'drop-1',
        type: 'DropKeyframes',
        timelineRange: { startFrame: 0, endFrame: 90 },
        clipId: 'clip-1',
        pattern: { everyNth: 2 },
      },
    ],
    freezeReference: [
      {
        id: 'freeze-1',
        type: 'FreezeReference',
        anchorFrame: 30,
        targetRange: { startFrame: 30, endFrame: 80 },
        clipId: 'clip-1',
      },
    ],
    redirectFrames: [
      {
        id: 'redirect-1',
        type: 'RedirectFrames',
        fromRange: { startFrame: 60, endFrame: 100 },
        toAnchor: { clipId: 'clip-2', anchorFrame: 70 },
      },
    ],
    holdSmear: [
      {
        id: 'smear-1',
        type: 'HoldSmear',
        anchorFrame: 72,
        range: { startFrame: 72, endFrame: 100 },
        clipId: 'clip-1',
        maskId: 'mask-1',
      },
    ],
    motionVectorTransforms: [
      {
        id: 'mvt-1',
        type: 'MotionVectorTransform',
        timelineRange: { startFrame: 0, endFrame: 180 },
        params: {
          scaleCurveId: 'curve-scale',
          jitterCurveId: 'curve-jitter',
        },
      },
    ],
  },
  automationCurves: [
    {
      id: 'curve-scale',
      name: 'Scale punch',
      target: { kind: 'operationParam', operationId: 'mvt-1', param: 'scale' },
      points: [
        { t: 0, value: 1 },
        { t: 90, value: 3.5 },
        { t: 180, value: 2 },
      ],
      interpolation: 'smooth',
    },
    {
      id: 'curve-jitter',
      target: { kind: 'operationParam', operationId: 'mvt-1', param: 'jitter' },
      points: [
        { t: 0, value: 0.1 },
        { t: 90, value: 0.6 },
      ],
      interpolation: 'linear',
    },
  ],
})

export const useProject = () => {
  const [project, setProject] = useState<Project>(() => createDefaultProject())
  const updateProject = useMemo(() => setProject, [])
  return { project, setProject: updateProject }
}
