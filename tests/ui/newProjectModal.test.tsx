import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { PropsWithChildren } from 'react'
import { describe, expect, it } from 'vitest'
import EditorPage from '../../src/pages/EditorPage'
import { ProjectProvider, useProject } from '../../src/shared/hooks/useProject'

const Harness = ({ children }: PropsWithChildren) => {
  const ctx = useProject()
  return (
    <div>
      {children}
      <div data-testid="project-name">{ctx.project?.metadata.name ?? ''}</div>
    </div>
  )
}

const renderEditor = () =>
  render(
    <ProjectProvider>
      <Harness>
        <EditorPage />
      </Harness>
    </ProjectProvider>,
  )

describe('NewProjectModal onboarding flow', () => {
  it('opens when no project exists and creates one through the wizard', async () => {
    renderEditor()

    expect(screen.getByText(/Guided setup/i)).toBeInTheDocument()
    expect(screen.getByText(/Project details/i)).toBeInTheDocument()

    const nextDetails = screen.getByRole('button', { name: /Next: Add Media/i })
    fireEvent.click(nextDetails)

    const nextTimeline = await screen.findByRole('button', { name: /Next: Timeline/i })
    fireEvent.click(nextTimeline)

    const createButton = await screen.findByRole('button', { name: /Create Project/i })
    fireEvent.click(createButton)

    await waitFor(() => expect(screen.getByTestId('project-name').textContent).not.toEqual(''))
  })
})

