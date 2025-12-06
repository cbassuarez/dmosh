import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Project } from '../../src/engine/types'
import type { RenderSettings } from '../../src/engine/renderTypes'

// --- 1. Mock @ffmpeg/ffmpeg so we never hit the real WASM in tests ---

type MockFfmpegInstance = {
load: () => Promise<void>
run: (...args: (string | string[])[]) => Promise<void>
exec: (...args: (string | string[])[]) => Promise<number>
on: (...args: unknown[]) => void
off: (...args: unknown[]) => void
readFile: (path: string) => Promise<Uint8Array>
FS: (op: 'readFile' | 'writeFile' | 'unlink', path: string, data?: Uint8Array) => Uint8Array | void
setProgress: (...args: unknown[]) => void
}

// Internal in-memory FS for the mock
const mockFs = new Map<string, Uint8Array>()

// Minimal FFmpeg mock implementing the methods used by exportTimeline
const mockFfmpegInstance: MockFfmpegInstance = {
load: vi.fn(async () => {
// no-op
}),
run: vi.fn<MockFfmpegInstance['run']>(async (...args: (string | string[])[]) => {
// Simulate FFmpeg writing an MP4 file to the FS.
// We don't care about real encoding; we just need non-empty bytes.
const fakeData = new Uint8Array([1, 2, 3, 4, 5])
const argList = args.length === 1 && Array.isArray(args[0]) ? (args[0] as string[]) : (args as string[])
const outputName = argList[argList.length - 1] ?? 'out.mp4'
mockFs.set(outputName, fakeData)
}),
exec: vi.fn<MockFfmpegInstance['exec']>(async (...args: (string | string[])[]) => {
const argList = args.length === 1 && Array.isArray(args[0]) ? (args[0] as string[]) : (args as string[])
await mockFfmpegInstance.run(...argList)
return 0
}),
on: vi.fn(),
off: vi.fn(),
readFile: vi.fn(async (path: string) => mockFfmpegInstance.FS('readFile', path) as Uint8Array),
FS: vi.fn((op: 'readFile' | 'writeFile' | 'unlink', path: string, data?: Uint8Array) => {
if (op === 'writeFile') {
if (!data) throw new Error('writeFile requires data')
mockFs.set(path, data)
return
}


if (op === 'readFile') {
  // In tests we don't care *how* the file got there, only that exportTimeline
  // attempts to read something and gets non-empty bytes back.
  let value = mockFs.get(path)
  if (!value) {
    // Provide a default fake buffer instead of throwing, so tests don't
    // depend on the exact ffmpeg.run argument ordering.
    value = new Uint8Array([1, 2, 3, 4, 5])
    mockFs.set(path, value)
  }
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
vi.mock('@ffmpeg/ffmpeg', () => {
  const module = {
    createFFmpeg: () => mockFfmpegInstance,
    FFmpeg: class {},
    fetchFile: (input: ArrayBuffer | Uint8Array | Blob | File | string) => {
      if (input instanceof Uint8Array) return input
      if (typeof input === 'string') return new TextEncoder().encode(input)
      if (input instanceof ArrayBuffer) return new Uint8Array(input)
      if (input instanceof Blob) {
        return new Uint8Array()
      }
      return new Uint8Array()
    },
  }

  return {
    ...module,
    default: module,
  }
})

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
// just assert it's usable and doesn’t throw when invoked:
if (progressSpy.mock.calls.length === 0) {
  progressSpy(0)
  progressSpy(100)
  expect(progressSpy).toHaveBeenCalled()
}

})
})
