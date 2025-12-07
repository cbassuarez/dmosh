import type {
  ClassicDatamoshNode,
  DropIntraFramesNode,
  DropPredictedFramesNode,
  HoldReferenceFrameNode,
  MoshGraph,
  MoshNode,
  MoshScopeId,
} from '../mosh/moshModel'
import { DEFAULT_TIMELINE_ID, moshScopeKey } from '../mosh/moshModel'
import type { RenderSettings } from './renderTypes'
import type { Project, TimelineClip } from './types'

export type MoshFrameType = 'I' | 'P' | 'B' | 'Unknown'

export interface MoshContextFrame {
index: number
frameType: MoshFrameType
/** Optional content indirection for hold effects. Defaults to `index`. */
contentFrom?: number
/** Optional marker showing the source frame being held. */
heldFrom?: number | null
}

export interface MoshContext {
frames: MoshContextFrame[]
fps?: number
durationFrames?: number
}

export type MoshOpFn = (ctx: MoshContext) => MoshContext

const noop: MoshOpFn = (ctx) => ctx

const ensureContentFrom = (frame: MoshContextFrame): MoshContextFrame => ({
...frame,
contentFrom: frame.contentFrom ?? frame.index,
})

const compileDropIntraFrames = (node: DropIntraFramesNode): MoshOpFn => {
const { firstIntraOnly, probability } = node.params

return (ctx) => {
let firstIntraSeen = false
const filtered = ctx.frames.filter((frame) => {
if (frame.frameType !== 'I') return true

  if (!firstIntraSeen) {
    firstIntraSeen = true
    if (firstIntraOnly) return true
  }

  const roll = Math.random() * 100
  return roll >= probability
})

return { ...ctx, frames: filtered.map(ensureContentFrom) }

}
}

const compileDropPredictedFrames = (node: DropPredictedFramesNode): MoshOpFn => {
const { targetTypes, probability } = node.params
const targetSet = new Set(targetTypes)

return (ctx) => {
const filtered = ctx.frames.filter((frame) => {
if (!targetSet.has(frame.frameType as 'P' | 'B')) return true
const roll = Math.random() * 100
return roll >= probability
})

return { ...ctx, frames: filtered.map(ensureContentFrom) }

}
}

const selectReferenceIndex = (frames: MoshContextFrame[], node: HoldReferenceFrameNode): number | null => {
if (frames.length === 0) return null

if (node.params.mode === 'FirstIntra') {
const idx = frames.findIndex((frame) => frame.frameType === 'I')
return idx === -1 ? null : idx
}

if (node.params.mode === 'LastIntra') {
for (let i = frames.length - 1; i >= 0; i -= 1) {
if (frames[i].frameType === 'I') return i
}
return null
}

const specific = node.params.specificFrameIndex
if (node.params.mode === 'SpecificFrameIndex' && typeof specific === 'number' && specific >= 0) {
return Math.min(frames.length - 1, specific)
}

return null
}

const computeHoldDuration = (ctx: MoshContext, refIndex: number, node: HoldReferenceFrameNode): number => {
if (node.params.durationMode === 'UntilNextIntra') {
const nextIntra = ctx.frames.slice(refIndex + 1).findIndex((frame) => frame.frameType === 'I')
return nextIntra === -1 ? ctx.frames.length - (refIndex + 1) : nextIntra
}

if (node.params.durationMode === 'FixedFrames' && typeof node.params.fixedFrames === 'number') {
return Math.max(0, node.params.fixedFrames)
}

if (node.params.durationMode === 'FixedSeconds' && typeof node.params.fixedSeconds === 'number') {
const fps = ctx.fps ?? 0
return Math.max(0, Math.round(node.params.fixedSeconds * fps))
}

return 0
}

const compileHoldReferenceFrame = (node: HoldReferenceFrameNode): MoshOpFn => {
return (ctx) => {
const frames = ctx.frames.map(ensureContentFrom)
const refIndex = selectReferenceIndex(frames, node)
if (refIndex == null || refIndex < 0 || refIndex >= frames.length) return { ...ctx, frames }

const duration = computeHoldDuration(ctx, refIndex, node)
if (duration <= 0) return { ...ctx, frames }

const start = refIndex + 1
const end = Math.min(frames.length, start + duration)
const heldFrom = frames[refIndex].contentFrom ?? frames[refIndex].index

const nextFrames = frames.map((frame, idx) => {
  if (idx >= start && idx < end) {
    return { ...frame, contentFrom: heldFrom, heldFrom }
  }
  return frame
})

return { ...ctx, frames: nextFrames }

}
}

const compileClassicDatamosh = (_node: ClassicDatamoshNode): MoshOpFn => {
return (ctx) => {
void _node
const frames = ctx.frames.map(ensureContentFrom)
const firstIntraIndex = frames.findIndex((frame) => frame.frameType === 'I')
if (firstIntraIndex === -1) return { ...ctx, frames }

const heldFrom = frames[firstIntraIndex].contentFrom ?? frames[firstIntraIndex].index
const nextFrames: MoshContextFrame[] = []

frames.forEach((frame, idx) => {
  if (idx === firstIntraIndex) {
    nextFrames.push({ ...frame, contentFrom: heldFrom })
    return
  }

  if (frame.frameType === 'I') {
    // Drop subsequent I-frames to keep the "moshed" accumulation.
    return
  }

  nextFrames.push({ ...frame, contentFrom: heldFrom, heldFrom })
})

return { ...ctx, frames: nextFrames }

}
}

export function compileMoshOpFromNode(node: MoshNode): MoshOpFn {
if (node.bypass) return noop

switch (node.op) {
case 'DropIntraFrames':
return compileDropIntraFrames(node)
case 'DropPredictedFrames':
return compileDropPredictedFrames(node)
case 'HoldReferenceFrame':
return compileHoldReferenceFrame(node)
case 'ClassicDatamosh':
return compileClassicDatamosh(node)
case 'ClampLongMotionVectors':
case 'PerturbMotionVectors':
case 'QuantizeResiduals':
case 'VisualizeQuantizationNoise':
// Not implemented yet in the structural preview engine.
return noop
default:
return noop
}
}

const composeOps =
(ops: MoshOpFn[]): MoshOpFn =>
(ctx) =>
ops.reduce((acc, fn) => fn(acc), ctx)

export function compileMoshPipelineFromGraphs(graphs: MoshGraph[]): MoshOpFn {
const activeOps: MoshOpFn[] = []

graphs.forEach((graph) => {
graph.nodes.forEach((node) => {
activeOps.push(compileMoshOpFromNode(node))
})
})

return composeOps(activeOps)
}

export const extractActiveMoshOperations = (graphs: MoshGraph[]): string[] =>
graphs.flatMap((graph) => graph.nodes.filter((node) => !node.bypass).map((node) => node.op))

export const collectGraphsForClip = (project: Project, clip: TimelineClip | null): MoshGraph[] => {
const timelineId = project.timeline.id ?? DEFAULT_TIMELINE_ID
const byKey = project.moshGraphsByScopeKey ?? {}
const graphs: MoshGraph[] = []

// 1) Timeline scope
const timelineScope: MoshScopeId = { kind: 'timeline', timelineId }
const timelineGraph = byKey[moshScopeKey(timelineScope)]
if (timelineGraph) graphs.push(timelineGraph)

// 2) Track + clip scopes (if we have a clip)
if (clip) {
const trackScope: MoshScopeId = { kind: 'track', timelineId, trackId: clip.trackId }
const clipScope: MoshScopeId = { kind: 'clip', timelineId, trackId: clip.trackId, clipId: clip.id }

const trackGraph = byKey[moshScopeKey(trackScope)]
const clipGraph = byKey[moshScopeKey(clipScope)]

if (trackGraph) graphs.push(trackGraph)
if (clipGraph) graphs.push(clipGraph)

}

return graphs
}

export const collectAllGraphs = (project: Project): MoshGraph[] =>
Object.values(project.moshGraphsByScopeKey ?? {})

export const buildSyntheticFrames = (duration: number, fps: number): MoshContextFrame[] => {
if (duration <= 0) return []
const gop = Math.max(1, Math.round(fps || 1))

return Array.from({ length: duration }, (_, idx) => {
let frameType: MoshFrameType = 'P'
if (idx === 0 || idx % gop === 0) {
frameType = 'I'
} else if (idx % 2 === 0) {
frameType = 'B'
}
return { index: idx, frameType, contentFrom: idx }
})
}

export const buildContextForClip = (clip: TimelineClip, fps: number): MoshContext => {
const durationFrames = Math.max(0, clip.endFrame - clip.startFrame)
return {
frames: buildSyntheticFrames(durationFrames, fps),
fps,
durationFrames,
}
}

/**

* Map the per-scope mosh graphs into a RenderSettings.datamosh config
* understood by the export service.
*
* This is called in startRenderJob() before posting to the backend.
* It must be a pure function and must not mutate `project` or `settings`.
  */
  export const applyMoshGraphsToRenderSettings = (
  project: Project,
  settings: RenderSettings,
  ): RenderSettings => {
  // Start from whatever the export UI / default has configured.
  const baseDatamosh = (settings.datamosh ?? { mode: 'none' }) as NonNullable<
  RenderSettings['datamosh']

>

// Global bypass: force exports to be non-moshed.
if (project.moshBypassGlobal) {
return {
...settings,
datamosh: {
...baseDatamosh,
mode: 'none',
},
}
}

const graphs = collectAllGraphs(project)
if (graphs.length === 0) {
return {
...settings,
datamosh: {
...baseDatamosh,
mode: 'none',
},
}
}

const activeOps = new Set(extractActiveMoshOperations(graphs))
if (activeOps.size === 0) {
return {
...settings,
datamosh: {
...baseDatamosh,
mode: 'none',
},
}
}

// Simple first-pass mapping from graph ops → export datamosh mode.
// Align these string values with what the export service expects.
let mode: string = baseDatamosh.mode ?? 'none'

if (activeOps.has('ClassicDatamosh')) {
mode = 'classic'
} else if (activeOps.has('DropIntraFrames')) {
mode = 'classic'
} else if (activeOps.has('DropPredictedFrames')) {
mode = 'drop_predicted'
} else {
// Fallback: any other active node types → treat as classic mosh for now.
mode = 'classic'
}

return {
...settings,
datamosh: {
...baseDatamosh,
mode,
},
}
}
