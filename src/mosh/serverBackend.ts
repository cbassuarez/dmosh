import type { MoshBackend } from './backend'
import type { MoshOptions, MoshProgress } from './datamosh'

// Optional "heavy mode": offload moshing to a native-ffmpeg (and FFglitch)
// server for large/long clips or motion-vector effects the browser can't do.
// Enabled by setting VITE_MOSH_SERVER (and optionally VITE_MOSH_SERVER_TOKEN).
// The reference server lives in /server and implements this same contract.

const POLL_MS = 1000

interface JobStatus {
  status: 'queued' | 'processing' | 'done' | 'error'
  progress?: number
  phase?: string
  error?: string
}

function authHeaders(): Record<string, string> {
  const token = import.meta.env.VITE_MOSH_SERVER_TOKEN
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Build the multipart payload mirroring MoshOptions + the clip files. */
function buildForm(inputs: File[], options: MoshOptions): FormData {
  const form = new FormData()
  form.set('effect', options.effect)
  if (options.intensity != null) form.set('intensity', String(options.intensity))
  if (options.seed != null) form.set('seed', String(options.seed))
  if (options.maxDimension != null) form.set('maxDimension', String(options.maxDimension))
  form.set('keepAudio', String(options.keepAudio ?? false))
  if (options.range) form.set('range', JSON.stringify(options.range))
  form.set('clip', inputs[0])
  if (inputs[1]) form.set('clip2', inputs[1])
  return form
}

export function createServerBackend(baseUrl: string): MoshBackend {
  const base = baseUrl.replace(/\/$/, '')

  async function process(
    inputs: File[],
    options: MoshOptions,
    onProgress?: MoshProgress,
  ): Promise<Blob> {
    onProgress?.(0, 'Uploading')
    const createRes = await fetch(`${base}/jobs`, {
      method: 'POST',
      headers: authHeaders(),
      body: buildForm(inputs, options),
    })
    if (!createRes.ok) throw new Error(`Server rejected job (${createRes.status})`)
    const { id } = (await createRes.json()) as { id: string }

    // Poll until the job finishes.
    for (;;) {
      await sleep(POLL_MS)
      const statusRes = await fetch(`${base}/jobs/${id}`, { headers: authHeaders() })
      if (!statusRes.ok) throw new Error(`Lost the job (${statusRes.status})`)
      const job = (await statusRes.json()) as JobStatus
      if (job.progress != null) onProgress?.(job.progress, job.phase ?? 'Moshing')
      if (job.status === 'error') throw new Error(job.error ?? 'Server moshing failed')
      if (job.status === 'done') break
    }

    const resultRes = await fetch(`${base}/jobs/${id}/result`, { headers: authHeaders() })
    if (!resultRes.ok) throw new Error(`Could not fetch result (${resultRes.status})`)
    onProgress?.(1, 'Done')
    return await resultRes.blob()
  }

  return { id: 'server', process }
}
