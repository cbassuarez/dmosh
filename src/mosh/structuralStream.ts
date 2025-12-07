import type { StructuralStream, FrameType } from './moshPipeline'
import type { TimelineClip } from '../engine/types'

const frameTypeForIndex = (index: number, fps: number): FrameType => {
  if (index === 0) return 'I'
  if (fps <= 0) return 'P'
  if (index % Math.max(1, Math.round(fps)) === 0) return 'I'
  return index % 2 === 0 ? 'B' : 'P'
}

export const buildStructuralStream = (durationFrames: number, fps: number): StructuralStream => {
  let lastI = 0
  const safeDuration = Math.max(0, Math.floor(durationFrames))
  return Array.from({ length: safeDuration }, (_, idx) => {
    const type = frameTypeForIndex(idx, fps)
    if (type === 'I') lastI = idx
    const refIndices = type === 'I' ? [] : [lastI]
    return {
      index: idx,
      type,
      refIndices,
      keyframe: type === 'I',
    }
  })
}

export const buildStructuralStreamForClip = (
  clip: TimelineClip,
  fps: number,
): StructuralStream => {
  const duration = Math.max(0, clip.endFrame - clip.startFrame)
  return buildStructuralStream(duration, fps)
}
