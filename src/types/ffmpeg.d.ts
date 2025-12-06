// src/types/ffmpeg.d.ts

declare module '@ffmpeg/ffmpeg' {
  export interface FFmpeg {
    load(): Promise<void>
    /**
     * Run an ffmpeg command.
     * Usage: await ffmpeg.run('-i', 'in', 'out.mp4')
     */
    run(...args: string[]): Promise<void>

    /**
     * Virtual filesystem access.
     */
    FS(
      op: 'readFile' | 'writeFile' | 'unlink',
      path: string,
      data?: Uint8Array,
    ): Uint8Array | void

    /**
     * Optional progress callback – some versions expose this.
     */
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
}

