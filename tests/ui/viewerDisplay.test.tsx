import { describe, expect, it, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import EditorPage from '../../src/pages/EditorPage'
import { ProjectProvider } from '../../src/shared/hooks/useProject'
import { Project } from '../../src/engine/types'

const baseProject: Project = {
  version: '0.1.0',
  metadata: { name: 'Test Project', author: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  seed: 1,
  settings: { width: 1920, height: 1080, fps: 30, blockSize: 16 },
  sources: [],
  timeline: { fps: 30, width: 1920, height: 1080, tracks: [], clips: [] },
  masks: [],
  operations: { dropKeyframes: [], freezeReference: [], redirectFrames: [], holdSmear: [], motionVectorTransforms: [] },
  automationCurves: [],
}

describe('Viewer rendering', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows a visual preview when a clip exists under the playhead', async () => {
    const project: Project = {
      ...baseProject,
      sources: [
        {
          id: 'src-1',
          originalName: 'clip.mov',
          hash: 'hash',
          audioPresent: false,
          pixelFormat: 'unknown',
          durationFrames: 120,
          previewUrl: 'https://example.com/clip.mov',
        },
      ],
      timeline: {
        fps: 30,
        width: 1920,
        height: 1080,
        tracks: [{ id: 'track-1', kind: 'video', index: 0 }],
        clips: [{ id: 'clip-1', trackId: 'track-1', sourceId: 'src-1', startFrame: 0, endFrame: 29, timelineStartFrame: 0 }],
      },
    }

    localStorage.setItem('datamosh-current-project', JSON.stringify(project))
    render(
      <MemoryRouter>
        <ProjectProvider>
          <EditorPage />
        </ProjectProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      const preview = screen.getByTestId('viewer-preview')
      expect(preview.querySelector('video')).toBeInTheDocument()
      expect(screen.getByText(/00:00:00:00/)).toBeInTheDocument()
    })
  })

  it('shows a helpful empty state when no clips exist', () => {
    localStorage.setItem('datamosh-current-project', JSON.stringify(baseProject))
    render(
      <MemoryRouter>
        <ProjectProvider>
          <EditorPage />
        </ProjectProvider>
      </MemoryRouter>,
    )

    expect(
      screen.getByText(/No clips in project yet. Add sources and place clips on the timeline./i),
    ).toBeInTheDocument()
  })
})
