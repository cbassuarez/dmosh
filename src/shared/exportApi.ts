// src/shared/exportApi.ts
import type { Project } from '../engine/types'
import type { RenderSettings } from '../engine/renderTypes'

const API_BASE = import.meta.env.VITE_EXPORT_API_BASE
const AUTH_TOKEN = import.meta.env.VITE_EXPORT_AUTH_TOKEN

if (import.meta.env.DEV) {
  if (!API_BASE) {
    console.warn('[dmosh] VITE_EXPORT_API_BASE is not set; export will fail in dev')
  }
  if (!AUTH_TOKEN) {
    console.warn('[dmosh] VITE_EXPORT_AUTH_TOKEN is not set; export will fail in dev')
  }
}

export type RemoteJobStatus =
  | 'queued'
  | 'rendering'
  | 'complete'
  | 'failed'
  | 'cancelled'

export interface RemoteExportJob {
  id: string
  status: RemoteJobStatus
  progress?: number | null
  error?: string
  downloadUrl?: string | null
}

export const getExportServiceConfig = () => {
  if (!API_BASE || !AUTH_TOKEN) {
    throw new Error('Export backend is not configured')
  }

  return { baseUrl: API_BASE, authToken: AUTH_TOKEN }
}

export async function postExportJob(
  project: Project,
  settings: RenderSettings,
): Promise<{ jobId: string }> {
  const { baseUrl, authToken } = getExportServiceConfig()

  const res = await fetch(`${baseUrl}/exports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Export-Token': authToken,
    },
    body: JSON.stringify({
      project,
      settings,
      clientVersion: import.meta.env.VITE_APP_VERSION ?? undefined,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Export start failed (${res.status} ${res.statusText}): ${text || 'no body'}`,
    )
  }

  const json = (await res.json()) as { jobId: string }
  return json
}

export async function getExportStatus(jobId: string): Promise<RemoteExportJob> {
  const { baseUrl, authToken } = getExportServiceConfig()

  const res = await fetch(`${baseUrl}/exports/${encodeURIComponent(jobId)}`, {
    headers: {
      'X-Export-Token': authToken,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Export status failed (${res.status} ${res.statusText}): ${text || 'no body'}`,
    )
  }

  const json = (await res.json()) as RemoteExportJob
  return json
}

export async function downloadExport(jobId: string): Promise<void> {
  const { baseUrl, authToken } = getExportServiceConfig()

  const res = await fetch(
    `${baseUrl}/exports/${encodeURIComponent(jobId)}/download`,
    {
      headers: {
        'X-Export-Token': authToken,
      },
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Export download failed (${res.status} ${res.statusText}): ${
        text || 'no body'
      }`,
    )
  }

  const blob = await res.blob()

  // Reuse your existing “download Blob” helper if you have one.
  // If not, the classic anchor hack:
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dmosh-export.mp4' // we can refine this later using settings.fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function uploadSourceMedia(params: {
  baseUrl: string
  authToken: string
  file: File
  hash: string
  originalName: string
}): Promise<{ hash: string; cached: boolean; serverExt: string | null }> {
  const url = new URL('/media/upload', params.baseUrl).toString()

  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('hash', params.hash)
  formData.append('originalName', params.originalName)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Export-Token': params.authToken,
    },
    body: formData,
  })

  const parseServerExt = (path?: string | null): string | null => {
    if (!path || typeof path !== 'string') return null
    const lastDot = path.lastIndexOf('.')
    if (lastDot === -1) return null
    const ext = path.slice(lastDot)
    return ext || null
  }

  if (res.ok) {
    const json = (await res.json().catch(() => ({}))) as {
      hash?: string
      cached?: boolean
      path?: string
    }
    return {
      hash: json.hash ?? params.hash,
      cached: Boolean(json.cached),
      serverExt: parseServerExt(json.path),
    }
  }

  if (res.status === 400) {
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    const code = json.error || 'upload_failed'
    const message = json.message || json.error || 'Upload failed'
    throw Object.assign(new Error(message), { code })
  }

  const text = await res.text().catch(() => '')
  const error = new Error(
    `Upload failed (${res.status} ${res.statusText}): ${text || 'no body'}`,
  )
  throw Object.assign(error, { code: 'upload_failed', status: res.status })
}

