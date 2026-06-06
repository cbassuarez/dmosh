// Minimal ambient types for the bits of mp4box we use (the package ships no types).
declare module 'mp4box' {
  export interface MP4ArrayBuffer extends ArrayBuffer {
    fileStart: number
  }

  export interface MP4VideoTrack {
    id: number
    codec: string
    nb_samples: number
    timescale: number
    movie_duration: number
    movie_timescale: number
    video: { width: number; height: number }
  }

  export interface MP4Info {
    videoTracks: MP4VideoTrack[]
    audioTracks: unknown[]
  }

  export interface MP4Sample {
    data: Uint8Array
    is_sync: boolean
    cts: number
    dts: number
    duration: number
    timescale: number
  }

  export class DataStream {
    static BIG_ENDIAN: number
    constructor(buffer?: ArrayBuffer, byteOffset?: number, endianness?: number)
    buffer: ArrayBuffer
  }

  interface Box {
    write(stream: DataStream): void
  }
  interface StsdEntry {
    avcC?: Box
    hvcC?: Box
  }
  interface Trak {
    mdia: { minf: { stbl: { stsd: { entries: StsdEntry[] } } } }
  }

  export interface ISOFile {
    onReady: (info: MP4Info) => void
    onError: (e: string) => void
    onSamples: (id: number, user: unknown, samples: MP4Sample[]) => void
    setExtractionOptions(id: number, user: unknown, opts: { nbSamples: number }): void
    getTrackById(id: number): Trak
    start(): void
    appendBuffer(data: MP4ArrayBuffer): number
    flush(): void
  }

  export function createFile(): ISOFile
}
