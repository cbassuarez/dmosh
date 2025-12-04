/// <reference lib="webworker" />
import { Project } from '../types'
import { EngineProgress, EngineWorkerError, PreviewScale, RenderSettings } from '../engine'

type SerializedProject = Project

type MainToWorkerMessage =
  | { type: 'INIT' }
  | { type: 'LOAD_PROJECT'; project: SerializedProject }
  | { type: 'ANALYZE' }
  | { type: 'RENDER_FRAME'; timelineFrame: number; previewScale: PreviewScale }
  | { type: 'EXPORT_VIDEO'; settings: RenderSettings }
  | { type: 'CANCEL_EXPORT' }

type WorkerToMainMessage =
  | { type: 'READY' }
  | { type: 'ANALYZE_PROGRESS'; phase: 'normalizing' | 'indexing'; progress: number; message?: string }
  | { type: 'ANALYZE_DONE' }
  | { type: 'ANALYZE_ERROR'; error: EngineWorkerError }
  | { type: 'FRAME_RENDERED'; timelineFrame: number; previewScale: PreviewScale; image: ImageBitmap }
  | { type: 'EXPORT_PROGRESS'; phase: 'normalizing' | 'encoding'; progress: number; message?: string }
  | { type: 'EXPORT_DONE'; blob: Blob }
  | { type: 'EXPORT_ERROR'; error: EngineWorkerError }

declare const self: DedicatedWorkerGlobalScope

let currentProject: Project | null = null
let exportCancelled = false

const post = (message: WorkerToMainMessage, transfer: Transferable[] = []) => {
  self.postMessage(message, transfer)
}

const createPlaceholderFrame = async (width: number, height: number): Promise<ImageBitmap> => {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#38bdf8'
    ctx.fillText('Rendering…', 12, 24)
  }
  return canvas.transferToImageBitmap()
}

const computeScale = (base: { width: number; height: number }, scale: PreviewScale) => {
  if (scale === 'half') return { width: Math.max(1, Math.floor(base.width / 2)), height: Math.max(1, Math.floor(base.height / 2)) }
  if (scale === 'quarter')
    return { width: Math.max(1, Math.floor(base.width / 4)), height: Math.max(1, Math.floor(base.height / 4)) }
  return base
}

self.addEventListener('message', async (event: MessageEvent<MainToWorkerMessage>) => {
  const msg = event.data
  if (msg.type === 'INIT') {
    post({ type: 'READY' })
    return
  }

  if (msg.type === 'LOAD_PROJECT') {
    currentProject = msg.project
    return
  }

  if (msg.type === 'ANALYZE') {
    if (!currentProject) {
      post({ type: 'ANALYZE_ERROR', error: { code: 'INVALID_PROJECT', message: 'No project loaded' } })
      return
    }
    post({ type: 'ANALYZE_PROGRESS', phase: 'normalizing', progress: 0.25, message: 'Preparing sources' })
    post({ type: 'ANALYZE_PROGRESS', phase: 'indexing', progress: 0.5, message: 'Indexing mock frames' })
    post({ type: 'ANALYZE_DONE' })
    return
  }

  if (msg.type === 'RENDER_FRAME') {
    if (!currentProject) return
    const { width, height } = computeScale(currentProject.settings, msg.previewScale)
    const frame = await createPlaceholderFrame(width, height)
    post(
      { type: 'FRAME_RENDERED', timelineFrame: msg.timelineFrame, previewScale: msg.previewScale, image: frame },
      [frame],
    )
    return
  }

  if (msg.type === 'EXPORT_VIDEO') {
    if (!currentProject) {
      post({ type: 'EXPORT_ERROR', error: { code: 'INVALID_PROJECT', message: 'No project loaded' } })
      return
    }
    exportCancelled = false
    const progress: EngineProgress = { phase: 'encoding', progress: 0, message: 'Encoding mock video' }
    for (let i = 0; i < 3; i += 1) {
      if (exportCancelled) {
        post({ type: 'EXPORT_ERROR', error: { code: 'EXPORT_FAILED', message: 'Export cancelled by user' } })
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
      progress.progress = (i + 1) / 3
      post({ type: 'EXPORT_PROGRESS', phase: 'encoding', progress: progress.progress, message: progress.message })
    }
    const blob = new Blob(['mock-video'], { type: 'video/mp4' })
    post({ type: 'EXPORT_DONE', blob })
    return
  }

  if (msg.type === 'CANCEL_EXPORT') {
    exportCancelled = true
  }
})
