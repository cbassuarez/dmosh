// src/types/ffmpeg.d.ts

declare module '@ffmpeg/ffmpeg' {
  export interface FFmpeg {
    load(): Promise<void>
    run(...args: string[]): Promise<void>
    FS(
      op: 'readFile' | 'writeFile' | 'unlink',
      path: string,
      data?: Uint8Array,
    ): Uint8Array | void
    setProgress?(
      handler: (progress: { ratio?: number; progress?: number }) => void,
    ): void
    setLogger?(
      handler: (log: { type: string; message: string }) => void,
    ): void
  }

  export function createFFmpeg(options?: { log?: boolean; corePath?: string }): FFmpeg

  export function fetchFile(
    input: string | ArrayBuffer | Uint8Array | Blob | File,
  ): Promise<Uint8Array> | Uint8Array

  // Runtime shape: default export with createFFmpeg + fetchFile
  const _default: {
    createFFmpeg: typeof createFFmpeg
    fetchFile: typeof fetchFile
  }

  export default _default
}
