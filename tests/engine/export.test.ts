import { describe, expect, it, vi } from 'vitest'
import { exportTimeline } from '../../src/engine/export'
import type { Project } from '../../src/engine/types'
import type { RenderSettings } from '../../src/engine/renderTypes'

const project: Project = {
  version: '0.1',
  metadata: { name: 'Export Test', author: '', createdAt: '', updatedAt: '' },
  seed: 1,
  settings: { width: 640, height: 360, fps: 24, blockSize: 16 },
  sources: [],
  timeline: {
    fps: 24,
    width: 640,
    height: 360,
    tracks: [{ id: 't1', kind: 'video', name: 'Video', index: 0 }],
    clips: [],
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

const defaultSettings: RenderSettings = {
  id: 'job-engine-1',
  projectId: project.metadata.name,
  source: { kind: 'timeline' },
  container: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'none',
  outputResolution: 'project',
  width: project.settings.width,
  height: project.settings.height,
  fpsMode: 'project',
  fps: project.settings.fps,
  pixelFormat: 'yuv420p',
  rateControl: { mode: 'crf', value: 20 },
  keyframeInterval: 'auto',
  bFrames: 'auto',
  includeAudio: false,
  audioSampleRate: 48000,
  audioChannels: 2,
  datamosh: { mode: 'none' },
  preserveBrokenGOP: true,
  burnInTimecode: false,
  burnInClipName: false,
  burnInMasks: false,
  renderResolutionScale: 1,
  previewOnly: false,
  fileName: 'engine-test',
  fileExtension: 'mp4',
}

describe('exportTimeline', () => {
  it('returns a deterministic stubbed blob and progress updates', async () => {
    const progressSpy = vi.fn()

    const result = await exportTimeline(project, defaultSettings, {
      onProgress: progressSpy,
    })

    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.size).toBeGreaterThan(0)
    expect(result.mimeType).toBe('video/mp4')
    expect(result.fileName).toBe('engine-test.mp4')

    expect(progressSpy).toHaveBeenCalled()
    progressSpy.mock.calls.forEach(([value]) => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    })
  })

  it('respects custom container and filename', async () => {
    const customSettings: RenderSettings = {
      ...defaultSettings,
      container: 'mov',
      fileName: 'custom-name',
      fileExtension: 'mov',
    }

    const result = await exportTimeline(project, customSettings)

    expect(result.mimeType).toBe('video/quicktime')
    expect(result.fileName).toBe('custom-name.mov')
  })
})
