import { useMemo } from 'react'
import type { RenderJob } from './useProject'
import type { SpriteLoadState } from '../../components/StatusSprite'

interface LoadStateResult {
  loadState: SpriteLoadState
  queueLength: number
  oldestQueuedSeconds: number | null
  estimatedWaitSeconds: number | null
}

export const useExportLoadState = (renderQueue: RenderJob[]): LoadStateResult => {
  return useMemo(() => {
    const now = Date.now()
    const activeJobs = renderQueue.filter(
      (job) => job.status === 'queued' || job.status === 'rendering',
    )

    const queueLength = activeJobs.length

    if (queueLength === 0) {
      return {
        loadState: 'idle',
        queueLength: 0,
        oldestQueuedSeconds: null,
        estimatedWaitSeconds: null,
      }
    }

    let oldestQueuedMs: number | null = null

    for (const job of activeJobs) {
      const createdAt = job.createdAt ? Date.parse(job.createdAt) : NaN
      if (!Number.isNaN(createdAt)) {
        const age = now - createdAt
        if (age >= 0 && (oldestQueuedMs == null || age > oldestQueuedMs)) {
          oldestQueuedMs = age
        }
      }
    }

    const oldestQueuedSeconds = oldestQueuedMs == null ? null : Math.max(0, oldestQueuedMs / 1000)
    const estimatedWaitSeconds =
      oldestQueuedSeconds != null ? oldestQueuedSeconds + queueLength * 10 : queueLength * 10

    let loadState: SpriteLoadState = 'busy'

    if (queueLength > 3 || (oldestQueuedSeconds != null && oldestQueuedSeconds >= 45)) {
      loadState = 'overloaded'
    }

    return {
      loadState,
      queueLength,
      oldestQueuedSeconds,
      estimatedWaitSeconds,
    }
  }, [renderQueue])
}
