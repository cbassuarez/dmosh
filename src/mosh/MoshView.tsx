import { useEffect, useMemo, useState } from 'react'
import { ToggleLeft, ToggleRight } from 'lucide-react'
import Viewer from '../editor/Viewer'
import { useProject } from '../shared/hooks/useProject'
import MoshGraphView from './MoshGraphView'
import MoshSidePanel from './MoshSidePanel'
import {
  createDefaultNode,
  createEmptyMoshGraph,
  DEFAULT_TIMELINE_ID,
  moshScopeKey,
  type MoshGraph,
  type MoshNode,
  type MoshOperationType,
  type MoshScopeId,
} from './moshModel'

const timelineLabel = (projectName: string) => `Timeline: ${projectName}`

const MoshScopeSidebar = ({
  scope,
  onScopeChange,
}: {
  scope: MoshScopeId
  onScopeChange: (scope: MoshScopeId) => void
}) => {
  const { project } = useProject()
  if (!project) return null
  const timelineId = project.timeline.id ?? DEFAULT_TIMELINE_ID

  return (
    <div className="space-y-3 rounded-xl border border-surface-300/60 bg-surface-200/80 p-4 shadow-panel">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Timeline</p>
        <button
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-left text-sm ${
            scope.kind === 'timeline' ? 'border-accent text-white' : 'border-surface-300/60 text-slate-200'
          }`}
          onClick={() => onScopeChange({ kind: 'timeline', timelineId })}
        >
          {timelineLabel(project.metadata.name)}
        </button>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Tracks</p>
        <div className="space-y-2">
          {project.timeline.tracks.map((track) => (
            <div key={track.id} className="rounded-lg border border-surface-300/60 bg-surface-100/20">
              <button
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                  scope.kind === 'track' && scope.trackId === track.id
                    ? 'border-b border-accent bg-accent/10 text-white'
                    : 'text-slate-200'
                }`}
                onClick={() => onScopeChange({ kind: 'track', timelineId, trackId: track.id })}
              >
                <span>{track.name ?? track.id}</span>
                <span className="text-[11px] text-slate-500">{track.kind}</span>
              </button>
              <div className="space-y-1 border-t border-surface-300/60 bg-surface-100/10 px-3 py-2">
                {project.timeline.clips
                  .filter((clip) => clip.trackId === track.id)
                  .map((clip) => (
                    <button
                      key={clip.id}
                      className={`block w-full rounded-md px-2 py-2 text-left text-xs ${
                        scope.kind === 'clip' && scope.clipId === clip.id
                          ? 'border border-accent bg-accent/10 text-white'
                          : 'border border-transparent text-slate-200'
                      }`}
                      onClick={() => onScopeChange({ kind: 'clip', timelineId, trackId: track.id, clipId: clip.id })}
                    >
                      Clip {clip.id}
                    </button>
                  ))}
                {project.timeline.clips.filter((clip) => clip.trackId === track.id).length === 0 && (
                  <p className="text-[11px] text-slate-500">No clips on this track.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const MoshView = () => {
  const {
    project,
    currentMoshScope,
    getMoshGraphForScope,
    updateMoshGraph,
    setCurrentMoshScope,
    setMoshBypassGlobal,
  } = useProject()
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const timelineId = project?.timeline.id ?? DEFAULT_TIMELINE_ID
  const activeScope = useMemo<MoshScopeId>(
    () => currentMoshScope ?? { kind: 'timeline', timelineId },
    [currentMoshScope, timelineId],
  )
    const scopeKey = useMemo(() => moshScopeKey(activeScope), [activeScope])
    useEffect(() => setSelectedNodeId(null), [scopeKey])

    // Always compute the latest graph for the current scope so UI stays in sync
    // with mosh graph updates (no memoization here).
    const graph: MoshGraph = project
      ? getMoshGraphForScope(activeScope)
      : createEmptyMoshGraph(activeScope)


  useEffect(() => {
    if (!project) return
    const hasGraph = project.moshGraphsByScopeKey && project.moshGraphsByScopeKey[scopeKey]
    if (!hasGraph) {
      updateMoshGraph(activeScope, () => graph)
    }
  }, [activeScope, graph, project, scopeKey, updateMoshGraph])

  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null

  if (!project) return null

      const handleAddNode = (op: MoshOperationType) => {
        // per-scope "add-or-select" semantics.
        // If a node with this operation already exists in the active scope,
        // just select it instead of creating a duplicate.
        const existing = graph.nodes.find((node) => node.op === op)
        if (existing) {
          setSelectedNodeId(existing.id)
          return
        }

        const node = createDefaultNode(op)
        updateMoshGraph(activeScope, (prev) => ({
          ...prev,
          nodes: [...prev.nodes, node],
        }))
        setSelectedNodeId(node.id)
      }


  const handleUpdateNode = (nodeId: string, updater: (node: MoshNode) => MoshNode) => {
    updateMoshGraph(activeScope, (prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
    }))
  }

  return (
    <div className="flex h-full w-full flex-col gap-3 lg:flex-row">
      <div className="w-full shrink-0 lg:w-[260px]">
          <MoshScopeSidebar
                    scope={activeScope}
                    onScopeChange={(scope) => {
                      setCurrentMoshScope(scope)
                      setSelectedNodeId(null)
                    }}
                  />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="space-y-2 rounded-xl border border-surface-300/60 bg-surface-200/80 p-4 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Viewer</p>
              <p className="text-sm text-slate-300">Preview the current timeline scope with mosh bypass control.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-surface-300/60 px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={project.moshBypassGlobal ?? false}
                onChange={(e) => setMoshBypassGlobal(e.target.checked)}
              />
              {project.moshBypassGlobal ? <ToggleRight className="h-4 w-4 text-accent" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />}
              Bypass Mosh
            </label>
          </div>
          <Viewer project={project} />
        </div>
        <MoshGraphView
          graph={graph}
            onUpdateGraph={(updater) => updateMoshGraph(activeScope, updater)}
          onSelectNode={setSelectedNodeId}
          selectedNodeId={selectedNodeId}
        />
      </div>
      <div className="w-full shrink-0 lg:w-[320px]">
        <MoshSidePanel selectedNode={selectedNode} onAddNode={handleAddNode} onUpdateNode={handleUpdateNode} />
      </div>
    </div>
  )
}

export default MoshView
