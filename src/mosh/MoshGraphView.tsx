import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, Slash } from 'lucide-react'
import type { MoshGraph, MoshNode, MoshOperationType } from './moshModel'

const experimentalOperations: MoshOperationType[] = [
  'ClampLongMotionVectors',
  'PerturbMotionVectors',
  'QuantizeResiduals',
  'VisualizeQuantizationNoise',
]

interface Props {
  graph: MoshGraph
  onUpdateGraph: (updater: (graph: MoshGraph) => MoshGraph) => void
  onSelectNode: (id: string | null) => void
  selectedNodeId: string | null
}

const NodeCard = ({
  node,
  isSelected,
  isStub,
  onSelect,
  onRemove,
  onMoveLeft,
  onMoveRight,
  onToggleBypass,
  onDeselect,
}: {
  node: MoshNode
  isSelected: boolean
  isStub?: boolean
  onSelect: () => void
  onRemove: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
  onToggleBypass: (value: boolean) => void
  onDeselect: () => void
}) => (
  <div
       className={`flex min-w-[220px] flex-col gap-3 rounded-lg border px-4 py-3 text-left transition ${
      isSelected
        ? 'border-accent bg-accent/10 text-white shadow-lg'
        : 'border-surface-300/60 bg-surface-200/70 text-slate-200 hover:border-accent/70'
    }`}
    onClick={onSelect}
    role="button"
    tabIndex={0}
  >
       <div className="flex items-start gap-3">
             {/* Static preview tile placeholder */}
             <div className="h-14 w-20 shrink-0 rounded-md border border-surface-400/70 bg-surface-300/40" />
       
             <div className="flex min-w-0 flex-1 flex-col gap-1">
               <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-slate-400">
                 <span className="truncate">{node.op}</span>
                 <div className="flex items-center gap-2">
                   {isStub && (
                     <span className="rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-[1px] text-[10px] uppercase tracking-[0.14em] text-amber-200">
                       Stub
                     </span>
                   )}
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
               </div>
               <div className="truncate text-sm font-semibold text-white">{node.id}</div>
             </div>
           </div>
       
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

const MoshGraphView = ({ graph, onUpdateGraph, onSelectNode, selectedNodeId }: Props) => {
  // When a node becomes selected (including via palette double-click),
  // ensure it is scrolled into view in the horizontal node strip.
  useEffect(() => {
    if (!selectedNodeId) return
    const el = document.querySelector<HTMLElement>(
      `[data-mosh-node-id="${selectedNodeId}"]`,
    )
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [selectedNodeId])

  return (
    <div className="space-y-3 rounded-xl border border-surface-300/60 bg-surface-200/80 p-4 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Node graph</p>
                    <p className="text-sm text-slate-200">Operations applied to the currently selected scope.</p>
                  </div>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              <p className="font-semibold uppercase tracking-[0.14em]">Experimental</p>
              <p className="mt-1 text-[11px] leading-relaxed">
                Some mosh operations are experimental stubs and currently act as pass-through placeholders. Node layouts are
                stable, but behavior may change.
              </p>
            </div>
      
            <div className="mt-2 flex items-stretch gap-3 overflow-x-auto rounded-xl border border-dashed border-surface-300/60 bg-surface-100/20 p-4">
        {graph.nodes.length === 0 && (
          <p className="text-sm text-slate-400">No nodes yet. Add an operation from the palette.</p>
        )}
          {graph.nodes.map((node, index) => (
                    <div
                      key={node.id}
                      className="flex items-center gap-3"
                      data-mosh-node-id={node.id}
                    >
            <NodeCard
              node={node}
              isSelected={selectedNodeId === node.id}
              isStub={experimentalOperations.includes(node.op)}
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
            <div className="h-10 w-10 flex-1">
                            <div className="flex h-full items-center">
                              <div className="h-[2px] w-full rounded-full bg-surface-400/60" />
                            </div>
                          </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MoshGraphView
