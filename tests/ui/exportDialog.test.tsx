import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ExportDialog } from '../../src/editor/ExportDialog'
import { PreviewScale, RenderSettings } from '../../src/engine/engine'
import { Project } from '../../src/engine/types'

const baseProject: Project = {
  version: '0.1',
  metadata: { name: 'Test', author: '', createdAt: '', updatedAt: '' },
  seed: 1,
  settings: { width: 640, height: 360, fps: 24, blockSize: 16 },
  sources: [],
  timeline: { fps: 24, width: 640, height: 360, tracks: [], clips: [{ id: 'c1', trackId: 't1', sourceId: 's', startFrame: 0, endFrame: 10, timelineStartFrame: 0 }] },
  masks: [],
  operations: { dropKeyframes: [], freezeReference: [], redirectFrames: [], holdSmear: [], motionVectorTransforms: [] },
  automationCurves: [],
}

type MockEngine = {
  exportVideo: ReturnType<typeof vi.fn>
}

const mockEngine: MockEngine = {
  exportVideo: vi.fn(async (settings: RenderSettings) => new Blob([JSON.stringify(settings)])),
}

vi.mock('../../src/engine/worker/workerClient', () => ({
  useVideoEngine: () => ({ engine: mockEngine, progress: { phase: 'idle', progress: 0 }, lastError: null }),
}))

describe('ExportDialog', () => {
  let onClose: () => void
  let project: Project

  beforeEach(() => {
    onClose = vi.fn()
    project = JSON.parse(JSON.stringify(baseProject))
  })

  it('constructs RenderSettings based on UI', async () => {
    render(<ExportDialog project={project} isOpen onClose={onClose} />)

    fireEvent.change(screen.getByDisplayValue('Web (H.264 / MP4)'), { target: { value: 'web-webm' } })
    fireEvent.click(screen.getByLabelText('4K'))
    fireEvent.click(screen.getByText('Start export'))

    expect(mockEngine.exportVideo).toHaveBeenCalled()
    const [settings] = mockEngine.exportVideo.mock.calls[0] as [RenderSettings]
    expect(settings.preset).toBe('web-webm')
    expect(settings.resolution).toEqual({ kind: 'explicit', width: 3840, height: 2160 })
  })

  it('respects preview scale option', () => {
    render(<ExportDialog project={project} isOpen onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Use preview scale'))
    fireEvent.change(screen.getAllByDisplayValue('Full')[0], { target: { value: 'quarter' as PreviewScale } })
    fireEvent.click(screen.getByText('Start export'))

    const [settings] = mockEngine.exportVideo.mock.calls.pop() as [RenderSettings]
    expect(settings.resolution).toEqual({ kind: 'inheritPreview', previewScale: 'quarter' })
  })
})
