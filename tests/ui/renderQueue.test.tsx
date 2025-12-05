import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useEffect } from 'react'
import RenderQueuePanel from '../../src/editor/RenderQueuePanel'
import type { RenderSettings } from '../../src/engine/renderTypes'
import type { Project } from '../../src/engine/types'
import { ProjectProvider, useProject } from '../../src/shared/hooks/useProject'

const downloadJobResultMock = vi.fn()

vi.mock('../../src/editor/downloadHelpers', async () => {
  const actual = await vi.importActual<typeof import('../../src/editor/downloadHelpers')>(
    '../../src/editor/downloadHelpers',
  )
  return {
    ...actual,
    downloadJobResult: (...args: unknown[]) => downloadJobResultMock(...args),
  }
})

const project: Project = {
  version: '0.1',
  metadata: { name: 'Render Test', author: '', createdAt: '', updatedAt: '' },
  seed: 2,
  settings: { width: 1280, height: 720, fps: 30, blockSize: 16 },
  sources: [],
  timeline: { fps: 30, width: 1280, height: 720, tracks: [{ id: 't1', kind: 'video', name: 'Video 1', index: 0 }], clips: [] },
  masks: [],
  operations: { dropKeyframes: [], freezeReference: [], redirectFrames: [], holdSmear: [], motionVectorTransforms: [] },
  automationCurves: [],
}

const defaultSettings: RenderSettings = {
  id: 'job-1',
  projectId: project.metadata.name,
  source: { kind: 'timeline' },
  container: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  outputResolution: 'project',
  width: project.settings.width,
  height: project.settings.height,
  fpsMode: 'project',
  fps: project.settings.fps,
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
  fileName: 'queued-test',
  fileExtension: 'mp4',
}

const SeedJob = () => {
  const { setProject, addRenderJob } = useProject()
  useEffect(() => {
    setProject(project)
    addRenderJob({ id: 'job-1', projectId: project.metadata.name, settings: defaultSettings })
  }, [addRenderJob, setProject])
  return null
}

describe('RenderQueuePanel', () => {
  it('renders queued jobs and progresses to completion', async () => {
    render(
      <ProjectProvider>
        <SeedJob />
        <RenderQueuePanel />
      </ProjectProvider>,
    )

    expect(await screen.findByText('queued-test')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Start'))

    await waitFor(() => {
      expect(screen.getByText(/completed/i)).toBeInTheDocument()
    })

    const downloadButton = await screen.findByText('Download')
    fireEvent.click(downloadButton)
    expect(downloadJobResultMock).toHaveBeenCalled()
  })
})
