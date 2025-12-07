/**
 * Scope of a mosh operation within the edit.
 */
export type MoshScope =
  | 'clip'
  | 'track'
  | 'timeline'

/**
 * Primitive, lab-grade datamosh operation identifiers.
 */
export type MoshPrimitiveOpKind =
  | 'DropIntraFrames'
  | 'DropPredictedFrames'
  | 'HoldReferenceFrame'
  | 'RedirectReferences'
  | 'TransformMotionVectors'
  | 'DropPackets'
  | 'CorruptPackets'
  // Controllers
  | 'ControlEnvelope'
  | 'ControlLFO'
  | 'ControlNoise'
  | 'ControlFollowParameter'

/**
 * Composite operation identifiers built from primitive nodes.
 */
export type MoshCompositeOpId = 'ClassicDatamosh'

/**
 * All supported mosh operation identifiers.
 */
export type MoshOperationKind = MoshPrimitiveOpKind | MoshCompositeOpId
