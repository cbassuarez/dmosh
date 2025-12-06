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

export async function postExportJob(
  project: Project,
  settings: RenderSettings,
): Promise<{ jobId: string }> {
  if (!API_BASE || !AUTH_TOKEN) {
    throw new Error('Export backend is not configured')
  }

  const res = await fetch(`${API_BASE}/exports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Export-Token': AUTH_TOKEN,
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
  if (!API_BASE || !AUTH_TOKEN) {
    throw new Error('Export backend is not configured')
  }

  const res = await fetch(`${API_BASE}/exports/${encodeURIComponent(jobId)}`, {
    headers: {
      'X-Export-Token': AUTH_TOKEN,
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
  if (!API_BASE || !AUTH_TOKEN) {
    throw new Error('Export backend is not configured')
  }

  const res = await fetch(
    `${API_BASE}/exports/${encodeURIComponent(jobId)}/download`,
    {
      headers: {
        'X-Export-Token': AUTH_TOKEN,
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

