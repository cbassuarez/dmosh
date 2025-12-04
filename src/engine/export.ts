import type { Project } from './types'
import type { RenderSettings } from './renderTypes'

export interface ExportProgressHandlers {
  onProgress?: (value: number) => void
  signal?: AbortSignal
}

export interface ExportResult {
  blob: Blob
  mimeType: string
  fileName: string
}

export async function exportTimeline(
  project: Project,
  settings: RenderSettings,
  handlers: ExportProgressHandlers = {},
): Promise<ExportResult> {
  const { onProgress, signal } = handlers
  void project

  if (settings.container === 'mp4' && settings.videoCodec === 'prores_422') {
    throw new Error('ProRes is not supported in MP4 container')
  }

  const totalSteps = 50
  for (let i = 0; i <= totalSteps; i++) {
    if (signal?.aborted) {
      throw new Error('Export cancelled')
    }
    if (onProgress) onProgress((i / totalSteps) * 100)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  const mimeType =
    settings.container === 'mov'
      ? 'video/quicktime'
      : settings.container === 'webm'
      ? 'video/webm'
      : 'video/mp4'

  const blob = new Blob([], { type: mimeType })
  return {
    blob,
    mimeType,
    fileName: `${settings.fileName}.${settings.fileExtension}`,
  }
}
