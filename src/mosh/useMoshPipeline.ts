import { useMemo } from 'react'
import { useProject } from '../shared/hooks/useProject'
import { buildPipelineFromGraphs } from './pipelineAdapter'
import type { MoshPipeline } from './moshPipeline'

export const useCurrentMoshPipeline = (): MoshPipeline | null => {
  const { project } = useProject()

  return useMemo(() => {
    if (!project) return null
    return buildPipelineFromGraphs(project.moshGraphsByScopeKey, project.moshBypassGlobal)
  }, [project])
}
