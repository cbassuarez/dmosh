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

function resolveMimeType(container: ContainerFormat): string {
  if (container === 'mov') return 'video/quicktime'
  if (container === 'webm') return 'video/webm'
  if (container === 'mkv') return 'video/x-matroska'
  return 'video/mp4'
}

export async function exportTimeline(
  project: Project,
  settings: RenderSettings,
  handlers: ExportProgressHandlers = {},
): Promise<ExportResult> {
  if (import.meta.env.DEV) {
    console.info('[dmosh] exportTimeline stub invoked', {
      projectId: (project as { id?: string }).id ?? null,
      settings,
    })
  }

  if (handlers.onProgress) {
    handlers.onProgress(0)
    handlers.onProgress(50)
    handlers.onProgress(100)
  }

  if (handlers.signal?.aborted) {
    throw new Error('Export aborted')
  }

  const mimeType = resolveMimeType(settings.container)
  const blob = new Blob([Uint8Array.of(1, 2, 3, 4, 5)], { type: mimeType })
  const fileExtension = settings.fileExtension ?? settings.container ?? 'mp4'
  const fileName = `${settings.fileName}.${fileExtension}`

  return { blob, mimeType, fileName }
}
