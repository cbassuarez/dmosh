import type { Project, Source } from '../engine/types'
import type { RenderSettings } from '../engine/renderTypes'
import { getExportServiceConfig, uploadSourceMedia } from './exportApi'

const createFileFromSourcePreview = async (source: Source): Promise<File | null> => {
  if (!source.previewUrl || !source.previewUrl.startsWith('blob:')) return null

  try {
    const res = await fetch(source.previewUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    const fileName = source.originalName || source.id
    return new File([blob], fileName, { type: blob.type || 'application/octet-stream' })
  } catch {
    return null
  }
}

const collectSourceIdsForSettings = (project: Project, settings: RenderSettings): Set<string> => {
  const sourceRef = settings.source ?? { kind: 'timeline' as const }
  const sourceIds = new Set<string>()
  const clips = project.timeline?.clips ?? []

  if (sourceRef.kind === 'source' && sourceRef.sourceId) {
    sourceIds.add(sourceRef.sourceId)
  } else if (sourceRef.kind === 'clip' && sourceRef.clipId) {
    const clip = clips.find((c) => c.id === sourceRef.clipId)
    if (clip?.sourceId) {
      sourceIds.add(clip.sourceId)
    }
  } else {
    clips.forEach((clip) => {
      if (clip.sourceId) {
        sourceIds.add(clip.sourceId)
      }
    })
  }

  return sourceIds
}

export const ensureSourcesUploaded = async (options: {
  project: Project
  settings: RenderSettings
  getSourceFile: (sourceId: string) => File | undefined
  updateSource: (sourceId: string, patch: Partial<Source>) => void
}): Promise<void> => {
  const { project, settings, getSourceFile, updateSource } = options

  const requiredIds = collectSourceIdsForSettings(project, settings)
  if (!requiredIds.size) return

  const { baseUrl, authToken } = getExportServiceConfig()
  const requiredSources = project.sources.filter((source) => requiredIds.has(source.id))

  for (const source of requiredSources) {
    if (source.serverUploaded) continue

    // 1) Try the in-memory File first
    let file = getSourceFile(source.id)

    // 2) Fall back to reconstructing from the preview blob if needed
    if (!file) {
      file = await createFileFromSourcePreview(source)
    }

    if (!file) {
      throw Object.assign(
        new Error(
          `Original media for ${source.originalName || source.id} is not available in this browser session.`,
        ),
        { code: 'source_file_missing', sourceId: source.id },
      )
    }

    const response = await uploadSourceMedia({
      baseUrl,
      authToken,
      file,
      hash: source.hash,
      originalName: source.originalName,
    })

    updateSource(source.id, { serverUploaded: true, serverExt: response.serverExt ?? null })
  }
}
