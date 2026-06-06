import { invoke, Channel } from '@tauri-apps/api/core'
import type { MoshBackend } from './backend'
import type { MoshOptions } from './datamosh'

// Desktop (Tauri) backend: the native Rust engine (dmosh-core) does the heavy
// work with native ffmpeg — no wasm memory ceiling, multithreaded. Clip bytes go
// over the IPC as ArrayBuffers (transferred raw), and the moshed MP4 comes back
// the same way. The Flow effect stays in the webview (GPU/WebCodecs).

interface ProgressMsg {
  progress: number
  phase: string
}

function toRustOptions(o: MoshOptions) {
  return {
    effect: o.effect,
    intensity: o.intensity ?? 0.7,
    maxDimension: o.maxDimension ?? 1280,
    keepAudio: o.keepAudio ?? false,
    seed: o.seed ?? 0x6d6f7368,
    range: o.range ? [o.range.start, o.range.end] : null,
    dropI: o.dropI ?? true,
    dropP: o.dropP ?? false,
    repeat: o.repeat ?? null,
  }
}

const bytesOf = async (file: File) => new Uint8Array(await file.arrayBuffer())

export const tauriBackend: MoshBackend = {
  id: 'tauri',
  process: async (inputs, options, onProgress) => {
    let opts = options
    if (opts.effect === 'flow') {
      // GPU optical-flow runs in the webview; fall back to native Bloom if the
      // webview lacks WebCodecs/WebGL2.
      const { gpuDatamosh, GpuUnsupportedError } = await import('./webcodecs')
      try {
        return await gpuDatamosh(inputs[0], opts, onProgress)
      } catch (err) {
        if (!(err instanceof GpuUnsupportedError)) throw err
        opts = { ...opts, effect: 'bloom' }
      }
    }

    const channel = new Channel<ProgressMsg>()
    if (onProgress) channel.onmessage = (m) => onProgress(m.progress, m.phase)

    const inputA = await bytesOf(inputs[0])
    const inputB = inputs[1] ? await bytesOf(inputs[1]) : null

    const out = await invoke<ArrayBuffer>('mosh', {
      inputA,
      inputB,
      options: toRustOptions(opts),
      onProgress: channel,
    })
    return new Blob([out], { type: 'video/mp4' })
  },
}
