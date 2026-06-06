import { useEffect, useMemo, useRef, useState } from 'react'
import type { MoshEffect, MoshOptions, Range } from '../mosh/datamosh'
import { processMoshQueued } from '../mosh/processQueue'

const PREVIEW_MAX_DIMENSION = 360
const PREVIEW_DEBOUNCE_MS = 450

interface Props {
  clipA: File
  clipB?: File | null
  sourceUrl: string
  effect: MoshEffect
  intensity: number
  range: Range
  repeat: number
  dropI: boolean
  dropP: boolean
  seed: number
}

interface PreviewJob {
  key: string
  inputs: File[]
  options: MoshOptions
}

interface PreviewState {
  status: 'idle' | 'working' | 'done' | 'error'
  key: string | null
  url: string | null
  progress: number
  phase: string
  error: string | null
}

class StalePreviewError extends Error {}

function fileKey(file: File | null | undefined): string {
  return file ? `${file.name}:${file.size}:${file.lastModified}` : 'none'
}

function previewKey({
  clipA,
  clipB,
  effect,
  intensity,
  range,
  repeat,
  dropI,
  dropP,
  seed,
}: Omit<Props, 'sourceUrl'>): string {
  return JSON.stringify({
    a: fileKey(clipA),
    b: fileKey(clipB),
    effect,
    intensity,
    range,
    repeat,
    dropI,
    dropP,
    seed,
  })
}

export default function EffectPreview({
  clipA,
  clipB,
  sourceUrl,
  effect,
  intensity,
  range,
  repeat,
  dropI,
  dropP,
  seed,
}: Props) {
  const [preview, setPreview] = useState<PreviewState>({
    status: 'idle',
    key: null,
    url: null,
    progress: 0,
    phase: '',
    error: null,
  })
  const previewUrlRef = useRef<string | null>(null)
  const mountedRef = useRef(false)
  const runningRef = useRef(false)
  const wantedRef = useRef<PreviewJob | null>(null)
  const renderedKeyRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const job = useMemo<PreviewJob | null>(() => {
    if (effect === 'transition' && !clipB) return null

    const key = previewKey({ clipA, clipB, effect, intensity, range, repeat, dropI, dropP, seed })
    const options: MoshOptions = {
      effect,
      intensity,
      seed,
      maxDimension: PREVIEW_MAX_DIMENSION,
      keepAudio: false,
      range: effect === 'transition' ? undefined : range,
      dropI,
      dropP,
      repeat,
    }
    return {
      key,
      inputs: effect === 'transition' ? [clipA, clipB!] : [clipA],
      options,
    }
  }, [clipA, clipB, dropI, dropP, effect, intensity, range, repeat, seed])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    wantedRef.current = job

    if (!job) {
      renderedKeyRef.current = null
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      setPreview({ status: 'idle', key: null, url: null, progress: 0, phase: '', error: null })
      return
    }

    if (renderedKeyRef.current !== job.key) {
      setPreview((current) => ({
        ...current,
        status: 'working',
        progress: 0,
        phase: runningRef.current ? 'queued' : 'waiting',
        error: null,
      }))
    }

    const runQueue = async (): Promise<void> => {
      if (runningRef.current) return
      const queued = wantedRef.current
      if (!queued || queued.key === renderedKeyRef.current) return

      runningRef.current = true
      setPreview((current) => ({
        ...current,
        status: 'working',
        progress: 0,
        phase: 'baking',
        error: null,
      }))

      try {
        const blob = await processMoshQueued(queued.inputs, queued.options, (ratio, phase) => {
          if (!mountedRef.current || wantedRef.current?.key !== queued.key) return
          setPreview((current) => ({
            ...current,
            status: 'working',
            progress: ratio,
            phase: phase.toLowerCase(),
            error: null,
          }))
        })

        if (!mountedRef.current || wantedRef.current?.key !== queued.key) {
          throw new StalePreviewError()
        }

        const nextUrl = URL.createObjectURL(blob)
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = nextUrl
        renderedKeyRef.current = queued.key
        setPreview({
          status: 'done',
          key: queued.key,
          url: nextUrl,
          progress: 1,
          phase: 'done',
          error: null,
        })
      } catch (err) {
        if (err instanceof StalePreviewError || !mountedRef.current) return
        if (wantedRef.current?.key === queued.key) {
          setPreview((current) => ({
            ...current,
            status: 'error',
            progress: 0,
            phase: '',
            error: err instanceof Error ? err.message : 'preview render failed',
          }))
        }
      } finally {
        runningRef.current = false
        const next = wantedRef.current
        if (mountedRef.current && next && next.key !== renderedKeyRef.current) {
          void runQueue()
        }
      }
    }

    timerRef.current = window.setTimeout(() => void runQueue(), PREVIEW_DEBOUNCE_MS)
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [job])

  const hasCurrentPreview = Boolean(job && preview.status === 'done' && preview.key === job.key && preview.url)
  const overlay =
    !job && effect === 'transition'
      ? 'load clip B for preview'
      : preview.status === 'error'
        ? preview.error
        : hasCurrentPreview
          ? 'baked preview'
          : preview.status === 'working'
            ? `${preview.phase || 'baking'} ${Math.round(preview.progress * 100)}%`
            : null

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {hasCurrentPreview ? (
        <video key={preview.url!} src={preview.url!} className="max-h-full max-w-full object-contain" autoPlay loop muted playsInline />
      ) : (
        <video key={sourceUrl} src={sourceUrl} className="max-h-full max-w-full object-contain" autoPlay loop muted playsInline />
      )}

      {overlay && (
        <span className="absolute left-0 top-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/70 backdrop-blur-sm">
          {overlay}
        </span>
      )}
    </div>
  )
}
