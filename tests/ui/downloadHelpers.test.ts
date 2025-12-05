import { describe, expect, it, vi } from 'vitest'
import { canDownloadJob, downloadJobResult } from '../../src/editor/downloadHelpers'
import type { RenderJob } from '../../src/shared/hooks/useProject'
import type { RenderSettings } from '../../src/engine/renderTypes'

const renderSettings: RenderSettings = {
  id: 'job-1',
  projectId: 'proj',
  source: { kind: 'timeline' },
  container: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  outputResolution: 'project',
  fpsMode: 'project',
  pixelFormat: 'yuv420p',
  rateControl: { mode: 'crf', value: 20 },
  keyframeInterval: 'auto',
  bFrames: 'auto',
  includeAudio: true,
  audioSampleRate: 48000,
  audioChannels: 2,
  datamosh: { mode: 'none' },
  preserveBrokenGOP: true,
  burnInTimecode: false,
  burnInClipName: false,
  burnInMasks: false,
  renderResolutionScale: 1,
  previewOnly: false,
  fileName: 'test',
  fileExtension: 'mp4',
}

const createJob = (overrides: Partial<RenderJob> = {}): RenderJob => ({
  id: 'job-1',
  projectId: 'proj',
  settings: renderSettings,
  createdAt: new Date().toISOString(),
  status: 'completed',
  progress: 100,
  ...overrides,
})

describe('download helpers', () => {
  it('checks when a job can be downloaded', () => {
    const jobWithoutBlob = createJob({ result: { mimeType: 'video/mp4', fileName: 'file.mp4', size: 0 } })
    expect(canDownloadJob(jobWithoutBlob)).toBe(false)

    const jobWithBlob = createJob({
      result: { mimeType: 'video/mp4', fileName: 'file.mp4', size: 10, blob: new Blob(['data']) },
    })
    expect(canDownloadJob(jobWithBlob)).toBe(true)
  })

  it('exits early when window or document are missing', () => {
    const globalRef = globalThis as typeof globalThis & { window?: typeof window; document?: Document }
    const originalWindow = globalRef.window
    const originalDocument = globalRef.document

    // @ts-expect-error - allow simulating missing globals
    globalRef.window = undefined
    // @ts-expect-error - allow simulating missing globals
    globalRef.document = undefined

    const job = createJob({
      result: { mimeType: 'video/mp4', fileName: 'file.mp4', size: 10, blob: new Blob(['data']) },
    })

    expect(() => downloadJobResult(job)).not.toThrow()

    globalRef.window = originalWindow
    globalRef.document = originalDocument
  })

  it('creates and revokes an object URL when downloading', () => {
    vi.useFakeTimers()
    const blob = new Blob(['data'])
    const job = createJob({
      result: { mimeType: 'video/mp4', fileName: 'file.mp4', size: blob.size, blob },
    })

    const clickSpy = vi.fn()
    const anchor = document.createElement('a')
    anchor.click = clickSpy

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download-url')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor as HTMLAnchorElement)
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')

    downloadJobResult(job)

    expect(createObjectURLSpy).toHaveBeenCalledWith(blob)
    expect(appendSpy).toHaveBeenCalledWith(anchor)
    expect(clickSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalledWith(anchor)

    vi.runAllTimers()
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:download-url')

    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
    createElementSpy.mockRestore()
    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
