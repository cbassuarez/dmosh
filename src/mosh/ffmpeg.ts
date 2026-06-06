import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

// Singleton ffmpeg.wasm instance. We self-host the single-thread core under
// public/ffmpeg (see scripts/copy-ffmpeg-core.mjs) so it works offline and on
// GitHub Pages under the /dmosh/ base path with no CDN and no COOP/COEP headers.

let instance: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

// import.meta.env.BASE_URL is "/" in dev and "/dmosh/" in the Pages build.
const coreBase = `${import.meta.env.BASE_URL}ffmpeg`

export type LogHandler = (message: string) => void

const logHandlers = new Set<LogHandler>()

/** Subscribe to ffmpeg's stderr/stdout log lines. Returns an unsubscribe fn. */
export function onFfmpegLog(handler: LogHandler): () => void {
  logHandlers.add(handler)
  return () => logHandlers.delete(handler)
}

/** Load (once) and return the shared ffmpeg instance. */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const ff = new FFmpeg()
    ff.on('log', ({ message }) => {
      if (import.meta.env.DEV) console.debug('[ffmpeg]', message)
      for (const h of logHandlers) h(message)
    })
    await ff.load({
      coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    instance = ff
    return ff
  })()

  return loadPromise
}

/**
 * Subscribe to ffmpeg's per-run progress (0..1). The instance reuses a single
 * progress handler, so callers should subscribe around one exec and unsubscribe
 * after. Returns an unsubscribe fn.
 */
export function onFfmpegProgress(
  ff: FFmpeg,
  handler: (ratio: number) => void,
): () => void {
  const listener = ({ progress }: { progress: number }) => {
    handler(Math.max(0, Math.min(1, progress)))
  }
  ff.on('progress', listener)
  return () => ff.off('progress', listener)
}
