export type ViewerMode = 'original' | 'moshed' | 'compare'

export type ViewerResolution = 'full' | 'half' | 'quarter'

export interface ViewerOverlays {
  safeArea: boolean
  grid: boolean
  timecode: boolean
  clipName: boolean
  masks: boolean
  motionVectors: boolean
  glitchIntensity: boolean
}

export interface ViewerState {
  mode: ViewerMode
  resolution: ViewerResolution
  overlays: ViewerOverlays
}

export interface ViewerRuntimeSettings {
  previewMaxHeight?: number
  /** When true, preview ignores mosh graphs for playback. */
  bypassMosh?: boolean
}
