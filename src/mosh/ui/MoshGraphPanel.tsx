import { useMemo, useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useProject } from '../../shared/hooks/useProject'
import type { MoshGraph, MoshNode, MoshParamState } from '../graph/types'
import type { MoshOperationKind, MoshScope } from '../ops/types'
import { createClassicDatamoshGraph } from '../ops/composites/classicDatamosh'

const ALL_OPERATION_KINDS: MoshOperationKind[] = [
  'DropIntraFrames',
  'DropPredictedFrames',
  'HoldReferenceFrame',
  'RedirectReferences',
  'TransformMotionVectors',
  'DropPackets',
  'CorruptPackets',
  'ControlEnvelope',
  'ControlLFO',
  'ControlNoise',
  'ControlFollowParameter',
]

const ensureGraph = (graph: MoshGraph | null | undefined): MoshGraph =>
  graph ?? {
    id: 'CustomMoshGraph',
    nodes: [],
    edges: [],
    paramLinks: [],
  }

const valueToString = (value: MoshParamState['value']): string =>
  Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? String(value) : String(value)

const parseValue = (raw: string, original: MoshParamState['value']): MoshParamState['value'] => {
  if (typeof original === 'number') {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : original
  }
  if (typeof original === 'boolean') {
    return raw === 'true'
  }
  if (Array.isArray(original)) {
    const parts = raw
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((part) => Number.isFinite(part))
    return (parts as typeof original).slice(0, original.length) as typeof original
  }
  return raw
}

const NodeCard = ({ node, onSelect, isSelected }: { node: MoshNode; onSelect: () => void; isSelected: boolean }) => (
  <button
    className={`w-full rounded-lg border px-4 py-3 text-left transition ${
      isSelected
        ? 'border-accent bg-accent/10 text-white shadow-lg'
        : 'border-surface-300/60 bg-surface-200/80 text-slate-200 hover:border-accent/70'
    }`}
    onClick={onSelect}
  >
    <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400">
      <span>{node.kind}</span>
      <span className="rounded-full border border-surface-300/60 px-2 py-[2px] text-[10px] text-slate-300">{node.scope}</span>
    </div>
    <div className="mt-2 text-sm font-semibold text-white">{node.label || node.id}</div>
    {node.targetClipIds && node.targetClipIds.length > 0 && (
      <p className="mt-1 text-[11px] text-slate-300">Clips: {node.targetClipIds.join(', ')}</p>
    )}
    {node.targetTrackIds && node.targetTrackIds.length > 0 && (
      <p className="mt-1 text-[11px] text-slate-300">Tracks: {node.targetTrackIds.join(', ')}</p>
    )}
    <div className="mt-2 space-y-1 text-[11px] text-slate-300">
      {node.params.map((param) => (
        <div key={param.id} className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">{param.id}</span>
          <span className="rounded bg-surface-100/40 px-2 py-[2px] text-[11px] text-slate-200">{valueToString(param.value)}</span>
        </div>
      ))}
      {node.params.length === 0 && <span className="text-[11px] text-slate-500">No parameters</span>}
    </div>
  </button>
)

const ParameterEditor = ({ node, onChange }: { node: MoshNode; onChange: (params: MoshParamState[]) => void }) => (
  <div className="space-y-3">
    <h4 className="text-xs uppercase tracking-[0.16em] text-slate-400">Parameters</h4>
    {node.params.length === 0 && <p className="text-sm text-slate-400">No parameters on this node yet.</p>}
    {node.params.map((param) => {
      const isBoolean = typeof param.value === 'boolean'
      const isNumber = typeof param.value === 'number'
      const isVector = Array.isArray(param.value)
      return (
        <div key={param.id} className="space-y-1 rounded-md border border-surface-300/60 bg-surface-200/80 p-3">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">{param.id}</span>
            <span className="text-[11px] text-slate-500">{param.label}</span>
          </div>
          {isBoolean ? (
            <label className="flex items-center gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={Boolean(param.value)}
                onChange={(e) =>
                  onChange(
                    node.params.map((p) => (p.id === param.id ? { ...p, value: e.target.checked } : p)),
                  )
                }
              />
              Enabled
            </label>
          ) : (
            <input
              type={isNumber ? 'number' : 'text'}
              defaultValue={valueToString(param.value)}
              onBlur={(e) =>
                onChange(
                  node.params.map((p) =>
                    p.id === param.id ? { ...p, value: parseValue(e.target.value, param.value) } : p,
                  ),
                )
              }
              className="w-full rounded-md border border-surface-300/60 bg-surface-100/30 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
              placeholder={isVector ? 'Comma-separated values' : ''}
            />
          )}
        </div>
      )
    })}
  </div>
)

const MoshGraphPanel = () => {
  const { project, setProject } = useProject()
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [newKind, setNewKind] = useState<MoshOperationKind>('DropIntraFrames')
  const [newScope, setNewScope] = useState<MoshScope>('timeline')

  const graph = useMemo(() => ensureGraph(project?.moshGraph), [project?.moshGraph])

  if (!project) return null

  const applyGraph = (next: MoshGraph) => setProject({ ...project, moshGraph: next })

  const resetClassic = () => {
    const classic = createClassicDatamoshGraph()
    applyGraph(classic)
    setSelectedNodeId(classic.nodes[0]?.id ?? null)
  }

  const addNode = () => {
    const id = `node-${graph.nodes.length + 1}`
    const node: MoshNode = {
      id,
      kind: newKind,
      scope: newScope,
      label: newKind,
      params: [],
      ui: { x: 120 + graph.nodes.length * 24, y: 120 },
    }
    applyGraph({ ...graph, nodes: [...graph.nodes, node] })
    setSelectedNodeId(id)
  }

  const removeNode = (nodeId: string) => {
    const remainingNodes = graph.nodes.filter((node) => node.id !== nodeId)
    const remainingEdges = graph.edges.filter((edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId)
    const remainingLinks = graph.paramLinks.filter(
      (link) => link.sourceNodeId !== nodeId && link.targetNodeId !== nodeId,
    )
    applyGraph({ ...graph, nodes: remainingNodes, edges: remainingEdges, paramLinks: remainingLinks })
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(remainingNodes[0]?.id ?? null)
    }
  }

  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Mosh operation graph</p>
          <p className="text-sm text-slate-300">Structured, codec-aware node graph for datamosh control.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetClassic}
            className="flex items-center gap-2 rounded-md border border-surface-300/60 px-3 py-2 text-sm text-white transition hover:border-accent/70"
          >
            <RefreshCw className="h-4 w-4" /> Apply Classic Datamosh preset
          </button>
        </div>
      </div>

      {project.moshGraph === null && (
        <div className="space-y-3 rounded-lg border border-dashed border-surface-300/60 bg-surface-200/60 p-4">
          <p className="text-sm text-slate-300">
            No mosh graph is attached to this project yet. Apply the Classic Datamosh preset to start from the canonical intra
            drop + hold reference structure.
          </p>
          <button
            onClick={resetClassic}
            className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-accent/40"
          >
            <RefreshCw className="h-4 w-4" /> Apply Classic Datamosh preset
          </button>
        </div>
      )}

      <div className="rounded-lg border border-surface-300/60 bg-surface-200/70 p-4 shadow-panel">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-slate-400">Operation</label>
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as MoshOperationKind)}
              className="rounded-md border border-surface-300/60 bg-surface-100/30 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
            >
              {ALL_OPERATION_KINDS.map((kind) => (
                <option key={kind} value={kind} className="bg-surface-900 text-white">
                  {kind}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-slate-400">Scope</label>
            <select
              value={newScope}
              onChange={(e) => setNewScope(e.target.value as MoshScope)}
              className="rounded-md border border-surface-300/60 bg-surface-100/30 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
            >
              <option value="timeline">Timeline</option>
              <option value="track">Track</option>
              <option value="clip">Clip</option>
            </select>
          </div>
          <button
            onClick={addNode}
            className="flex items-center gap-2 rounded-md border border-surface-300/60 px-3 py-2 text-sm text-white transition hover:border-accent/70"
          >
            <Plus className="h-4 w-4" /> Add node
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {graph.nodes.map((node) => (
          <div key={node.id} className="relative">
            <NodeCard node={node} onSelect={() => setSelectedNodeId(node.id)} isSelected={selectedNodeId === node.id} />
            <button
              onClick={() => removeNode(node.id)}
              className="absolute right-2 top-2 rounded-full border border-surface-300/60 bg-surface-900/80 p-1 text-slate-300 transition hover:border-accent/70 hover:text-white"
              aria-label={`Remove ${node.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {graph.nodes.length === 0 && (
          <div className="rounded-lg border border-dashed border-surface-300/60 bg-surface-200/40 p-4 text-sm text-slate-400">
            No nodes yet. Add a primitive operation or apply the Classic Datamosh preset.
          </div>
        )}
      </div>

      {selectedNode && (
        <div className="rounded-lg border border-surface-300/60 bg-surface-200/80 p-4 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Selected node</p>
              <p className="text-sm font-semibold text-white">{selectedNode.label || selectedNode.id}</p>
              <p className="text-xs text-slate-400">{selectedNode.kind}</p>
            </div>
            <div className="text-right text-[11px] uppercase tracking-[0.14em] text-slate-400">
              <p>Scope: {selectedNode.scope}</p>
              {selectedNode.targetClipIds && selectedNode.targetClipIds.length > 0 && (
                <p>Clips: {selectedNode.targetClipIds.join(', ')}</p>
              )}
              {selectedNode.targetTrackIds && selectedNode.targetTrackIds.length > 0 && (
                <p>Tracks: {selectedNode.targetTrackIds.join(', ')}</p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <ParameterEditor
                node={selectedNode}
                onChange={(params) =>
                  applyGraph({
                    ...graph,
                    nodes: graph.nodes.map((node) => (node.id === selectedNode.id ? { ...node, params } : node)),
                  })
                }
              />
            </div>
            <div className="space-y-2 rounded-md border border-surface-300/60 bg-surface-100/30 p-3 text-sm text-slate-300">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Edges</p>
              {graph.edges
                .filter((edge) => edge.fromNodeId === selectedNode.id || edge.toNodeId === selectedNode.id)
                .map((edge) => (
                  <div key={edge.id} className="rounded border border-surface-300/60 bg-surface-200/60 px-2 py-1 text-[12px]">
                    {edge.fromNodeId} → {edge.toNodeId} ({edge.kind ?? 'frame'})
                  </div>
                ))}
              {graph.edges.filter((edge) => edge.fromNodeId === selectedNode.id || edge.toNodeId === selectedNode.id).length === 0 && (
                <p className="text-[12px] text-slate-500">No edges connected.</p>
              )}
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Param links</p>
              {graph.paramLinks
                .filter((link) => link.sourceNodeId === selectedNode.id || link.targetNodeId === selectedNode.id)
                .map((link) => (
                  <div key={link.id} className="rounded border border-surface-300/60 bg-surface-200/60 px-2 py-1 text-[12px]">
                    {link.sourceNodeId}.{link.sourceParamId} → {link.targetNodeId}.{link.targetParamId}
                  </div>
                ))}
              {graph.paramLinks.filter((link) => link.sourceNodeId === selectedNode.id || link.targetNodeId === selectedNode.id)
                .length === 0 && <p className="text-[12px] text-slate-500">No parameter links.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MoshGraphPanel
