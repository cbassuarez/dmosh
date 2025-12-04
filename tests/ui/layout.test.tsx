import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import EditorPage from '../../src/pages/EditorPage'
import { MemoryRouter } from 'react-router-dom'
import { ProjectProvider } from '../../src/shared/hooks/useProject'

// basic render smoke tests

describe('Editor layout', () => {
  it('renders top-level panels', () => {
    const sample = {
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
    localStorage.setItem('datamosh-current-project', JSON.stringify(sample))
    render(
      <MemoryRouter>
        <ProjectProvider>
          <EditorPage />
        </ProjectProvider>
      </MemoryRouter>,
    )

    expect(screen.getAllByText(/Project/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Viewer/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Timeline/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Inspector/i).length).toBeGreaterThan(0)
  })
})
