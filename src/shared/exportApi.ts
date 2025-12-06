import type { Project } from '../engine/types'
import type { RenderSettings } from '../engine/renderTypes'

export type RemoteJobStatus = 'queued' | 'rendering' | 'complete' | 'failed' | 'cancelled'

export interface RemoteJobInfo {
  id: string
  status: RemoteJobStatus
  progress?: number | null
  error?: string
  downloadUrl?: string
}

const getConfig = () => {
  const base = import.meta.env.VITE_EXPORT_API_BASE
  const token = import.meta.env.VITE_EXPORT_AUTH_TOKEN

  if (!base || !token) {
    throw new Error('Export API not configured')
  }

  return { base, token }
}

export async function postExportJob(
  project: Project,
  settings: RenderSettings,
  clientVersion?: string,
): Promise<{ jobId: string }> {
  const { base, token } = getConfig()
  const response = await fetch(`${base}/exports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Export-Token': token,
    },
    body: JSON.stringify({ project, settings, clientVersion }),
  })

  if (!response.ok) {
    throw new Error(`Failed to start export: ${response.statusText || response.status}`)
  }

  return response.json() as Promise<{ jobId: string }>
}

export async function getExportStatus(jobId: string): Promise<RemoteJobInfo> {
  const { base, token } = getConfig()
  const response = await fetch(`${base}/exports/${jobId}`, {
    method: 'GET',
    headers: { 'X-Export-Token': token },
  })

  if (response.status === 404) {
    throw new Error('Export job not found')
  }

  if (!response.ok) {
    throw new Error('Failed to fetch export status')
  }

  return response.json() as Promise<RemoteJobInfo>
}

export async function downloadExport(jobId: string): Promise<Blob> {
  const { base, token } = getConfig()
  const response = await fetch(`${base}/exports/${jobId}/download`, {
    method: 'GET',
    headers: { 'X-Export-Token': token },
  })

  if (!response.ok) {
    throw new Error('Export download failed')
  }

  return response.blob()
}
