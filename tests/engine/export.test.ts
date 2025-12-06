import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportTimeline } from '../../src/engine/export'
import type { RenderSettings } from '../../src/engine/renderTypes'
import type { Project } from '../../src/engine/types'

const mockData = new Uint8Array([1, 2, 3, 4])

vi.mock('@ffmpeg/ffmpeg', () => {
  const fsStore: Record<string, Uint8Array> = {}

  return {
    FFmpeg: class {
      on = vi.fn()
      off = vi.fn()

      load = vi.fn(async () => true)

      exec = vi.fn(async (args: string[]) => {
        const outputName = args[args.length - 1]
        fsStore[outputName] = mockData
        return 0
      })

      readFile = vi.fn(async (name: string) => fsStore[name] ?? mockData)

      deleteFile = vi.fn(async (name: string) => {
        delete fsStore[name]
        return true
      })
    },
  }
})

describe('exportTimeline', () => {
  let project: Project
  let settings: RenderSettings

  beforeEach(() => {
    project = {
      version: '1.0.0',
      metadata: { name: 'Test', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), author: 'Tester' },
      seed: 1,
      settings: { width: 640, height: 360, fps: 24, blockSize: 8 },
      sources: [
        {
          id: 'source-1',
          originalName: 'source',
          hash: 'hash',
          audioPresent: false,
          pixelFormat: 'yuv420p',
          durationFrames: 24,
          previewUrl: '',
        },
      ],
      timeline: {
        fps: 24,
        width: 640,
        height: 360,
        tracks: [{ id: 'track-1', kind: 'video', index: 0 }],
        clips: [
          {
            id: 'clip-1',
            trackId: 'track-1',
            sourceId: 'source-1',
            startFrame: 0,
            endFrame: 24,
            timelineStartFrame: 0,
          },
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

    settings = {
      id: 'render-1',
      projectId: 'project-1',
      source: { kind: 'timeline' },
      container: 'mp4',
      videoCodec: 'h264',
      audioCodec: 'none',
      outputResolution: 'project',
      fpsMode: 'project',
      pixelFormat: 'yuv420p',
      rateControl: { mode: 'crf', value: 18 },
      keyframeInterval: 'auto',
      bFrames: 'auto',
      includeAudio: false,
      audioSampleRate: 48000,
      audioChannels: 2,
      datamosh: { mode: 'none' },
      preserveBrokenGOP: false,
      burnInTimecode: false,
      burnInClipName: false,
      burnInMasks: false,
      renderResolutionScale: 1,
      previewOnly: false,
      fileName: 'export',
      fileExtension: 'mp4',
    }
  })

  it('produces a non-empty blob from ffmpeg output', async () => {
    const result = await exportTimeline(project, settings)

    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.size).toBeGreaterThan(0)
    expect(result.mimeType).toBe('video/mp4')
  })
})
