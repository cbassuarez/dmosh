import { FFmpeg } from '@ffmpeg/ffmpeg'
import type { RenderSettings, ContainerFormat } from './renderTypes'
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
  const baseWidth =
    settings.outputResolution === 'custom'
      ? settings.width ?? project.settings.width
      : settings.width ?? project.settings.width
  const baseHeight =
    settings.outputResolution === 'custom'
      ? settings.height ?? project.settings.height
      : settings.height ?? project.settings.height

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

function buildTimelineStubArgs(
  project: Project,
  settings: RenderSettings,
  outputName: string,
): { args: string[]; width: number; height: number; fps: number; durationSeconds: number } {
  const { width, height } = resolveDimensions(project, settings)
  const fps = resolveFps(project, settings) || 24
  const durationSeconds = computeTimelineDurationSeconds(project, fps)
  const pixelFormat = settings.pixelFormat ?? 'yuv420p'

  const args: string[] = [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=black:s=${width}x${height}:r=${fps}:d=${durationSeconds.toFixed(3)}`,
    '-pix_fmt',
    pixelFormat,
  ]

  if (settings.videoCodec === 'h265') {
    args.push('-c:v', 'libx265')
  } else {
    args.push('-c:v', 'libx264')
  }

  if (settings.container === 'mp4' || settings.container === 'mov') {
    args.push('-movflags', '+faststart')
  }

  args.push('-an', '-t', durationSeconds.toFixed(3), outputName)

  return { args, width, height, fps, durationSeconds }
}

export async function exportTimeline(
  project: Project,
  settings: RenderSettings,
  handlers: ExportProgressHandlers = {},
): Promise<ExportResult> {
  const { onProgress, signal } = handlers

  if (settings.source.kind !== 'timeline') {
    throw new Error(`exportTimeline: source.kind "${settings.source.kind}" not implemented`)
  }

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

  const outputName = `out.${settings.fileExtension || settings.container}`

  const progressHandler = onProgress
    ? ({ progress }: { progress: number }) => {
        const value = Math.max(0, Math.min(100, progress * 100))
        onProgress(value)
      }
    : null

  if (progressHandler) {
    ffmpeg.on('progress', progressHandler)
  }

  const { args, width, height, fps, durationSeconds } = buildTimelineStubArgs(project, settings, outputName)

  const mimeType = resolveMimeType(settings.container)

  try {
    if (import.meta.env.DEV) {
      console.info('[dmosh] exportTimeline: ffmpeg.exec', { args })
    }

    const exitCode = await ffmpeg.exec(args)

    if (import.meta.env.DEV) {
      console.info('[dmosh] exportTimeline: ffmpeg.exec completed')
    }
    if (exitCode !== 0) {
      throw new Error('Export failed')
    }
  } catch (err) {
    if (progressHandler) {
      ffmpeg.off('progress', progressHandler)
    }
    if (import.meta.env.DEV) {
      console.error('[dmosh] exportTimeline: exec failed', err)
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
