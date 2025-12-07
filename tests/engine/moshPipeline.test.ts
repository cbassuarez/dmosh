import { describe, expect, it } from 'vitest'
import {
  applyMoshGraphsToRenderSettings,
  buildContextForClip,
  buildSyntheticFrames,
  collectGraphsForClip,
  compileMoshPipelineFromGraphs,
} from '../../src/engine/moshPipeline'
import type { RenderSettings } from '../../src/engine/renderTypes'
import { DEFAULT_TIMELINE_ID, moshScopeKey, type MoshGraph, type MoshScopeId } from '../../src/mosh/moshModel'
import { createEmptyProject } from '../../src/shared/hooks/useProject'

const timelineScope: MoshScopeId = { kind: 'timeline', timelineId: DEFAULT_TIMELINE_ID }

const baseRenderSettings: RenderSettings = {
  id: 'job-1',
  projectId: 'proj',
  source: { kind: 'timeline' },
  container: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  outputResolution: 'project',
  fpsMode: 'project',
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
  fileName: 'test',
  fileExtension: 'mp4',
}

const makeGraph = (nodes: MoshGraph['nodes']): MoshGraph => ({ scope: timelineScope, nodes })

describe('mosh pipeline compiler', () => {
  it('drops intra frames after the first when configured', () => {
    const frames = [
      { index: 0, frameType: 'I' as const },
      { index: 1, frameType: 'P' as const },
      { index: 2, frameType: 'I' as const },
      { index: 3, frameType: 'P' as const },
    ]

    const graph = makeGraph([
      {
        id: 'drop',
        op: 'DropIntraFrames',
        bypass: false,
        params: { firstIntraOnly: true, probability: 100 },
      },
    ])

    const pipeline = compileMoshPipelineFromGraphs([graph])
    const result = pipeline({ frames })

    expect(result.frames.map((f) => f.index)).toEqual([0, 1, 3])
  })

  it('drops predicted frame types according to targets', () => {
    const frames = [
      { index: 0, frameType: 'I' as const },
      { index: 1, frameType: 'P' as const },
      { index: 2, frameType: 'B' as const },
      { index: 3, frameType: 'P' as const },
    ]

    const graph = makeGraph([
      {
        id: 'drop-pb',
        op: 'DropPredictedFrames',
        bypass: false,
        params: { targetTypes: ['P', 'B'], probability: 100 },
      },
    ])

    const result = compileMoshPipelineFromGraphs([graph])({ frames })

    expect(result.frames.map((f) => f.frameType)).toEqual(['I'])
  })

  it('holds a chosen reference frame for the configured duration', () => {
    const frames = [
      { index: 0, frameType: 'I' as const, contentFrom: 0 },
      { index: 1, frameType: 'P' as const, contentFrom: 1 },
      { index: 2, frameType: 'B' as const, contentFrom: 2 },
      { index: 3, frameType: 'P' as const, contentFrom: 3 },
      { index: 4, frameType: 'I' as const, contentFrom: 4 },
    ]

    const graph = makeGraph([
      {
        id: 'hold',
        op: 'HoldReferenceFrame',
        bypass: false,
        params: {
          mode: 'FirstIntra',
          durationMode: 'FixedFrames',
          fixedFrames: 2,
          fixedSeconds: null,
          specificFrameIndex: null,
        },
      },
    ])

    const result = compileMoshPipelineFromGraphs([graph])({ frames, fps: 30 })

    expect(result.frames[1].contentFrom).toBe(0)
    expect(result.frames[2].contentFrom).toBe(0)
    expect(result.frames[3].contentFrom).toBe(3)
  })

  it('implements a classic datamosh macro of dropping intra frames and holding the first', () => {
    const frames = [
      { index: 0, frameType: 'I' as const },
      { index: 1, frameType: 'P' as const },
      { index: 2, frameType: 'B' as const },
      { index: 3, frameType: 'I' as const },
      { index: 4, frameType: 'P' as const },
    ]

    const graph = makeGraph([
      {
        id: 'classic',
        op: 'ClassicDatamosh',
        bypass: false,
        params: { enabled: true },
      },
    ])

    const result = compileMoshPipelineFromGraphs([graph])({ frames })

    expect(result.frames.map((f) => f.index)).toEqual([0, 1, 2, 4])
    expect(result.frames.slice(1).every((f) => f.contentFrom === 0)).toBe(true)
  })

  it('treats stub experimental ops as pass-through', () => {
    const frames = buildSyntheticFrames(3, 30)
    const graph = makeGraph([
      { id: 'stub', op: 'ClampLongMotionVectors', bypass: false, params: {} },
    ])

    const result = compileMoshPipelineFromGraphs([graph])({ frames })
    expect(result.frames).toEqual(frames)
  })
})

describe('mosh pipeline integrations', () => {
  it('applies structured graphs to render settings when not bypassed', () => {
    const project = createEmptyProject()
    const graph: MoshGraph = {
      scope: timelineScope,
      nodes: [
        { id: 'drop', op: 'DropIntraFrames', bypass: false, params: { firstIntraOnly: true, probability: 50 } },
      ],
    }
    project.moshGraphsByScopeKey = { [moshScopeKey(timelineScope)]: graph }

    const settings = applyMoshGraphsToRenderSettings(project, baseRenderSettings)
    expect(settings.datamosh).toEqual({ mode: 'timeline', operations: ['DropIntraFrames'] })
  })

  it('respects global bypass when composing render settings', () => {
    const project = createEmptyProject()
    const graph: MoshGraph = {
      scope: timelineScope,
      nodes: [
        { id: 'drop', op: 'DropIntraFrames', bypass: false, params: { firstIntraOnly: true, probability: 50 } },
      ],
    }
    project.moshGraphsByScopeKey = { [moshScopeKey(timelineScope)]: graph }
    project.moshBypassGlobal = true

    const settings = applyMoshGraphsToRenderSettings(project, baseRenderSettings)
    expect(settings).toBe(baseRenderSettings)
  })

  it('collects graphs across scopes for playback previews', () => {
    const project = createEmptyProject()
    const clip = project.timeline.clips[0] ?? {
      id: 'clip-1',
      trackId: project.timeline.tracks[0].id,
      sourceId: 'src-1',
      startFrame: 0,
      endFrame: 10,
      timelineStartFrame: 0,
    }
    const timelineGraph: MoshGraph = {
      scope: timelineScope,
      nodes: [{ id: 'drop', op: 'DropIntraFrames', bypass: false, params: { firstIntraOnly: true, probability: 100 } }],
    }
    const trackGraph: MoshGraph = {
      scope: { kind: 'track', timelineId: DEFAULT_TIMELINE_ID, trackId: clip.trackId },
      nodes: [{ id: 'classic', op: 'ClassicDatamosh', bypass: false, params: { enabled: true } }],
    }
    project.moshGraphsByScopeKey = {
      [moshScopeKey(timelineScope)]: timelineGraph,
      [moshScopeKey(trackGraph.scope)]: trackGraph,
    }

    const graphs = collectGraphsForClip(project, clip)
    expect(graphs).toHaveLength(2)

    const context = buildContextForClip(clip, project.timeline.fps)
    const frames = compileMoshPipelineFromGraphs(graphs)(context).frames
    expect(frames.length).toBeGreaterThan(0)
  })
})
