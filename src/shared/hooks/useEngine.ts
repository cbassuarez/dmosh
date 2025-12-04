import { useCallback, useMemo, useState } from 'react'
import { createMockEngine } from '../../engine/mockEngine'
import { EngineResult, Project, RenderSettings } from '../../engine/types'

export const useEngine = () => {
  const engine = useMemo(() => createMockEngine(), [])
  const [result, setResult] = useState<EngineResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState(engine.getProgress())

  const analyze = useCallback(
    async (project: Project) => {
      setError(null)
      await engine.analyze(project)
      setStatus(engine.getProgress())
    },
    [engine],
  )

  const render = useCallback(
    async (project: Project, settings?: RenderSettings) => {
      setError(null)
      try {
        const rendered = await engine.render(project, settings)
        setResult(rendered)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
      setStatus(engine.getProgress())
    },
    [engine],
  )

  return { status, result, error, analyze, render }
}
