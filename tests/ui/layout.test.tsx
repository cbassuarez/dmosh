import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import EditorPage from '../../src/pages/EditorPage'
import { MemoryRouter } from 'react-router-dom'

// basic render smoke tests

describe('Editor layout', () => {
  it('renders top-level panels', () => {
    render(
      <MemoryRouter>
        <EditorPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByText(/Project/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Viewer/i)).toBeInTheDocument()
    expect(screen.getByText(/Timeline/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Inspector/i).length).toBeGreaterThan(0)
  })
})
