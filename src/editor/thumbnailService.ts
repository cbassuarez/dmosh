import { useEffect, useState } from 'react'
import type { Source } from '../engine/types'

const cache = new Map<string, string>()

const palette = ['#ef4444', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899']

const encodeBase64 = (value: string) => {
  if (typeof btoa !== 'undefined') return btoa(value)
  return Buffer.from(value, 'utf-8').toString('base64')
}

const THUMBNAIL_WIDTH = 320
const THUMBNAIL_HEIGHT = 180
const THUMBNAIL_TIMEOUT_MS = 250

const generatePlaceholderThumbnail = (source: Source) => {
  const color = palette[Math.abs(source.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % palette.length]
  const label = source.originalName || source.id
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" viewBox="0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.92" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0.65" />
        </linearGradient>
      </defs>
      <rect width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" rx="16" fill="url(#grad)" />
      <text x="20" y="${THUMBNAIL_HEIGHT - 30}" font-size="22" font-family="Inter, Arial" fill="white" opacity="0.92">${label}</text>
      <text x="20" y="45" font-size="14" font-family="Inter, Arial" fill="white" opacity="0.7">${source.id}</text>
    </svg>
  `
  return `data:image/svg+xml;base64,${encodeBase64(svg)}`
}

const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('thumbnail timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })

const generateThumbnailFromVideo = async (source: Source): Promise<string> => {
  if (typeof document === 'undefined') {
    throw new Error('No DOM available for video thumbnail')
  }

  const video = document.createElement('video')
  video.src = source.previewUrl
  video.muted = true
  video.playsInline = true
  video.crossOrigin = 'anonymous'

  const loadMetadata = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
    }
    const onLoaded = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('video metadata load failed'))
    }

    video.addEventListener('loadedmetadata', onLoaded, { once: true })
    video.addEventListener('error', onError, { once: true })
  })

  await withTimeout(loadMetadata, THUMBNAIL_TIMEOUT_MS)

  const targetTime = (video.duration || 1) * 0.1
  video.currentTime = targetTime

  const waitForSeeked = new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked, { once: true })
  })

  try {
    await withTimeout(waitForSeeked, THUMBNAIL_TIMEOUT_MS)
  } catch {
    // Continue to attempt drawing even if seeking events are missing
  }

  const canvas = document.createElement('canvas')
  canvas.width = THUMBNAIL_WIDTH
  canvas.height = THUMBNAIL_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas context')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export interface ThumbnailResult {
  url: string | null
  isLoading: boolean
  error: string | null
}

export const getSourceThumbnail = async (source: Source): Promise<string> => {
  if (source.thumbnailUrl) return source.thumbnailUrl
  if (cache.has(source.id)) return cache.get(source.id) as string

  try {
    if (source.previewUrl) {
      const url = await generateThumbnailFromVideo(source)
      source.thumbnailUrl = url
      cache.set(source.id, url)
      return url
    }
  } catch {
    // fall back to placeholder
  }

  const fallback = generatePlaceholderThumbnail(source)
  cache.set(source.id, fallback)
  return fallback
}

export const useSourceThumbnail = (source?: Source): ThumbnailResult => {
  const [state, setState] = useState<ThumbnailResult>({ url: null, isLoading: !!source, error: null })

  useEffect(() => {
    let cancelled = false
    if (!source) {
      setState({ url: null, isLoading: false, error: null })
      return () => {}
    }
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    getSourceThumbnail(source)
      .then((url) => {
        if (cancelled) return
        setState({ url, isLoading: false, error: null })
      })
      .catch((err: Error) => {
        if (cancelled) return
        setState({ url: null, isLoading: false, error: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [source])

  return state
}
