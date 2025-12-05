import type { RenderJob } from '../shared/hooks/useProject'

export function canDownloadJob(job: RenderJob): boolean {
  return job.status === 'completed' && !!job.result?.blob
}

export function downloadJobResult(job: RenderJob): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!job.result?.blob) return

  const { blob, fileName } = job.result
  const suggestedFileName = fileName || 'dmosh-export'

  const objectUrl = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = objectUrl
  link.download = suggestedFileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 10_000)
}
