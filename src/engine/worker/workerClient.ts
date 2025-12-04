import { useEffect, useState } from 'react'
import { EngineProgress, EngineWorkerError, PreviewScale, RenderSettings, VideoEngine } from '../engine'
import { Project } from '../types'

const isBrowserWorkerAvailable = typeof Worker !== 'undefined'

const createMockBitmap = (): ImageBitmap => ({ width: 1, height: 1 } as ImageBitmap)

class WorkerEngine implements VideoEngine {
  private worker: Worker | null = null

  private ready: Promise<void>

  constructor() {
    if (isBrowserWorkerAvailable) {
      this.worker = new Worker(new URL('./videoEngine.worker.ts', import.meta.url), { type: 'module' })
    }
    this.ready = new Promise((resolve) => {
      if (!this.worker) {
        resolve()
        return
      }
      const onMessage = (event: MessageEvent) => {
        if ((event.data as { type?: string }).type === 'READY') {
          this.worker?.removeEventListener('message', onMessage)
          resolve()
        }
      }
      this.worker.addEventListener('message', onMessage)
      this.worker.postMessage({ type: 'INIT' })
    })
  }

  private async ensureReady() {
    await this.ready
  }

  private send(message: unknown) {
    if (!this.worker) return
    this.worker.postMessage(message)
  }

  private once<T = MessageEvent>(predicate: (data: unknown) => boolean): Promise<T> {
    return new Promise((resolve) => {
      if (!this.worker) {
        resolve({ data: null } as T)
        return
      }
      const handler = (event: MessageEvent) => {
        if (predicate(event.data)) {
          this.worker?.removeEventListener('message', handler)
          resolve(event as T)
        }
      }
      this.worker.addEventListener('message', handler)
    })
  }

  async loadProject(project: Project): Promise<void> {
    await this.ensureReady()
    this.send({ type: 'LOAD_PROJECT', project })
  }

  async analyze(): Promise<void> {
    await this.ensureReady()
    this.send({ type: 'ANALYZE' })
    await this.once((data) => (data as { type?: string }).type === 'ANALYZE_DONE')
  }

  async renderFrame(timelineFrame: number, previewScale: PreviewScale): Promise<ImageBitmap> {
    await this.ensureReady()
    if (!this.worker) {
      return createMockBitmap()
    }
    this.send({ type: 'RENDER_FRAME', timelineFrame, previewScale })
    const event = await this.once<MessageEvent>((data) => (data as { type?: string }).type === 'FRAME_RENDERED')
    const image = (event.data as { image?: ImageBitmap }).image
    return image ?? createMockBitmap()
  }

  async exportVideo(settings: RenderSettings, onProgress: (p: EngineProgress) => void): Promise<Blob> {
    await this.ensureReady()
    if (!this.worker) return new Blob(['mock'], { type: 'video/mp4' })
    const progressHandler = (event: MessageEvent) => {
      const data = event.data as { type?: string; progress?: number; phase?: EngineProgress['phase']; message?: string }
      if (data.type === 'EXPORT_PROGRESS') {
        onProgress({ phase: data.phase ?? 'encoding', progress: data.progress ?? 0, message: data.message })
      }
    }
    this.worker.addEventListener('message', progressHandler)
    this.send({ type: 'EXPORT_VIDEO', settings })
    const event = await this.once<MessageEvent>((data) => (data as { type?: string }).type === 'EXPORT_DONE')
    this.worker.removeEventListener('message', progressHandler)
    const blob = (event.data as { blob?: Blob }).blob
    return blob ?? new Blob(['mock'], { type: 'video/mp4' })
  }
}

export const createVideoEngine = (): VideoEngine => new WorkerEngine()

export function useVideoEngine(): {
  engine: VideoEngine | null
  progress: EngineProgress
  lastError: EngineWorkerError | null
} {
  const [engine] = useState(() => createVideoEngine())
  const [progress, setProgress] = useState<EngineProgress>({ phase: 'idle', progress: 0 })
  const [lastError, setLastError] = useState<EngineWorkerError | null>(null)

  useEffect(() => {
    const worker = (engine as WorkerEngine)['worker']
    if (!worker) return undefined
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; phase?: EngineProgress['phase']; progress?: number; message?: string }
      if (data.type === 'ANALYZE_PROGRESS' || data.type === 'EXPORT_PROGRESS') {
        setProgress({ phase: data.phase ?? 'idle', progress: data.progress ?? 0, message: data.message })
      }
      if (data.type === 'ANALYZE_DONE' || data.type === 'EXPORT_DONE') {
        setProgress({ phase: 'idle', progress: 0 })
      }
      if (data.type === 'ANALYZE_ERROR' || data.type === 'EXPORT_ERROR') {
        setLastError((data as { error?: EngineWorkerError }).error ?? null)
        setProgress({ phase: 'idle', progress: 0 })
      }
    }
    worker.addEventListener('message', handler)
    return () => worker.removeEventListener('message', handler)
  }, [engine])

  return { engine, progress, lastError }
}
