import type { FFmpeg } from '@ffmpeg/ffmpeg'
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

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance

  if (import.meta.env.DEV) {
    console.info('[dmosh] getFFmpeg: creating instance')
  }

  // Dynamic import; we’ll handle multiple possible shapes
  const mod: unknown = await import('@ffmpeg/ffmpeg')

  // We’ll treat the module as `any` for construction, then cast to FFmpeg
  const anyMod = mod as {
    createFFmpeg?: (options?: { log?: boolean; corePath?: string }) => unknown
    FFmpeg?: new (options?: { log?: boolean; corePath?: string }) => unknown
    default?: unknown
  }

  let instance: unknown

  // 1) Named `createFFmpeg` export: { createFFmpeg }
  if (typeof anyMod.createFFmpeg === 'function') {
    instance = anyMod.createFFmpeg({ log: true })
  }
  // 2) Named FFmpeg class: { FFmpeg } – construct directly
  else if (typeof anyMod.FFmpeg === 'function') {
    instance = new anyMod.FFmpeg({ log: true })
  }
  // 3) Default object with createFFmpeg: { default: { createFFmpeg } }
  else if (
    anyMod.default &&
    typeof anyMod.default === 'object' &&
    'createFFmpeg' in anyMod.default &&
    typeof (anyMod.default as { createFFmpeg?: (options?: { log?: boolean }) => unknown }).createFFmpeg === 'function'
  ) {
    instance = (anyMod.default as { createFFmpeg: (options?: { log?: boolean }) => unknown }).createFFmpeg({ log: true })
  }
  // 4) Default function: { default: function } – treat as constructor/factory
  else if (typeof anyMod.default === 'function') {
    instance = (anyMod.default as (options?: { log?: boolean }) => unknown)({ log: true })
  } else {
    // If we get here, the module shape is genuinely unexpected
    if (import.meta.env.DEV) {
      const asObj = anyMod as Record<string, unknown>
      const defaultVal = asObj.default as unknown
      console.error('[dmosh] getFFmpeg: unrecognized @ffmpeg/ffmpeg module shape', {
        keys: Object.keys(asObj),
        defaultType: typeof defaultVal,
        defaultKeys:
          defaultVal && typeof defaultVal === 'object'
            ? Object.keys(defaultVal as Record<string, unknown>)
            : null,
      })
    }
    throw new Error('Unable to construct FFmpeg instance from @ffmpeg/ffmpeg module')
  }

  // At this point `instance` should quack like an FFmpeg: has `load`, `run`, `FS`, etc.
  const ffmpeg = instance as FFmpeg

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

    // Wire progress if the runtime supports it
    type FFmpegWithProgress = FFmpeg & {
      setProgress?: (handler: { ratio?: number; progress?: number }) => void
    }

    const ffmpegWithProgress = ffmpeg as FFmpegWithProgress
    let restoreProgress: (() => void) | null = null

    if (onProgress && typeof ffmpegWithProgress.setProgress === 'function') {
      const handler = ({ ratio, progress }: { ratio?: number; progress?: number }) => {
        const raw = ratio ?? progress ?? 0
        const value = Math.max(0, Math.min(100, raw * 100))
        onProgress(value)
      }
      ffmpegWithProgress.setProgress(handler)
      restoreProgress = () => {
        // Reset to a no-op to avoid leaking callbacks between jobs
        ffmpegWithProgress.setProgress?.(() => {})
      }
    }

    try {
      if (import.meta.env.DEV) {
        console.info('[dmosh] exportTimeline: ffmpeg.run/exec', { args })
      }

      type FfmpegRuntime = FFmpeg & {
        run?: (...argv: string[]) => Promise<void>
        exec?: (argv: string[]) => Promise<void>
      }

      const runtime = ffmpeg as unknown as FfmpegRuntime

      if (typeof runtime.run === 'function') {
        await runtime.run(...args)
      } else if (typeof runtime.exec === 'function') {
        // Some builds expose only `exec(args)`
        await runtime.exec(args)
      } else {
        throw new Error('FFmpeg instance has neither run nor exec')
      }

      if (import.meta.env.DEV) {
        console.info('[dmosh] exportTimeline: ffmpeg run/exec completed')
      }
    } catch (err) {
      if (restoreProgress) restoreProgress()
      if (import.meta.env.DEV) {
        console.error('[dmosh] exportTimeline: run/exec failed', err)
      }
      throw new Error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      if (restoreProgress) restoreProgress()
    }

  if (signal?.aborted) {
    throw new Error('Export cancelled')
  }

  if (import.meta.env.DEV) {
    console.info('[dmosh] exportTimeline: FS readFile', { outputName })
  }

  const data = ffmpeg.FS('readFile', outputName) as Uint8Array | undefined

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
    ffmpeg.FS('unlink', outputName)
  } catch {
    // ignore cleanup errors
  }

  return {
    blob,
    mimeType,
    fileName,
  }
}
