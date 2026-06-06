import { datamosh, type MoshOptions, type MoshProgress } from './datamosh'
import { createServerBackend } from './serverBackend'

/**
 * A mosh backend turns input clips + options into a moshed MP4 Blob. The default
 * runs ffmpeg.wasm in the browser; a "heavy mode" (native ffmpeg + FFglitch on a
 * server, for large/long clips or motion-vector effects) implements this same
 * interface — see src/mosh/serverBackend.ts and the reference server in /server.
 */
export interface MoshBackend {
  readonly id: string
  process(inputs: File[], options: MoshOptions, onProgress?: MoshProgress): Promise<Blob>
}

export const clientBackend: MoshBackend = {
  id: 'client',
  process: async (inputs, options, onProgress) => {
    // The GPU flow-smear runs on WebCodecs/WebGL; if the clip can't be decoded
    // there (non-MP4/H.264 or no WebCodecs), fall back to the wasm bloom.
    if (options.effect === 'flow') {
      // Lazy-loaded so the heavy demux/mux deps aren't in the main bundle.
      const { gpuDatamosh, GpuUnsupportedError } = await import('./webcodecs')
      try {
        return await gpuDatamosh(inputs[0], options, onProgress)
      } catch (err) {
        if (err instanceof GpuUnsupportedError) {
          return datamosh(inputs, { ...options, effect: 'bloom' }, onProgress)
        }
        throw err
      }
    }
    return datamosh(inputs, options, onProgress)
  },
}

// True when running inside the Tauri desktop shell.
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const serverUrl = import.meta.env.VITE_MOSH_SERVER
let serverBackend: MoshBackend | null = null

// Route to the right backend at call time: a configured server, the native Tauri
// engine on desktop (lazy-loaded so @tauri-apps stays out of the web bundle), or
// the in-browser ffmpeg.wasm/WebCodecs engine. The UI is identical across all.
export const activeBackend: MoshBackend = {
  id: 'auto',
  process: async (inputs, options, onProgress) => {
    if (serverUrl) {
      serverBackend ??= createServerBackend(serverUrl)
      return serverBackend.process(inputs, options, onProgress)
    }
    if (isTauri()) {
      const { tauriBackend } = await import('./tauriBackend')
      return tauriBackend.process(inputs, options, onProgress)
    }
    return clientBackend.process(inputs, options, onProgress)
  },
}
