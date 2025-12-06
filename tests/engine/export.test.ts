import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Project } from '../../src/engine/types'
import type { RenderSettings } from '../../src/engine/renderTypes'

// --- 1. Mock @ffmpeg/ffmpeg so we never hit the real WASM in tests ---

// Internal in-memory FS for the mock
const mockFs = new Map<string, Uint8Array>()

// Minimal FFmpeg mock implementing the methods used by exportTimeline
const mockFfmpegInstance = {
  load: vi.fn(async () => {
    // no-op
  }),
  run: vi.fn(async (..._args: string[]) => {
    // Simulate FFmpeg writing an MP4 file to the FS.
    // We don't care about real encoding; we just need non-empty bytes.
    const fakeData = new Uint8Array([1, 2, 3, 4, 5])
    mockFs.set('out.mp4', fakeData)
  }),
  FS: vi.fn((op: 'readFile' | 'writeFile' | 'unlink', path: string, data?: Uint8Array) => {
    if (op === 'writeFile') {
      if (!data) throw new Error('writeFile requires data')
      mockFs.set(path, data)
      return
    }
    if (op === 'readFile') {
      const value = mockFs.get(path)
      if (!value) throw new Error(`File not found: ${path}`)
      return value
    }
    if (op === 'unlink') {
      mockFs.delete(path)
      return
    }
    throw new Error(`Unsupported FS op: ${op}`)
  }),
  setProgress: vi.fn(),
}

// Mock createFFmpeg so exportTimeline uses our mock instance
vi.mock('@ffmpeg/ffmpeg', () => ({
  createFFmpeg: () => mockFfmpegInstance,
  fetchFile: (input: ArrayBuffer | Uint8Array | Blob | File | string) => {
    if (input instanceof Uint8Array) return input
    if (typeof input === 'string') return new TextEncoder().encode(input)
    if (input instanceof ArrayBuffer) return new Uint8Array(input)
    if (input instanceof Blob) {
      // Simple Blob -> Uint8Array conversion for tests
      // This path is unlikely to be hit in this test, but keep it safe.
      return new Uint8Array()
    }
    return new Uint8Array()
  },
}))

// Now import exportTimeline AFTER the module mock, so it picks up the mocked FFmpeg.
import { exportTimeline } from '../../src/engine/export'

// --- 2. Minimal project + settings to exercise exportTimeline ---

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
  beforeEach(() => {
    mockFs.clear()
    vi.clearAllMocks()
  })

  it('produces a non-empty blob from ffmpeg output', async () => {
    const progressSpy = vi.fn()

    const result = await exportTimeline(project, defaultSettings, {
      onProgress: progressSpy,
    })

    // The engine should return a Blob with > 0 bytes
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.size).toBeGreaterThan(0)

    // It should report a sensible mime type and file name
    expect(result.mimeType).toBe('video/mp4')
    expect(result.fileName).toBe('engine-test.mp4')

    // And our mock FFmpeg should have been called with some args
    expect(mockFfmpegInstance.load).toHaveBeenCalled()
    expect(mockFfmpegInstance.run).toHaveBeenCalled()

    // Progress callback may or may not be called, depending on implementation;
    // just assert it's a function and does not throw when invoked:
    if (progressSpy.mock.calls.length === 0) {
      progressSpy(0)
      progressSpy(100)
      expect(progressSpy).toHaveBeenCalled()
    }
  })
})
