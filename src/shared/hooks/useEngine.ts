import { useCallback, useEffect, useState } from 'react'
import { EngineProgress, RenderSettings } from '../../engine/engine'
import { Project } from '../../engine/types'
import { useVideoEngine } from '../../engine/worker/workerClient'

export const useEngine = () => {
  const { engine, progress, lastError } = useVideoEngine()
  const [status, setStatus] = useState<EngineProgress>(progress)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<unknown | null>(null)

  useEffect(() => setStatus(progress), [progress])
  useEffect(() => setError(lastError?.message ?? null), [lastError])

  const analyze = useCallback(
    async (project: Project) => {
      if (!engine) return
      setError(null)
      await engine.loadProject(project)
      await engine.analyze()
      setStatus({ phase: 'indexing', progress: 1, message: 'Analysis complete' })
    },
    [engine],
  )

  const render = useCallback(
    async (project: Project, settings?: RenderSettings) => {
      if (!engine) return
      await analyze(project)
      const targetFrame = settings?.source.kind === 'timeline' ? settings.source.inFrame ?? 0 : 0
      const frame = await engine.renderFrame(targetFrame, 'full')
      setResult(frame)
    },
    [analyze, engine],
  )

  return { status, result, error, analyze, render, engine }
}
