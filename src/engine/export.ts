import { createFFmpeg, type FFmpeg } from '@ffmpeg/ffmpeg'
import type { RenderSettings, ContainerFormat } from './renderTypes'
import type { Project } from './types'

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

type FfmpegWithFs = FFmpeg & {
  FS: (op: 'readFile' | 'unlink', path: string) => Uint8Array | void
}

type ProgressEvent = { ratio?: number; progress?: number }

type FfmpegWithProgress = FFmpeg & {
  setProgress?: (handler: (progress: ProgressEvent) => void) => void
  on?: (event: 'progress', handler: (progress: ProgressEvent) => void) => void
  off?: (event: 'progress', handler: (progress: ProgressEvent) => void) => void
}

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance

  if (import.meta.env.DEV) {
    console.info('[dmosh] getFFmpeg: creating instance')
  }

  const ffmpeg = createFFmpeg({ log: true })

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

/**
 * For now, timeline export uses a lavfi color stub.
 * This gives us a real, non-empty MP4 without implementing full timeline rendering yet.
 */
function buildTimelineStubArgs(settings: RenderSettings, outputName: string): string[] {
  const width = settings.width ?? 640
  const height = settings.height ?? 360
  const fps = settings.fps ?? 24
  const durationSeconds = 1

  const args: string[] = [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=black:s=${width}x${height}:r=${fps}:d=${durationSeconds.toFixed(3)}`,
    '-pix_fmt',
    settings.pixelFormat ?? 'yuv420p',
  ]

  if (settings.videoCodec === 'h265') {
    args.push('-c:v', 'libx265')
  } else if (settings.videoCodec === 'vp9') {
    args.push('-c:v', 'libvpx-vp9')
  } else {
    args.push('-c:v', 'libx264')
  }

  if (settings.container === 'mp4' || settings.container === 'mov') {
    args.push('-movflags', '+faststart')
  }

  // We don’t synthesize audio yet
  args.push('-an', outputName)
  return args
}

function attachProgress(ffmpeg: FFmpeg, onProgress?: (value: number) => void): () => void {
  if (!onProgress) return () => {}

  const ffmpegWithProgress = ffmpeg as FfmpegWithProgress

  const handler = ({ ratio, progress }: ProgressEvent) => {
    const raw = ratio ?? progress ?? 0
    const value = Math.max(0, Math.min(100, raw * 100))
    onProgress(value)
  }

  if (typeof ffmpegWithProgress.setProgress === 'function') {
    ffmpegWithProgress.setProgress(handler)
    return () => {
      ffmpegWithProgress.setProgress?.(() => {})
    }
  }

  if (typeof ffmpegWithProgress.on === 'function') {
    ffmpegWithProgress.on('progress', handler)
    return () => {
      ffmpegWithProgress.off?.('progress', handler)
    }
  }

  return () => {}
}

export async function exportTimeline(
  project: Project,
  settings: RenderSettings,
  handlers: ExportProgressHandlers = {},
): Promise<ExportResult> {
  const { onProgress, signal } = handlers

  const sourceKind = settings.source.kind
  const supportsTimelineStub = ['timeline', 'project', 'source', 'clip'].includes(sourceKind)

  if (!supportsTimelineStub) {
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

  if (signal?.aborted) {
    throw new Error('Export cancelled')
  }

  const ffmpeg = await getFFmpeg()

  if (import.meta.env.DEV) {
    console.info('[dmosh] exportTimeline: ffmpeg loaded')
  }

  const outputName = `out.${settings.fileExtension || settings.container || 'mp4'}`
  const args = buildTimelineStubArgs(settings, outputName)
  const mimeType = resolveMimeType(settings.container)

  const restoreProgress = attachProgress(ffmpeg, onProgress)

  try {
    if (import.meta.env.DEV) {
      console.info('[dmosh] exportTimeline: ffmpeg.run', { args })
    }

    await ffmpeg.run(...args)

    if (import.meta.env.DEV) {
      console.info('[dmosh] exportTimeline: ffmpeg run completed')
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[dmosh] exportTimeline: run failed', err)
    }
    throw new Error(err instanceof Error ? err.message : 'Export failed')
  } finally {
    restoreProgress()
  }

  if (signal?.aborted) {
    throw new Error('Export cancelled')
  }

  if (import.meta.env.DEV) {
    console.info('[dmosh] exportTimeline: FS readFile', { outputName })
  }

  const ffmpegWithFs = ffmpeg as FfmpegWithFs
  const data = ffmpegWithFs.FS('readFile', outputName) as Uint8Array | undefined

  if (import.meta.env.DEV) {
    console.info('[dmosh] exportTimeline: FS readFile done', {
      outputName,
      length: data?.length ?? 0,
    })
  }

  if (!data || data.length === 0) {
    const msg = `FFmpeg returned empty output for ${outputName}`
    if (import.meta.env.DEV) {
      console.error('[dmosh] exportTimeline: empty output', {
        outputName,
        container: settings.container,
        videoCodec: settings.videoCodec,
        width: settings.width,
        height: settings.height,
        fpsMode: settings.fpsMode,
        fps: settings.fps,
      })
    }
    throw new Error(msg)
  }

  const blob = new Blob([data], { type: mimeType })
  const fileName = `${settings.fileName}.${settings.fileExtension ?? settings.container}`

  if (import.meta.env.DEV) {
    console.info('[dmosh] exportTimeline: success', {
      fileName,
      mimeType,
      blobSize: blob.size,
    })
  }

  try {
    ffmpegWithFs.FS('unlink', outputName)
  } catch {
    // ignore cleanup errors
  }

  return {
    blob,
    mimeType,
    fileName,
  }
}
