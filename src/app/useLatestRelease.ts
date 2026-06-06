import { useEffect, useState } from 'react'
import pkg from '../../package.json'

// Shows the live latest GitHub release tag so the header never needs a hand-edited
// version. Falls back to the bundled package version offline, and caches the tag
// (6h) to stay well under GitHub's unauthenticated rate limit.

const REPO = 'cbassuarez/dmosh'
const CACHE_KEY = 'dmosh:latest-release'
const TTL_MS = 6 * 60 * 60 * 1000

export function useLatestRelease(): string {
  const [version, setVersion] = useState(`v${pkg.version}`)

  useEffect(() => {
    let cancelled = false

    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const { tag, at } = JSON.parse(cached) as { tag?: string; at?: number }
        if (tag) setVersion(tag)
        if (at && Date.now() - at < TTL_MS) return // fresh enough; skip the fetch
      }
    } catch {
      /* ignore cache errors */
    }

    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { tag_name?: string } | null) => {
        const tag = data?.tag_name
        if (!tag || cancelled) return
        setVersion(tag)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ tag, at: Date.now() }))
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* offline — keep the fallback */
      })

    return () => {
      cancelled = true
    }
  }, [])

  return version
}
