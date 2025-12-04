import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { ExportDialog } from '../../src/editor/ExportDialog'
import type { RenderSettings } from '../../src/engine/renderTypes'
import type { Project } from '../../src/engine/types'
import { ProjectProvider, useProject, type RenderJob } from '../../src/shared/hooks/useProject'

const baseProject: Project = {
  version: '0.1',
  metadata: { name: 'Test', author: '', createdAt: '', updatedAt: '' },
  seed: 1,
  settings: { width: 640, height: 360, fps: 24, blockSize: 16 },
  sources: [
    {
      id: 's1',
      originalName: 'Clip One',
      hash: 'hash1',
      audioPresent: true,
      pixelFormat: 'yuv420p',
      durationFrames: 20,
      previewUrl: '',
    },
  ],
  timeline: {
    fps: 24,
    width: 640,
    height: 360,
    tracks: [{ id: 't1', kind: 'video', name: 'Video 1', index: 0 }],
    clips: [{ id: 'c1', trackId: 't1', sourceId: 's1', startFrame: 0, endFrame: 10, timelineStartFrame: 0 }],
  },
  masks: [],
  operations: { dropKeyframes: [], freezeReference: [], redirectFrames: [], holdSmear: [], motionVectorTransforms: [] },
  automationCurves: [],
}

const ProjectSetter = ({ project }: { project: Project }) => {
  const { setProject } = useProject()
  useEffect(() => {
    setProject(project)
  }, [project, setProject])
  return null
}

const QueueObserver = ({ onUpdate }: { onUpdate: (queue: RenderJob[]) => void }) => {
  const { renderQueue } = useProject()
  useEffect(() => onUpdate(renderQueue), [renderQueue, onUpdate])
  return null
}

describe('ExportDialog', () => {
  it('constructs RenderSettings based on UI', async () => {
    const queueUpdates = vi.fn()

    render(
      <ProjectProvider>
        <ProjectSetter project={baseProject} />
        <QueueObserver onUpdate={queueUpdates} />
        <ExportDialog project={baseProject} isOpen onClose={() => {}} />
      </ProjectProvider>,
    )

    fireEvent.click(screen.getByText('Region (In/Out)'))
    fireEvent.change(screen.getByLabelText('In (frame)'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Out (frame)'), { target: { value: '8' } })
    fireEvent.click(screen.getByText('H.264 1080p (YouTube)'))
    fireEvent.change(screen.getByLabelText('File name'), { target: { value: 'custom-name' } })
    fireEvent.click(screen.getByText('Add to queue'))

    const job = await waitFor(() => {
      const latestCall = queueUpdates.mock.calls[queueUpdates.mock.calls.length - 1] as [RenderJob[]] | undefined
      const latest = latestCall?.[0]
      if (!latest?.length) throw new Error('No job yet')
      return latest[0]
    })

    const settings = job.settings as RenderSettings
    if (settings.source.kind !== 'timeline') {
      throw new Error('Expected timeline export source')
    }
    expect(settings.source.inFrame).toBe(2)
    expect(settings.source.outFrame).toBe(8)
    expect(settings.outputResolution).toBe('custom')
    expect(settings.width).toBe(1920)
    expect(settings.height).toBe(1080)
    expect(settings.fileName).toBe('custom-name')
  })
})
