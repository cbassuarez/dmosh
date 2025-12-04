import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { act } from 'react'
import { ProjectProvider, ProjectContextShape, useProject } from '../../src/shared/hooks/useProject'

const TestHarness = ({ onReady }: { onReady: (ctx: ProjectContextShape) => void }) => {
  const ctx = useProject()
  onReady(ctx)
  return null
}

const renderWithProvider = (onReady: (ctx: ProjectContextShape) => void) =>
  render(
    <ProjectProvider>
      <TestHarness onReady={onReady} />
    </ProjectProvider>,
  )

describe('project lifecycle', () => {
  it('creates a new project with defaults', async () => {
    let ctx: ProjectContextShape | null = null
    renderWithProvider((value) => {
      ctx = value
    })

    const getCtx = () => {
      if (!ctx) throw new Error('Context not ready')
      return ctx
    }

    await waitFor(() => expect(ctx).not.toBeNull())
    act(() => getCtx().newProject())
    await waitFor(() => expect(getCtx().project).not.toBeNull())
    expect(getCtx().project?.settings.fps).toBe(30)
    expect(getCtx().project?.timeline.clips).toHaveLength(0)
  })

  it('places a clip on the default track', async () => {
    let ctx: ProjectContextShape | null = null
    renderWithProvider((value) => {
      ctx = value
    })

    const getCtx = () => {
      if (!ctx) throw new Error('Context not ready')
      return ctx
    }

    await waitFor(() => expect(ctx).not.toBeNull())
    act(() => getCtx().newProject())
    await waitFor(() => expect(getCtx().project).not.toBeNull())
    act(() =>
      getCtx().setProject({
        ...getCtx().project!,
        sources: [
          {
            id: 'src-1',
            originalName: 'clip.mov',
            hash: 'hash',
            audioPresent: false,
            pixelFormat: 'unknown',
            durationFrames: 120,
          },
        ],
      }),
    )
    act(() => getCtx().placeClipFromSource('src-1', 10))
    await waitFor(() => expect(getCtx().project?.timeline.tracks.length).toBeGreaterThan(0))
    expect(getCtx().project?.timeline.clips[0].timelineStartFrame).toBe(10)
  })

  it('removes a track along with its clips and reindexes remaining tracks', async () => {
    let ctx: ProjectContextShape | null = null
    renderWithProvider((value) => {
      ctx = value
    })

    const getCtx = () => {
      if (!ctx) throw new Error('Context not ready')
      return ctx
    }

    await waitFor(() => expect(ctx).not.toBeNull())
    act(() => getCtx().newProject())
    await waitFor(() => expect(getCtx().project).not.toBeNull())
    act(() =>
      getCtx().setProject({
        ...getCtx().project!,
        timeline: {
          ...getCtx().project!.timeline,
          tracks: [
            { id: 't1', kind: 'video', index: 0, name: 'Video 1' },
            { id: 't2', kind: 'video', index: 1, name: 'Video 2' },
          ],
          clips: [
            { id: 'c1', trackId: 't2', sourceId: 'src-1', startFrame: 0, endFrame: 10, timelineStartFrame: 0 },
          ],
        },
        sources: [
          { id: 'src-1', originalName: 'clip.mov', hash: 'hash', audioPresent: false, pixelFormat: 'unknown', durationFrames: 12 },
        ],
      }),
    )

    act(() => getCtx().removeTrack('t2'))

    await waitFor(() => expect(getCtx().project?.timeline.tracks.length).toBe(1))
    expect(getCtx().project?.timeline.tracks[0].id).toBe('t1')
    expect(getCtx().project?.timeline.clips.length).toBe(0)
  })
})

