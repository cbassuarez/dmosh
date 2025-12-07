import { ArrowLeftRight, ChevronLeft, ChevronRight, Slash } from 'lucide-react'
import { moshScopeKey, type MoshGraph, type MoshNode, type MoshScopeId } from './moshModel'

interface ScopeOption {
  label: string
  value: MoshScopeId
}

interface Props {
  graph: MoshGraph
  scopeOptions: ScopeOption[]
  onScopeChange: (scope: MoshScopeId) => void
  onUpdateGraph: (updater: (graph: MoshGraph) => MoshGraph) => void
  onSelectNode: (id: string | null) => void
  selectedNodeId: string | null
}

const NodeCard = ({
  node,
  isSelected,
  onSelect,
  onRemove,
  onMoveLeft,
  onMoveRight,
  onToggleBypass,
  onDeselect,
}: {
  node: MoshNode
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
  onToggleBypass: (value: boolean) => void
  onDeselect: () => void
}) => (
  <div
    className={`flex min-w-[180px] flex-col gap-2 rounded-lg border px-4 py-3 text-left transition ${
      isSelected
        ? 'border-accent bg-accent/10 text-white shadow-lg'
        : 'border-surface-300/60 bg-surface-200/70 text-slate-200 hover:border-accent/70'
    }`}
    onClick={onSelect}
    role="button"
    tabIndex={0}
  >
    <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-400">
      <span>{node.op}</span>
      <label className="flex items-center gap-2 text-[11px] text-slate-300">
        <input
          type="checkbox"
          checked={node.bypass}
          onChange={(e) => {
            e.stopPropagation()
            onToggleBypass(e.target.checked)
          }}
          onClick={(e) => e.stopPropagation()}
        />
        Bypass
      </label>
    </div>
    <div className="text-sm font-semibold text-white">{node.id}</div>
    <div className="flex items-center justify-between text-[11px] text-slate-400">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded border border-surface-300/60 p-1 hover:border-accent/70"
          onClick={(event) => {
            event.stopPropagation()
            onMoveLeft()
          }}
          aria-label="Move node left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded border border-surface-300/60 p-1 hover:border-accent/70"
          onClick={(event) => {
            event.stopPropagation()
            onMoveRight()
          }}
          aria-label="Move node right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        className="rounded border border-surface-300/60 px-2 py-[2px] text-[11px] hover:border-accent/70"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
            onDeselect()
          }}
          aria-label="Remove node"
      >
        <Slash className="h-3 w-3" /> Remove
      </button>
    </div>
  </div>
)

const MoshGraphView = ({
  graph,
  scopeOptions,
  onScopeChange,
  onUpdateGraph,
  onSelectNode,
  selectedNodeId,
}: Props) => {
  const selectedKey = moshScopeKey(graph.scope)
  return (
    <div className="space-y-3 rounded-xl border border-surface-300/60 bg-surface-200/80 p-4 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Scope</p>
          <p className="text-sm text-slate-200">Select which part of the timeline this graph controls.</p>
        </div>
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-slate-400" />
          <select
            value={selectedKey}
            onChange={(e) => {
              const nextScope = scopeOptions.find((option) => moshScopeKey(option.value) === e.target.value)?.value
              if (nextScope) {
                onScopeChange(nextScope)
                onSelectNode(null)
              }
            }}
            className="rounded-md border border-surface-300/60 bg-surface-100/30 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
          >
            {scopeOptions.map((option) => (
              <option key={moshScopeKey(option.value)} value={moshScopeKey(option.value)} className="bg-surface-900 text-white">
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto rounded-lg border border-dashed border-surface-300/60 bg-surface-100/20 p-3">
        {graph.nodes.length === 0 && (
          <p className="text-sm text-slate-400">No nodes yet. Add an operation from the palette.</p>
        )}
        {graph.nodes.map((node, index) => (
          <div key={node.id} className="flex items-center gap-3">
            <NodeCard
              node={node}
              isSelected={selectedNodeId === node.id}
              onSelect={() => onSelectNode(node.id)}
              onRemove={() =>
                onUpdateGraph((prev) => ({
                  ...prev,
                  nodes: prev.nodes.filter((candidate) => candidate.id !== node.id),
                }))
              }
              onMoveLeft={() =>
                onUpdateGraph((prev) => {
                  const nextNodes = [...prev.nodes]
                  const nextIndex = Math.max(0, index - 1)
                  nextNodes.splice(index, 1)
                  nextNodes.splice(nextIndex, 0, node)
                  return { ...prev, nodes: nextNodes }
                })
              }
              onMoveRight={() =>
                onUpdateGraph((prev) => {
                  const nextNodes = [...prev.nodes]
                  const nextIndex = Math.min(prev.nodes.length - 1, index + 1)
                  nextNodes.splice(index, 1)
                  nextNodes.splice(nextIndex, 0, node)
                  return { ...prev, nodes: nextNodes }
                })
              }
              onToggleBypass={(value) =>
                onUpdateGraph((prev) => ({
                  ...prev,
                  nodes: prev.nodes.map((candidate) =>
                    candidate.id === node.id ? { ...candidate, bypass: value } : candidate,
                  ),
                }))
              }
              onDeselect={() => onSelectNode(null)}
            />
            {index < graph.nodes.length - 1 && (
              <div className="text-slate-500">
                <ChevronRight className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MoshGraphView
