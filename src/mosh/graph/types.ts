import type { MoshOperationKind, MoshScope } from '../ops/types'

export type MoshParamScalar = number | boolean | string
export type MoshParamVector = [number, number] | [number, number, number]
export type MoshParamValue = MoshParamScalar | MoshParamVector

export interface MoshParamKeyframe {
  /** Seconds in timeline space. */
  time: number
  value: MoshParamValue
  interpolation?: 'step' | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
}

export interface MoshParamState {
  /** Identifier for the parameter (stable, machine readable). */
  id: string
  /** UI label; clinical and concise. */
  label: string
  value: MoshParamValue
  keyframes?: MoshParamKeyframe[]
}

/**
 * Parameter link describing how a downstream parameter follows another value.
 * targetParam = sourceParam * scale + offset
 */
export interface MoshParamLink {
  id: string
  targetNodeId: string
  targetParamId: string
  sourceNodeId: string
  sourceParamId: string
  scale?: number
  offset?: number
}

export interface MoshNode {
  id: string
  kind: MoshOperationKind
  scope: MoshScope

  /** Clip-level targeting for clip-scoped nodes. */
  targetClipIds?: string[]
  /** Track-level targeting for track-scoped nodes. */
  targetTrackIds?: string[]

  /** Optional cosmetic label. */
  label?: string

  params: MoshParamState[]

  ui?: {
    x: number
    y: number
  }
}

export interface MoshEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  kind?: 'frame' | 'control'
}

export interface MoshGraph {
  id: string
  nodes: MoshNode[]
  edges: MoshEdge[]
  paramLinks: MoshParamLink[]
}

export type LegacyMoshGraph = MoshGraph
