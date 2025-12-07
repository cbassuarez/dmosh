import type { RenderSettings, ContainerFormat } from './renderTypes'
import type { MoshPipeline } from '../mosh/moshPipeline'
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

// Minimal FFmpeg instance surface we rely on
type FfmpegFactoryOptions = {
log?: boolean
corePath?: string
}

type FfmpegProgressPayload = {
ratio?: number
progress?: number
}

type FfmpegInstance = {
load: () => Promise<void>

// Old API
run?: (...args: string[]) => Promise<unknown>
FS?: (op: 'readFile' | 'unlink', path: string) => Uint8Array | void

// New API
exec?: (args: string[], options?: { signal?: AbortSignal }) => Promise<unknown>
readFile?: (path: string) => Uint8Array | Promise<Uint8Array>
deleteFile?: (path: string) => Promise<void> | void

// Progress APIs (we support both shapes)
on?: (event: 'progress', handler: (payload: FfmpegProgressPayload) => void) => void
off?: (event: 'progress', handler: (payload: FfmpegProgressPayload) => void) => void
setProgress?: (handler: (payload: FfmpegProgressPayload) => void) => void
}

type FfmpegFactory = (options?: FfmpegFactoryOptions) => FfmpegInstance

type FfmpegModuleLike = {
default?: unknown
createFFmpeg?: unknown
FFmpeg?: unknown
}

// Cached singleton
let ffmpegInstance: FfmpegInstance | null = null

async function getFFmpeg(): Promise<FfmpegInstance> {
if (ffmpegInstance) return ffmpegInstance

if (import.meta.env.DEV) {
console.info('[dmosh] getFFmpeg: creating instance')
}

const imported = (await import('@ffmpeg/ffmpeg')) as unknown
const mod = imported as FfmpegModuleLike & Record<string, unknown>

let factory: FfmpegFactory | null = null

// 1) Named createFFmpeg export
if (typeof mod.createFFmpeg === 'function') {
factory = mod.createFFmpeg as FfmpegFactory
}
// 2) Default object with createFFmpeg
else if (
mod.default &&
typeof (mod.default as { createFFmpeg?: unknown }).createFFmpeg === 'function'
) {
const d = mod.default as { createFFmpeg: FfmpegFactory }
factory = d.createFFmpeg
}
// 3) FFmpeg class
else if (typeof mod.FFmpeg === 'function') {
const Ctor = mod.FFmpeg as new (options?: FfmpegFactoryOptions) => FfmpegInstance
factory = (options?: FfmpegFactoryOptions) => new Ctor(options)
}
// 4) Default factory function
else if (typeof mod.default === 'function') {
factory = mod.default as FfmpegFactory
}

if (!factory) {
if (import.meta.env.DEV) {
const defaultVal = mod.default
console.error('[dmosh] getFFmpeg: unable to locate FFmpeg factory', {
keys: Object.keys(mod),
defaultType: typeof defaultVal,
defaultKeys:
defaultVal && typeof defaultVal === 'object'
? Object.keys(defaultVal as Record<string, unknown>)
: null,
})
}
throw new Error('Unable to locate FFmpeg factory in @ffmpeg/ffmpeg module')
}

const instance = factory({ log: true })

try {
await instance.load()
} catch (err) {
if (import.meta.env.DEV) {
console.error('[dmosh] getFFmpeg: load failed', err)
}
throw err
}

ffmpegInstance = instance

if (import.meta.env.DEV) {
console.info('[dmosh] getFFmpeg: load completed')
}

return instance
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
  const hasIntraDrop = (pipeline?: MoshPipeline): boolean => {
    if (!pipeline || pipeline.globalBypass) return false
    const scope = pipeline.scopes.find((s) => s.scope === 'timeline')
    if (!scope) return false
    return scope.chain.some(
      (node) =>
        node.enabled && (node.kind === 'DropIntraFrames' || node.kind === 'ClassicDatamosh'),
    )
  }

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

  if (hasIntraDrop(settings.moshPipeline)) {
    args.push('-g', '9999', '-sc_threshold', '0')
  }

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

function attachProgress(
ffmpeg: FfmpegInstance,
onProgress?: (value: number) => void,
): () => void {
if (!onProgress) return () => {}

const handler = ({ ratio, progress }: FfmpegProgressPayload): void => {
const raw = ratio ?? progress ?? 0
const value = Math.max(0, Math.min(100, raw * 100))
onProgress(value)
}

// Newer API: setProgress(handler)
if (typeof ffmpeg.setProgress === 'function') {
ffmpeg.setProgress(handler)
return () => {
ffmpeg.setProgress?.((payload: FfmpegProgressPayload) => {
// consume payload so it isn't unused
void payload
})
}
}

// Older API: on('progress', handler) / off('progress', handler)
if (typeof ffmpeg.on === 'function') {
ffmpeg.on('progress', handler)
return () => {
ffmpeg.off?.('progress', handler)
}
}

// No-op if no progress API available
return () => {}
}

async function runFfmpeg(args: string[], ffmpeg: FfmpegInstance, signal?: AbortSignal) {
// Prefer newer exec API
if (typeof ffmpeg.exec === 'function') {
if (signal) {
await ffmpeg.exec(args, { signal })
} else {
await ffmpeg.exec(args)
}
return
}

// Fallback to older run API
if (typeof ffmpeg.run === 'function') {
await ffmpeg.run(...args)
return
}

throw new Error('FFmpeg instance does not provide exec or run')
}

async function readOutput(ffmpeg: FfmpegInstance, outputName: string): Promise<Uint8Array> {
// Newer readFile API
if (typeof ffmpeg.readFile === 'function') {
const value = await ffmpeg.readFile(outputName)
if (value instanceof Uint8Array) return value
return new Uint8Array(value)
}

// Older FS API
if (typeof ffmpeg.FS === 'function') {
const result = ffmpeg.FS('readFile', outputName)
if (result instanceof Uint8Array) return result
throw new Error('FFmpeg.FS("readFile") did not return Uint8Array')
}

throw new Error('FFmpeg instance does not provide readFile or FS("readFile")')
}

async function cleanupOutput(ffmpeg: FfmpegInstance, outputName: string): Promise<void> {
try {
if (typeof ffmpeg.deleteFile === 'function') {
await ffmpeg.deleteFile(outputName)
} else if (typeof ffmpeg.FS === 'function') {
ffmpeg.FS('unlink', outputName)
}
} catch {
// ignore cleanup errors
}
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

const restoreProgress = attachProgress(ffmpeg, onProgress ?? undefined)

try {
if (import.meta.env.DEV) {
console.info('[dmosh] exportTimeline: ffmpeg.run/exec', { args })
}


await runFfmpeg(args, ffmpeg, signal)

if (import.meta.env.DEV) {
  console.info('[dmosh] exportTimeline: ffmpeg.run/exec completed')
}

} catch (err) {
restoreProgress()
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
console.info('[dmosh] exportTimeline: readOutput', { outputName })
}

const data = await readOutput(ffmpeg, outputName)

if (import.meta.env.DEV) {
console.info('[dmosh] exportTimeline: readOutput done', {
outputName,
length: data.length,
})
}

if (data.length === 0) {
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

await cleanupOutput(ffmpeg, outputName)

return {
blob,
mimeType,
fileName,
}
}
