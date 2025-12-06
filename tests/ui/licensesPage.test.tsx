import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import LicensesPage from '../../src/pages/LicensesPage'
import AppFooter from '../../src/components/AppFooter'
import AboutModal from '../../src/components/AboutModal'

describe('LicensesPage', () => {
  it('renders license sections', () => {
    render(
      <MemoryRouter>
        <LicensesPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Open-source & licenses/i)).toBeInTheDocument()
    expect(screen.getByText(/Project license/i)).toBeInTheDocument()
    expect(screen.getAllByText(/FFmpeg/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Other dependencies/i)).toBeInTheDocument()
  })
})

describe('AppFooter', () => {
  it('renders links and triggers about handler', () => {
    const onOpenAbout = vi.fn()
    render(
      <MemoryRouter>
        <AppFooter onOpenAbout={onOpenAbout} />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Open-source & licenses/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText('About'))
    expect(onOpenAbout).toHaveBeenCalledTimes(1)
  })
})

describe('AboutModal', () => {
  it('shows content and closes when requested', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <AboutModal open onClose={onClose} />
      </MemoryRouter>,
    )

    expect(screen.getByText(/About dmosh/i)).toBeInTheDocument()
    expect(screen.getAllByText(/FFmpeg/i).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
