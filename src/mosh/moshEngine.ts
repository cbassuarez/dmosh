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

export interface MoshTransformOptions {
  /**
   * Enable debug logging for development. When true, we log a small
   * summary of the structural stream and nodes whenever the transform
   * is invoked.
   */
  debug?: boolean
}

/**
 * Central entry point for applying the current mosh node graph to a
 * structural stream. For Pass B, this is intentionally a no-op so
 * that the UI cannot change playback behavior yet.
 *
 * When you're ready to make nodes "do something", you can switch the
 * implementation here to call `applyMoshNodes(stream, nodes)` or a
 * more sophisticated pipeline.
 */
export function transformStructuralStreamWithGraph(
  stream: StructuralStream,
  nodes: MoshNode[] | null | undefined,
  options?: MoshTransformOptions,
): StructuralStream {
  const effectiveNodes = nodes ?? []

  if (options?.debug) {
    // Keep logging lightweight: summarize rather than dumping everything.
    console.debug('[dmosh] transformStructuralStreamWithGraph', {
      frameCount: stream.length,
      nodeCount: effectiveNodes.length,
      nodeOps: effectiveNodes.map((n) => n.op),
    })
  }

  // Pass B: explicit no-op. All nodes are visual-only for now.
  return stream
}

/**
 * Low-level implementation of frame transforms for various mosh nodes.
 *
 * NOTE: This is *not* used by the playback path yet. The only function
 * that should be called from Viewer / render code in Pass B/C is
 * `transformStructuralStreamWithGraph`, which currently returns the
 * original stream unchanged.
 *
 * When you're ready to actually wire mosh into playback, you can have
 * `transformStructuralStreamWithGraph` delegate into this function.
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
