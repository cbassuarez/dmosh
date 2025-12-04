import { useEffect, useState } from 'react'
import type { Source } from '../engine/types'

const cache = new Map<string, string>()

const palette = ['#ef4444', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899']

const encodeBase64 = (value: string) => {
  if (typeof btoa !== 'undefined') return btoa(value)
  return Buffer.from(value, 'utf-8').toString('base64')
}

const generatePlaceholderThumbnail = (source: Source) => {
  const color = palette[Math.abs(source.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % palette.length]
  const label = source.originalName || source.id
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.92" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0.65" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" rx="16" fill="url(#grad)" />
      <text x="20" y="150" font-size="22" font-family="Inter, Arial" fill="white" opacity="0.92">${label}</text>
      <text x="20" y="45" font-size="14" font-family="Inter, Arial" fill="white" opacity="0.7">${source.id}</text>
    </svg>
  `
  return `data:image/svg+xml;base64,${encodeBase64(svg)}`
}

export interface ThumbnailResult {
  url: string | null
  isLoading: boolean
  error: string | null
}

export const getSourceThumbnail = async (source: Source): Promise<string> => {
  if (cache.has(source.id)) return cache.get(source.id) as string
  const url = generatePlaceholderThumbnail(source)
  cache.set(source.id, url)
  return url
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
