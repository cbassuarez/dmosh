import { useEffect, useState } from 'react'
import { Badge } from 'lucide-react'
import type {
  ClassicDatamoshNode,
  DropIntraFramesNode,
  DropPredictedFramesNode,
  HoldReferenceFrameNode,
  MoshNode,
  MoshOperationType,
} from './moshModel'

const coreOperations: MoshOperationType[] = [
  'DropIntraFrames',
  'DropPredictedFrames',
  'HoldReferenceFrame',
  'ClassicDatamosh',
]

const experimentalOperations: MoshOperationType[] = [
  'ClampLongMotionVectors',
  'PerturbMotionVectors',
  'QuantizeResiduals',
  'VisualizeQuantizationNoise',
]

interface Props {
  selectedNode: MoshNode | null
  onAddNode: (op: MoshOperationType) => void
  onUpdateNode: (nodeId: string, updater: (node: MoshNode) => MoshNode) => void
}

const DropIntraFields = ({ node, onUpdate }: { node: DropIntraFramesNode; onUpdate: (node: MoshNode) => void }) => (
  <div className="space-y-3">
    <label className="flex items-center gap-2 text-sm text-slate-200">
      <input
        type="checkbox"
        checked={node.params.firstIntraOnly}
        onChange={(e) => onUpdate({ ...node, params: { ...node.params, firstIntraOnly: e.target.checked } })}
      />
      First intra only
    </label>
    <label className="flex flex-col gap-1 text-sm text-slate-200">
      <span className="text-xs uppercase tracking-[0.14em] text-slate-400">Probability (%)</span>
      <input
        type="number"
        min={0}
        max={100}
        value={node.params.probability}
        onChange={(e) =>
          onUpdate({
            ...node,
            params: { ...node.params, probability: Number(e.target.value) },
          })
        }
        className="rounded-md border border-surface-300/60 bg-surface-100/30 px-3 py-2 text-white focus:border-accent focus:outline-none"
      />
    </label>
  </div>
)

const DropPredictedFields = ({
  node,
  onUpdate,
}: {
  node: DropPredictedFramesNode
  onUpdate: (node: MoshNode) => void
}) => (
  <div className="space-y-3">
    <div className="space-y-2 text-sm text-slate-200">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Target frame types</p>
      {(['P', 'B'] as const).map((kind) => (
        <label key={kind} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={node.params.targetTypes.includes(kind)}
            onChange={(e) => {
              const next = e.target.checked
                ? [...node.params.targetTypes, kind]
                : node.params.targetTypes.filter((v) => v !== kind)
              onUpdate({ ...node, params: { ...node.params, targetTypes: next } })
            }}
          />
          {kind}-frames
        </label>
      ))}
    </div>
    <label className="flex flex-col gap-1 text-sm text-slate-200">
      <span className="text-xs uppercase tracking-[0.14em] text-slate-400">Probability (%)</span>
      <input
        type="number"
        min={0}
        max={100}
        value={node.params.probability}
        onChange={(e) => onUpdate({ ...node, params: { ...node.params, probability: Number(e.target.value) } })}
        className="rounded-md border border-surface-300/60 bg-surface-100/30 px-3 py-2 text-white focus:border-accent focus:outline-none"
      />
    </label>
  </div>
)

const HoldReferenceFields = ({ node, onUpdate }: { node: HoldReferenceFrameNode; onUpdate: (node: MoshNode) => void }) => (
  <div className="space-y-3">
    <label className="flex flex-col gap-1 text-sm text-slate-200">
      <span className="text-xs uppercase tracking-[0.14em] text-slate-400">Reference mode</span>
      <select
        value={node.params.mode}
        onChange={(e) =>
          onUpdate({ ...node, params: { ...node.params, mode: e.target.value as HoldReferenceFrameNode['params']['mode'] } })
        }
        className="rounded-md border border-surface-300/60 bg-surface-100/30 px-3 py-2 text-white focus:border-accent focus:outline-none"
      >
        <option value="FirstIntra">First intra</option>
        <option value="LastIntra">Last intra</option>
        <option value="SpecificFrameIndex">Specific frame index</option>
      </select>
    </label>
    {node.params.mode === 'SpecificFrameIndex' && (
      <label className="flex flex-col gap-1 text-sm text-slate-200">
        <span className="text-xs uppercase tracking-[0.14em] text-slate-400">Specific frame index</span>
        <input
          type="number"
          value={node.params.specificFrameIndex ?? ''}
          onChange={(e) =>
            onUpdate({
              ...node,
              params: { ...node.params, specificFrameIndex: Number(e.target.value) },
            })
          }
          className="rounded-md border border-surface-300/60 bg-surface-100/30 px-3 py-2 text-white focus:border-accent focus:outline-none"
        />
      </label>
    )}
    <label className="flex flex-col gap-1 text-sm text-slate-200">
      <span className="text-xs uppercase tracking-[0.14em] text-slate-400">Duration mode</span>
      <select
        value={node.params.durationMode}
        onChange={(e) =>
          onUpdate({
            ...node,
            params: { ...node.params, durationMode: e.target.value as HoldReferenceFrameNode['params']['durationMode'] },
          })
        }
        className="rounded-md border border-surface-300/60 bg-surface-100/30 px-3 py-2 text-white focus:border-accent focus:outline-none"
      >
        <option value="UntilNextIntra">Until next intra</option>
        <option value="FixedFrames">Fixed frames</option>
        <option value="FixedSeconds">Fixed seconds</option>
      </select>
    </label>
    {node.params.durationMode === 'FixedFrames' && (
      <label className="flex flex-col gap-1 text-sm text-slate-200">
        <span className="text-xs uppercase tracking-[0.14em] text-slate-400">Fixed frames</span>
        <input
          type="number"
          value={node.params.fixedFrames ?? ''}
          onChange={(e) => onUpdate({ ...node, params: { ...node.params, fixedFrames: Number(e.target.value) } })}
          className="rounded-md border border-surface-300/60 bg-surface-100/30 px-3 py-2 text-white focus:border-accent focus:outline-none"
        />
      </label>
    )}
    {node.params.durationMode === 'FixedSeconds' && (
      <label className="flex flex-col gap-1 text-sm text-slate-200">
        <span className="text-xs uppercase tracking-[0.14em] text-slate-400">Fixed seconds</span>
        <input
          type="number"
          value={node.params.fixedSeconds ?? ''}
          onChange={(e) => onUpdate({ ...node, params: { ...node.params, fixedSeconds: Number(e.target.value) } })}
          className="rounded-md border border-surface-300/60 bg-surface-100/30 px-3 py-2 text-white focus:border-accent focus:outline-none"
        />
      </label>
    )}
  </div>
)

const ClassicDatamoshFields = ({ node, onUpdate }: { node: ClassicDatamoshNode; onUpdate: (node: MoshNode) => void }) => (
  <label className="flex items-center gap-2 text-sm text-slate-200">
    <input
      type="checkbox"
      checked={node.params.enabled}
      onChange={(e) => onUpdate({ ...node, params: { enabled: e.target.checked } })}
    />
    Enabled
  </label>
)

const StubFields = () => (
  <div className="flex items-center gap-2 rounded-md border border-dashed border-surface-300/60 bg-surface-100/20 px-3 py-2 text-xs text-slate-400">
    <Badge className="h-4 w-4" />
    Stub operation: currently pass-through.
  </div>
)

const PaletteList = ({ title, operations, onAdd }: { title: string; operations: MoshOperationType[]; onAdd: (op: MoshOperationType) => void }) => (
  <div className="space-y-2">
    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{title}</p>
    <div className="grid grid-cols-1 gap-2">
      {operations.map((op) => (
        <div
          key={op}
          className="cursor-pointer rounded-lg border border-surface-300/60 bg-surface-200/60 px-3 py-2 text-sm text-slate-200 transition hover:border-accent/70"
          onDoubleClick={() => onAdd(op)}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-white">{op}</span>
            {experimentalOperations.includes(op) && (
              <span className="rounded-full border border-accent/50 bg-accent/10 px-2 py-[2px] text-[11px] text-accent">Stub</span>
            )}
          </div>
          {experimentalOperations.includes(op) && (
            <p className="text-[11px] text-slate-400">Pass-through placeholder</p>
          )}
        </div>
      ))}
    </div>
  </div>
)

const MoshSidePanel = ({ selectedNode, onAddNode, onUpdateNode }: Props) => {
  const [activeTab, setActiveTab] = useState<'palette' | 'inspector'>(selectedNode ? 'inspector' : 'palette')

  useEffect(() => {
    setActiveTab(selectedNode ? 'inspector' : 'palette')
  }, [selectedNode])

  const showInspector = activeTab === 'inspector' && !!selectedNode

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-xl border border-surface-300/60 bg-surface-200/80 p-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-full bg-surface-300/40 p-1 text-[11px] uppercase tracking-[0.14em]">
          <button
            type="button"
            className={`rounded-full px-3 py-1 ${
              activeTab === 'palette' ? 'bg-surface-900 text-white' : 'text-slate-300'
            }`}
            onClick={() => setActiveTab('palette')}
          >
            Palette
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 ${
              activeTab === 'inspector' ? 'bg-surface-900 text-white' : 'text-slate-300'
            } ${!selectedNode ? 'opacity-40' : ''}`}
            onClick={() => {
              if (selectedNode) setActiveTab('inspector')
            }}
            disabled={!selectedNode}
          >
            Inspector
          </button>
        </div>
      </div>

      {showInspector ? (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Inspector</p>
            <p className="text-lg font-semibold text-white">{selectedNode!.op}</p>
          </div>

          {selectedNode!.op === 'DropIntraFrames' && (
            <DropIntraFields
              node={selectedNode as DropIntraFramesNode}
              onUpdate={(node) => onUpdateNode(selectedNode!.id, () => node)}
            />
          )}
          {selectedNode!.op === 'DropPredictedFrames' && (
            <DropPredictedFields
              node={selectedNode as DropPredictedFramesNode}
              onUpdate={(node) => onUpdateNode(selectedNode!.id, () => node)}
            />
          )}
          {selectedNode!.op === 'HoldReferenceFrame' && (
            <HoldReferenceFields
              node={selectedNode as HoldReferenceFrameNode}
              onUpdate={(node) => onUpdateNode(selectedNode!.id, () => node)}
            />
          )}
          {selectedNode!.op === 'ClassicDatamosh' && (
            <ClassicDatamoshFields
              node={selectedNode as ClassicDatamoshNode}
              onUpdate={(node) => onUpdateNode(selectedNode!.id, () => node)}
            />
          )}
          {experimentalOperations.includes(selectedNode!.op) && <StubFields />}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Palette</p>
            <p className="text-sm text-slate-300">Double-click an operation to add it to the current graph.</p>
          </div>
          <PaletteList title="Core operations" operations={coreOperations} onAdd={onAddNode} />
          <PaletteList title="Experimental / Stub" operations={experimentalOperations} onAdd={onAddNode} />
        </div>
      )}
    </div>
  )
 }
 
 export default MoshSidePanel
