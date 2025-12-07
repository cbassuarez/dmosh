import { describe, expect, it } from 'vitest'
import { CLASSIC_DATAMOSH_ID, createClassicDatamoshGraph } from '../../src/mosh/ops/composites/classicDatamosh'
import { applyMoshGraphToRenderSettings } from '../../src/mosh/graph/legacyAdapter'
import type { RenderSettings } from '../../src/engine/renderTypes'
import type { Project } from '../../src/engine/types'
import { createEmptyProject } from '../../src/shared/hooks/useProject'

const createRenderSettings = (): RenderSettings => ({
  id: 'render-1',
  projectId: 'project-1',
  source: { kind: 'timeline' },
  container: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  outputResolution: 'project',
  width: 1920,
  height: 1080,
  fpsMode: 'project',
  fps: 30,
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
  fileName: 'output',
  fileExtension: 'mp4',
})

describe('createClassicDatamoshGraph', () => {
  it('emits expected nodes and edges', () => {
    const graph = createClassicDatamoshGraph()
    expect(graph.id).toBe(CLASSIC_DATAMOSH_ID)
    expect(graph.nodes).toHaveLength(2)
    const drop = graph.nodes.find((node) => node.id === 'drop-intra')
    const hold = graph.nodes.find((node) => node.id === 'hold-ref')
    expect(drop?.kind).toBe('DropIntraFrames')
    expect(drop?.scope).toBe('timeline')
    expect(hold?.kind).toBe('HoldReferenceFrame')
    expect(graph.edges[0]).toMatchObject({ fromNodeId: 'drop-intra', toNodeId: 'hold-ref', kind: 'frame' })
  })
})

describe('applyMoshGraphToRenderSettings', () => {
  it('returns original settings when no graph is provided', () => {
    const settings = createRenderSettings()
    const result = applyMoshGraphToRenderSettings(null, settings)
    expect(result).toBe(settings)
    expect(settings.datamosh.mode).toBe('none')
  })

  it('maps classic datamosh graph to timeline datamosh settings', () => {
    const settings = createRenderSettings()
    const graph = createClassicDatamoshGraph()

    const result = applyMoshGraphToRenderSettings(graph, settings)

    expect(result).not.toBe(settings)
    expect(result.datamosh).toEqual({ mode: 'timeline', operations: ['DropIntraFrames', 'HoldReferenceFrame'] })
    expect(settings.datamosh.mode).toBe('none')
  })
})

describe('project mosh graph persistence', () => {
  it('defaults new projects to a null mosh graph', () => {
    const project = createEmptyProject()
    expect(project.moshGraph).toBeNull()
  })

  it('preserves moshGraph through serialization', () => {
    const project: Project = { ...createEmptyProject(), moshGraph: createClassicDatamoshGraph() }
    const roundTrip = JSON.parse(JSON.stringify(project)) as Project
    expect(roundTrip.moshGraph?.id).toBe(CLASSIC_DATAMOSH_ID)
  })
})
