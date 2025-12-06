import { FFmpeg } from '@ffmpeg/ffmpeg'
import type { RenderSettings, AudioCodec, ContainerFormat, VideoCodec } from './renderTypes'
import type { Project, TimelineClip } from './types'

export interface ExportProgressHandlers {
  onProgress?: (value: number) => void
  signal?: AbortSignal
}

export interface ExportResult {
  blob: Blob
  mimeType: string
  fileName: string
}

let ffmpegInstance: FFmpeg | null = null

const VIDEO_CODEC_MAP: Record<VideoCodec, string> = {
  h264: 'libx264',
  h265: 'libx265',
  vp9: 'libvpx-vp9',
  av1: 'libaom-av1',
  prores_422: 'prores_ks',
  prores_422_hq: 'prores_ks',
}

const AUDIO_CODEC_MAP: Record<AudioCodec, string> = {
  aac: 'aac',
  pcm_s16le: 'pcm_s16le',
  opus: 'libopus',
  none: 'none',
}

const MIN_FALLBACK_DURATION_SECONDS = 1

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance

  if (import.meta.env.DEV) {
    console.info('[dmosh] getFFmpeg: creating instance')
  }

  const ffmpeg = new FFmpeg()

  try {
    await ffmpeg.load()
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[dmosh] getFFmpeg: load failed', err)
    }
    throw err
  }

  ffmpegInstance = ffmpeg

  if (import.meta.env.DEV) {
    console.info('[dmosh] getFFmpeg: load completed')
  }

  return ffmpeg
}


function resolveMimeType(container: ContainerFormat): string {
  if (container === 'mov') return 'video/quicktime'
  if (container === 'webm') return 'video/webm'
  if (container === 'mkv') return 'video/x-matroska'
  return 'video/mp4'
}

function resolveDimensions(project: Project, settings: RenderSettings): { width: number; height: number } {
  const baseWidth = settings.outputResolution === 'custom' ? settings.width ?? project.settings.width : project.settings.width
  const baseHeight = settings.outputResolution === 'custom' ? settings.height ?? project.settings.height : project.settings.height

  const scale = settings.renderResolutionScale ?? 1
  const width = Math.max(1, Math.round(baseWidth * scale))
  const height = Math.max(1, Math.round(baseHeight * scale))
  return { width, height }
}

function resolveFps(project: Project, settings: RenderSettings): number {
  if (settings.fpsMode === 'override' && settings.fps) return settings.fps
  return settings.fpsMode === 'project' ? project.timeline.fps : project.settings.fps
}

function clipDurationInFrames(clip: TimelineClip): number {
  return Math.max(0, clip.endFrame - clip.startFrame)
}

function computeTimelineDurationSeconds(project: Project, fps: number): number {
  if (!project.timeline.clips.length) return MIN_FALLBACK_DURATION_SECONDS

  const lastFrame = project.timeline.clips.reduce((acc, clip) => {
    const clipLength = clipDurationInFrames(clip)
    return Math.max(acc, clip.timelineStartFrame + clipLength)
  }, 0)

  const durationSeconds = lastFrame > 0 ? lastFrame / fps : MIN_FALLBACK_DURATION_SECONDS
  return Math.max(MIN_FALLBACK_DURATION_SECONDS, durationSeconds)
}

function mapVideoCodec(codec: VideoCodec): string {
  return VIDEO_CODEC_MAP[codec] ?? 'libx264'
}

function mapAudioCodec(codec: AudioCodec): string | null {
  if (codec === 'none') return null
  return AUDIO_CODEC_MAP[codec] ?? 'aac'
}

function buildFfmpegArgs(
  settings: RenderSettings,
  outputName: string,
  opts: { width: number; height: number; fps: number; durationSeconds: number; includeAudio: boolean },
): string[] {
  const videoCodec = mapVideoCodec(settings.videoCodec)
  const pixelFormat = settings.pixelFormat || 'yuv420p'
  const audioCodec = mapAudioCodec(settings.audioCodec)

  const args: string[] = [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=black:s=${opts.width}x${opts.height}:r=${opts.fps}:d=${opts.durationSeconds.toFixed(3)}`,
  ]

  if (opts.includeAudio && audioCodec) {
    const channels = settings.audioChannels === 1 ? 'mono' : 'stereo'
    args.push('-f', 'lavfi', '-i', `anullsrc=r=${settings.audioSampleRate}:cl=${channels}`)
  }

  args.push('-pix_fmt', pixelFormat, '-c:v', videoCodec, '-movflags', '+faststart')

  if (opts.includeAudio && audioCodec) {
    args.push('-shortest', '-c:a', audioCodec)
  } else {
    args.push('-an')
  }

  args.push('-t', opts.durationSeconds.toFixed(3), outputName)
  return args
}

export async function exportTimeline(
  project: Project,
  settings: RenderSettings,
  handlers: ExportProgressHandlers = {},
): Promise<ExportResult> {
  const { onProgress, signal } = handlers

  if (import.meta.env.DEV) {
    console.info('[dmosh] exportTimeline: start', {
      projectId: (project as { id?: string }).id ?? null,
      source: settings.source,
      container: settings.container,
      videoCodec: settings.videoCodec,
      audioCodec: settings.audioCodec,
      width: settings.width,
      height: settings.height,
      fpsMode: settings.fpsMode,
      fps: settings.fps,
    })
  }

  if (settings.container === 'mp4' && settings.videoCodec === 'prores_422') {
    throw new Error('ProRes is not supported in MP4 container')
  }

  if (signal?.aborted) {
    throw new Error('Export cancelled')
  }

  const ffmpeg = await getFFmpeg()

  if (import.meta.env.DEV) {
    console.info('[dmosh] exportTimeline: ffmpeg loaded')
  }

  const { width, height } = resolveDimensions(project, settings)
  const fps = resolveFps(project, settings)
  const durationSeconds = computeTimelineDurationSeconds(project, fps)
  const outputName = `export.${settings.fileExtension || settings.container}`

  const progressHandler = onProgress
    ? ({ progress }: { progress: number }) => {
        const value = Math.max(0, Math.min(100, progress * 100))
        onProgress(value)
      }
    : null

  if (progressHandler) {
    ffmpeg.on('progress', progressHandler)
  }

  const includeAudio = settings.includeAudio && settings.audioCodec !== 'none'
  const args = buildFfmpegArgs(settings, outputName, { width, height, fps, durationSeconds, includeAudio })

  const mimeType = resolveMimeType(settings.container)

  try {
    if (import.meta.env.DEV) {
      console.info('[dmosh] exportTimeline: ffmpeg.run', { args })
    }

    const exitCode = await ffmpeg.exec(args)

    if (import.meta.env.DEV) {
      console.info('[dmosh] exportTimeline: ffmpeg.run completed')
    }
    if (exitCode !== 0) {
      throw new Error('Export failed')
    }
  } catch (err) {
    if (progressHandler) {
      ffmpeg.off('progress', progressHandler)
    }
    if (import.meta.env.DEV) {
      console.error('[dmosh] exportTimeline: run failed', err)
    }
    throw new Error(err instanceof Error ? err.message : 'Export failed')
  }

  if (progressHandler) {
    ffmpeg.off('progress', progressHandler)
  }

  if (signal?.aborted) {
    throw new Error('Export cancelled')
  }

  if (import.meta.env.DEV) {
    console.info('[dmosh] exportTimeline: readFile', { outputName })
  }

  const data = await ffmpeg.readFile(outputName)

  if (import.meta.env.DEV) {
    console.info('[dmosh] exportTimeline: readFile done', {
      outputName,
      length: data?.length ?? 0,
    })
  }

  const fileData = typeof data === 'string' ? new TextEncoder().encode(data) : data

  if (!fileData || fileData.length === 0) {
    const msg = `FFmpeg returned empty output for ${outputName}`
    if (import.meta.env.DEV) {
      console.error('[dmosh] exportTimeline: empty output', {
        outputName,
        container: settings.container,
        videoCodec: settings.videoCodec,
        width,
        height,
        fps,
        durationSeconds,
      })
    }
    throw new Error(msg)
  }

  // Simple, avoids any subtle buffer slicing issues
  const blob = new Blob([fileData], { type: mimeType })

  const fileName = `${settings.fileName}.${settings.fileExtension ?? settings.container}`

  if (import.meta.env.DEV) {
    console.info('[dmosh] exportTimeline: success', {
      fileName,
      mimeType,
      blobSize: blob.size,
    })
  }

  try {
    await ffmpeg.deleteFile(outputName)
  } catch {
    /* ignore cleanup errors */
  }

  return {
    blob,
    mimeType,
    fileName,
  }
}
