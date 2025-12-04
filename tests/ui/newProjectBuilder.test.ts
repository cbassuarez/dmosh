import { describe, expect, it } from 'vitest'
import { buildProjectFromWizard } from '../../src/editor/new-project/newProjectBuilder'

const baseDetails = {
  name: 'Test Project',
  author: 'Tester',
  description: 'Demo',
  seed: 1234,
}

const baseSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  blockSize: 16,
  autoCreateTrack: true,
}

describe('buildProjectFromWizard', () => {
  it('creates tracks and clips sequentially when media is present', () => {
    const project = buildProjectFromWizard({
      details: baseDetails,
      media: [
        {
          id: 'src-1',
          fileName: 'clip-a.mov',
          hash: 'hash-a',
          durationFrames: 60,
          pixelFormat: 'unknown',
          hasAudio: false,
          profile: { width: 1920, height: 1080, fps: 30, codec: 'h264', hasBFrames: false, gopSize: null },
        },
        {
          id: 'src-2',
          fileName: 'clip-b.mov',
          hash: 'hash-b',
          durationFrames: 120,
          pixelFormat: 'unknown',
          hasAudio: false,
          profile: { width: 1280, height: 720, fps: 24, codec: 'h264', hasBFrames: false, gopSize: null },
        },
      ],
      settings: baseSettings,
    })

    expect(project.timeline.tracks).toHaveLength(1)
    expect(project.timeline.clips).toHaveLength(2)
    expect(project.timeline.clips[0].timelineStartFrame).toBe(0)
    expect(project.timeline.clips[1].timelineStartFrame).toBe(60)
    expect(project.timeline.clips[1].endFrame).toBe(119)
    expect(project.settings.width).toBe(1920)
  })

  it('creates an empty track when no media provided', () => {
    const project = buildProjectFromWizard({
      details: { ...baseDetails, seed: undefined },
      media: [],
      settings: { ...baseSettings, autoCreateTrack: false },
    })

    expect(project.timeline.tracks).toHaveLength(1)
    expect(project.timeline.clips).toHaveLength(0)
    expect(project.sources).toHaveLength(0)
    expect(project.metadata.name).toBe(baseDetails.name)
  })
})

