export type ExportSource =
  | { kind: 'timeline'; inFrame?: number; outFrame?: number }
  | { kind: 'clip'; clipId: string }
  | { kind: 'source'; sourceId: string }

export type ContainerFormat = 'mp4' | 'mov' | 'mkv' | 'webm'
export type VideoCodec =
  | 'h264'
  | 'h265'
  | 'vp9'
  | 'av1'
  | 'prores_422'
  | 'prores_422_hq'
export type AudioCodec = 'aac' | 'pcm_s16le' | 'opus' | 'none'
export type PixelFormat = 'yuv420p' | 'yuv422p10le' | 'yuv444p10le'
export type RateControl =
  | { mode: 'crf'; value: number }
  | { mode: 'bitrate'; kbps: number }

export type RenderResolutionScale = 1 | 0.5 | 0.25

export interface RenderSettings {
  id: string
  projectId: string
  source: ExportSource

  // Output
  container: ContainerFormat
  videoCodec: VideoCodec
  audioCodec: AudioCodec
  outputResolution: 'project' | 'custom'
  width?: number
  height?: number
  fpsMode: 'project' | 'override'
  fps?: number
  pixelFormat: PixelFormat

  // Quality / rate control
  rateControl: RateControl
  keyframeInterval: number | 'auto'
  bFrames: number | 'auto'

  // Audio
  includeAudio: boolean
  audioSampleRate: 44100 | 48000
  audioChannels: 1 | 2

  // Datamosh-specific
  datamosh:
    | { mode: 'none' }
    | { mode: 'timeline'; operations: string[] }
  preserveBrokenGOP: boolean

  // Overlays / burn-ins
  burnInTimecode: boolean
  burnInClipName: boolean
  burnInMasks: boolean

  // Performance / preview
  renderResolutionScale: RenderResolutionScale
  previewOnly: boolean

  // Destination
  fileName: string
  fileExtension: string
}
