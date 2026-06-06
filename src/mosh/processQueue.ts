import { activeBackend } from './backend'
import type { MoshOptions, MoshProgress } from './datamosh'

// ffmpeg.wasm and the preview renderer share process-wide resources. Serializing
// requests prevents a live preview from racing the final export or another
// preview render.
let backendQueue: Promise<void> = Promise.resolve()

export async function processMoshQueued(
  inputs: File[],
  options: MoshOptions,
  onProgress?: MoshProgress,
): Promise<Blob> {
  const previous = backendQueue.catch(() => {})
  let release: () => void = () => {}
  backendQueue = new Promise<void>((resolve) => {
    release = resolve
  })

  await previous
  try {
    return await activeBackend.process(inputs, options, onProgress)
  } finally {
    release()
  }
}
