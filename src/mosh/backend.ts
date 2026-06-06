import { datamosh, type MoshOptions, type MoshProgress } from './datamosh'

/**
 * A mosh backend turns input clips + options into a moshed MP4 Blob. Today the
 * only implementation runs ffmpeg.wasm in the browser. A future "heavy mode"
 * (native ffmpeg on a server, for large/long clips) can implement this same
 * interface and drop in here without touching the UI.
 */
export interface MoshBackend {
  readonly id: string
  process(inputs: File[], options: MoshOptions, onProgress?: MoshProgress): Promise<Blob>
}

export const clientBackend: MoshBackend = {
  id: 'client',
  process: (inputs, options, onProgress) => datamosh(inputs, options, onProgress),
}

/** The active backend. Swap to a server impl here when one exists. */
export const activeBackend: MoshBackend = clientBackend
