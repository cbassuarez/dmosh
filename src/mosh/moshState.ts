import { createEmptyMoshGraph, moshScopeKey } from './moshModel'
import type { MoshGraph, MoshScopeId } from './moshModel'

export type MoshGraphRecord = Record<string, MoshGraph>

export const getGraphForScope = (
  record: MoshGraphRecord | undefined,
  scope: MoshScopeId,
): MoshGraph => {
  const key = moshScopeKey(scope)
  return record?.[key] ?? createEmptyMoshGraph(scope)
}

export const upsertGraphRecord = (
  record: MoshGraphRecord | undefined,
  scope: MoshScopeId,
  updater: (graph: MoshGraph) => MoshGraph,
): MoshGraphRecord => {
  const key = moshScopeKey(scope)
  const current = getGraphForScope(record, scope)
  const nextGraph = updater(current)
  return { ...(record ?? {}), [key]: nextGraph }
}
