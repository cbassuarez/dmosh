import '@testing-library/jest-dom/vitest'
import { render, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import RenderQueuePanel from '../../src/editor/RenderQueuePanel'
import { ProjectProvider, ProjectContextShape, useProject, loadExportPreferences } from '../../src/shared/hooks/useProject'

const TestPreferences = ({ onReady }: { onReady: (ctx: ProjectContextShape) => void }) => {
  const ctx = useProject()
  onReady(ctx)
  return null
}

describe('export preferences', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('falls back to disabled auto-download without window', () => {
    const globalRef = globalThis as typeof globalThis & { window?: typeof window }
    const originalWindow = globalRef.window
    // @ts-expect-error - allow simulating missing window
    globalRef.window = undefined
    expect(loadExportPreferences().autoDownloadOnComplete).toBe(false)
    globalRef.window = originalWindow
  })

  it('loads auto-download preference from storage', () => {
    window.localStorage.setItem('dmosh_export_prefs', JSON.stringify({ autoDownloadOnComplete: true }))
    expect(loadExportPreferences().autoDownloadOnComplete).toBe(true)
  })

  it('updates preference and persists to localStorage', async () => {
    window.localStorage.removeItem('dmosh_export_prefs')
    let ctx: ProjectContextShape | null = null
    const getCtx = () => {
      if (!ctx) throw new Error('Context not ready')
      return ctx
    }
    render(
      <ProjectProvider>
        <RenderQueuePanel />
        <TestPreferences onReady={(value) => (ctx = value)} />
      </ProjectProvider>,
    )

    await waitFor(() => expect(ctx).not.toBeNull())
    expect(getCtx().exportPreferences.autoDownloadOnComplete).toBe(false)

    act(() => getCtx().setExportPreferences({ autoDownloadOnComplete: true }))

    await waitFor(() => expect(getCtx().exportPreferences.autoDownloadOnComplete).toBe(true))
    expect(window.localStorage.getItem('dmosh_export_prefs')).toContain('true')
  })
})
