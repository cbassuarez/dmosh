// src/engine/projectTypes.ts

export type FrameType = "I" | "P" | "B";

export interface SourceAsset {
  id: string; // content hash or UUID
  fileName: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
}

export interface FrameIndexEntry {
  index: number;
  ptsSec: number;
  type: FrameType;
}

export interface ClipRef {
  id: string;
  sourceId: string;
  inSec: number;
  outSec: number;
  startSec: number; // position on master timeline
}

export type MaskShapeType = "rect" | "ellipse";

export interface MaskKeyframe {
  timeSec: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg: number;
}

export interface MaskDefinition {
  id: string;
  name: string;
  shape: MaskShapeType;
  invert: boolean; // true = mosh outside
  keyframes: MaskKeyframe[];
}

export type MotionTransformParam =
  | "scale"
  | "jitter"
  | "quantize"
  | "driftX"
  | "driftY";

export interface CurvePoint {
  timeSec: number;
  value: number;
}

export interface ParameterCurve {
  id: string;
  param: MotionTransformParam;
  points: CurvePoint[];
}

export type OperationType =
  | "DropIFrames"
  | "FreezeReference"
  | "RedirectPredictedFrames"
  | "HoldSmear"
  | "MotionVectorTransform";

export interface BaseOperation {
  id: string;
  type: OperationType;
  startSec: number;
  endSec: number;
  maskId?: string; // optional spatial constraint
}

export interface DropIFramesOperation extends BaseOperation {
  type: "DropIFrames";
}

export interface FreezeReferenceOperation extends BaseOperation {
  type: "FreezeReference";
  anchorTimeSec: number;
}

export interface RedirectPredictedFramesOperation extends BaseOperation {
  type: "RedirectPredictedFrames";
  fromClipId: string;
  toClipId: string;
}

export interface HoldSmearOperation extends BaseOperation {
  type: "HoldSmear";
  anchorTimeSec: number;
}

export interface MotionVectorTransformOperation extends BaseOperation {
  type: "MotionVectorTransform";
  curves: string[]; // references to ParameterCurve ids
}

export type Operation =
  | DropIFramesOperation
  | FreezeReferenceOperation
  | RedirectPredictedFramesOperation
  | HoldSmearOperation
  | MotionVectorTransformOperation;

export interface DmoshProject {
  version: "0.1.0";
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sources: SourceAsset[];
  clips: ClipRef[];
  masks: MaskDefinition[];
  curves: ParameterCurve[];
  operations: Operation[];
  renderSettings: {
    codecProfile: "web" | "nle";
    resolutionStrategy: "original" | "downscale";
  };
}

