import type { MoshNode } from './moshModel'

export type FrameType = 'I' | 'P' | 'B'

export interface StructuralFrame {
  index: number
  type: FrameType
}

export type StructuralStream = StructuralFrame[]

/**
 * Build a structural stream for the current playback segment.
 *
 * For now, this can be a synthetic pattern if needed; if you can
 * detect real frame types, prefer that.
 */
export function buildStructuralStream(frameCount: number): StructuralStream {
  const stream: StructuralStream = []
  for (let i = 0; i < frameCount; i += 1) {
    // Simple repeating pattern: I P B P B ...
    let type: FrameType
    if (i === 0) {
      type = 'I'
    } else if (i % 3 === 1) {
      type = 'P'
    } else {
      type = 'B'
    }
    stream.push({ index: i, type })
  }
  return stream
}

/**
 * Apply the Mosh node pipeline to the structural stream.
 * This is the minimal, visible MVP:
 * - DropIntraFrames
 * - DropPredictedFrames
 * - ClassicDatamosh (reuses DropIntraFrames behavior)
 *
 * All other ops are treated as pass-through.
 */
export function applyMoshNodes(stream: StructuralStream, nodes: MoshNode[]): StructuralStream {
  if (!nodes || nodes.length === 0) return stream

  return nodes.reduce<StructuralStream>((acc, node) => {
    if (node.bypass) return acc
    const op = node.op

    switch (op) {
      case 'DropIntraFrames': {
        const probability = typeof node.params?.probability === 'number' ? node.params.probability : 100

        const firstIntraOnly = Boolean(node.params?.firstIntraOnly)

        let firstIntraDropped = false

        return acc.filter((frame) => {
          if (frame.type !== 'I') return true

          if (firstIntraOnly) {
            if (firstIntraDropped) return true
            const shouldDrop = Math.random() * 100 < probability
            if (shouldDrop) {
              firstIntraDropped = true
              return false
            }
            return true
          }

          const shouldDrop = Math.random() * 100 < probability
          return !shouldDrop
        })
      }

      case 'DropPredictedFrames': {
        const params = node.params ?? { targetTypes: ['P', 'B'], probability: 100 }
        const targets: FrameType[] = Array.isArray(params.targetTypes)
          ? (params.targetTypes as FrameType[])
          : ['P', 'B']

        const targetSet = new Set<FrameType>((targets as FrameType[]).filter((t) => t === 'P' || t === 'B'))

        const probability = typeof params.probability === 'number' ? params.probability : 100

        return acc.filter((frame) => {
          if (!targetSet.has(frame.type)) return true
          const shouldDrop = Math.random() * 100 < probability
          return !shouldDrop
        })
      }

      case 'ClassicDatamosh': {
        const enabled = node.params?.enabled ?? true
        if (!enabled) return acc

        return acc.filter((frame) => frame.type !== 'I')
      }

      case 'HoldReferenceFrame':
      case 'ClampLongMotionVectors':
      case 'PerturbMotionVectors':
      case 'QuantizeResiduals':
      case 'VisualizeQuantizationNoise':
      default:
        return acc
    }
  }, stream)
}
