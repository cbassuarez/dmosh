import { createFile, DataStream, type MP4Info, type MP4Sample, type MP4VideoTrack } from 'mp4box'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type { MoshOptions, MoshProgress, Range } from './datamosh'

// GPU "flow" datamosh: instead of relying on a lenient codec decoder to smear
// (which browser WebCodecs decoders refuse to do), we compute optical flow
// between decoded frames ourselves and feed an accumulator buffer back through
// a motion-warp — so a seed frame's pixels get dragged along the scene's motion
// without ever resetting. That reproduces the datamosh bloom natively-fast.

/** True when the browser can run this pipeline (WebCodecs + WebGL2). */
export function isGpuMoshSupported(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoDecoder !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    !!new OffscreenCanvas(1, 1).getContext('webgl2')
  )
}

export class GpuUnsupportedError extends Error {}

interface DecodedClip {
  frames: VideoFrame[]
  width: number
  height: number
  fps: number
}

/** Demux an MP4/MOV and decode its video track to VideoFrames (display order). */
async function decodeClip(file: File): Promise<DecodedClip> {
  const buffer = (await file.arrayBuffer()) as ArrayBuffer & { fileStart?: number }
  const mp4 = createFile()
  const samples: MP4Sample[] = []
  let track: MP4VideoTrack | null = null
  let description: Uint8Array | null = null

  const ready = new Promise<void>((resolve, reject) => {
    mp4.onError = (e) => reject(new GpuUnsupportedError(`demux failed: ${e}`))
    mp4.onReady = (info: MP4Info) => {
      track = info.videoTracks[0]
      if (!track) return reject(new GpuUnsupportedError('no video track'))
      const trak = mp4.getTrackById(track.id)
      for (const entry of trak.mdia.minf.stbl.stsd.entries) {
        const box = entry.avcC ?? entry.hvcC
        if (box) {
          const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN)
          box.write(stream)
          description = new Uint8Array(stream.buffer, 8) // skip the 8-byte box header
        }
      }
      mp4.setExtractionOptions(track.id, null, { nbSamples: Number.POSITIVE_INFINITY })
      mp4.start()
    }
    mp4.onSamples = (_id, _u, smps) => {
      for (const s of smps) samples.push(s)
      if (track && samples.length >= track.nb_samples) resolve()
    }
  })

  ;(buffer as { fileStart: number }).fileStart = 0
  mp4.appendBuffer(buffer as Parameters<typeof mp4.appendBuffer>[0])
  mp4.flush()
  await ready

  if (!track || !description) throw new GpuUnsupportedError('unsupported clip (need H.264/H.265 MP4)')
  const t = track as MP4VideoTrack

  const config: VideoDecoderConfig = {
    codec: t.codec,
    description,
    codedWidth: t.video.width,
    codedHeight: t.video.height,
  }
  const support = await VideoDecoder.isConfigSupported(config)
  if (!support.supported) throw new GpuUnsupportedError(`codec ${t.codec} not decodable`)

  const frames: VideoFrame[] = []
  const decoder = new VideoDecoder({ output: (f) => frames.push(f), error: () => {} })
  decoder.configure(config)
  for (const s of samples) {
    decoder.decode(
      new EncodedVideoChunk({
        type: s.is_sync ? 'key' : 'delta',
        timestamp: (s.cts / s.timescale) * 1e6,
        duration: (s.duration / s.timescale) * 1e6,
        data: s.data,
      }),
    )
  }
  await decoder.flush()
  frames.sort((a, b) => a.timestamp - b.timestamp)

  const durationSec = t.movie_duration / t.movie_timescale || frames.length / 30
  const fps = Math.max(1, Math.round(frames.length / durationSec))
  return { frames, width: t.video.width, height: t.video.height, fps }
}

/* ---------- WebGL2 optical-flow + feedback ---------- */

const VS = `#version 300 es
out vec2 uv;
void main(){ vec2 p = vec2(gl_VertexID==2 ? 3.0 : -1.0, gl_VertexID==1 ? 3.0 : -1.0); uv = (p+1.0)*0.5; gl_Position = vec4(p,0,1); }`

const FLOW_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D curr, prev; uniform vec2 texel; uniform float maxF;
float L(vec3 c){ return dot(c, vec3(0.333)); }
void main(){
  float It = L(texture(curr,uv).rgb) - L(texture(prev,uv).rgb);
  float ix = (L(texture(curr,uv+vec2(texel.x,0.0)).rgb) - L(texture(curr,uv-vec2(texel.x,0.0)).rgb)) * 0.5;
  float iy = (L(texture(curr,uv+vec2(0.0,texel.y)).rgb) - L(texture(curr,uv-vec2(0.0,texel.y)).rgb)) * 0.5;
  float d = ix*ix + iy*iy + 1e-4;
  vec2 f = clamp(-It*vec2(ix,iy)/d, vec2(-maxF), vec2(maxF));
  o = vec4(f, 0.0, 1.0);
}`

const WARP_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D acc, flow;
void main(){ vec2 f = texture(flow, uv).xy; o = vec4(texture(acc, uv - f).rgb, 1.0); }`

const BLIT_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D src; uniform float flipY;
void main(){ vec2 t = vec2(uv.x, mix(uv.y, 1.0-uv.y, flipY)); o = vec4(texture(src, t).rgb, 1.0); }`

function compile(gl: WebGL2RenderingContext, fs: string): WebGLProgram {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
    return s
  }
  const p = gl.createProgram()!
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VS))
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
  return p
}

interface SmearParams {
  range?: Range
  intensity: number
}

/**
 * Run the flow-feedback smear over `frames`, invoking `onFrame(timestampUs)`
 * once per output frame after the result has been drawn to the GL canvas.
 */
function runSmear(
  gl: WebGL2RenderingContext,
  W: number,
  H: number,
  frames: VideoFrame[],
  fps: number,
  params: SmearParams,
  onFrame: (timestampUs: number) => void,
): void {
  if (!gl.getExtension('EXT_color_buffer_float')) throw new GpuUnsupportedError('no float framebuffer')
  const flowProg = compile(gl, FLOW_FS)
  const warpProg = compile(gl, WARP_FS)
  const blitProg = compile(gl, BLIT_FS)
  gl.bindVertexArray(gl.createVertexArray())

  const mkTex = (internal: number, type: number) => {
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, W, H, 0, gl.RGBA, type, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }
  const mkFbo = (tex: WebGLTexture) => {
    const f = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, f)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return f
  }

  const texCurr = mkTex(gl.RGBA8, gl.UNSIGNED_BYTE)
  const texPrev = mkTex(gl.RGBA8, gl.UNSIGNED_BYTE)
  let accA = mkTex(gl.RGBA8, gl.UNSIGNED_BYTE)
  let accB = mkTex(gl.RGBA8, gl.UNSIGNED_BYTE)
  let fboA = mkFbo(accA)
  let fboB = mkFbo(accB)
  const flowTex = mkTex(gl.RGBA16F, gl.HALF_FLOAT)
  const flowFbo = mkFbo(flowTex)

  const upload = (tex: WebGLTexture, frame: VideoFrame) => {
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, frame)
  }
  const bind = (prog: WebGLProgram, name: string, unit: number, tex: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(gl.getUniformLocation(prog, name), unit)
  }
  const tri = () => gl.drawArrays(gl.TRIANGLES, 0, 3)
  const toScreen = (tex: WebGLTexture) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.useProgram(blitProg)
    bind(blitProg, 'src', 0, tex)
    gl.uniform1f(gl.getUniformLocation(blitProg, 'flipY'), 1) // un-flip for output
    tri()
  }
  const seed = (fbo: WebGLFramebuffer, tex: WebGLTexture) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.useProgram(blitProg)
    bind(blitProg, 'src', 0, tex)
    gl.uniform1f(gl.getUniformLocation(blitProg, 'flipY'), 0)
    tri()
  }

  const N = frames.length
  const clampIdx = (v: number) => Math.max(0, Math.min(N, Math.round(v * N)))
  const startIdx = params.range ? clampIdx(params.range.start) : 0
  const endIdx = params.range ? Math.max(startIdx, clampIdx(params.range.end)) : N
  const maxF = 0.008 + Math.max(0, Math.min(1, params.intensity)) * 0.05
  const frameDur = 1e6 / fps

  gl.viewport(0, 0, W, H)
  upload(texPrev, frames[0])
  seed(fboA, texPrev)
  toScreen(accA)
  onFrame(0)

  for (let i = 1; i < N; i++) {
    upload(texCurr, frames[i])
    const inWindow = i >= startIdx && i < endIdx
    if (!inWindow || i === startIdx) {
      // Outside the moshed window (or at its first frame) → clean source.
      seed(fboB, texCurr)
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, flowFbo)
      gl.useProgram(flowProg)
      bind(flowProg, 'curr', 0, texCurr)
      bind(flowProg, 'prev', 1, texPrev)
      gl.uniform2f(gl.getUniformLocation(flowProg, 'texel'), 1 / W, 1 / H)
      gl.uniform1f(gl.getUniformLocation(flowProg, 'maxF'), maxF)
      tri()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboB)
      gl.useProgram(warpProg)
      bind(warpProg, 'acc', 0, accA)
      bind(warpProg, 'flow', 1, flowTex)
      tri()
    }
    const ta = accA
    accA = accB
    accB = ta
    const tf = fboA
    fboA = fboB
    fboB = tf
    upload(texPrev, frames[i])
    toScreen(accA)
    onFrame(Math.round(i * frameDur))
  }
}

/* ---------- encode + mux ---------- */

function pickAvcCodec(width: number, height: number): string {
  // Baseline profile; pick a level that covers the (capped) frame size.
  const mb = Math.ceil(width / 16) * Math.ceil(height / 16)
  if (mb <= 3600) return 'avc1.42001f' // ≤ 720p
  return 'avc1.420028' // level 4.0, ≤ 1080p
}

class Mp4Encoder {
  private muxer: Muxer<ArrayBufferTarget>
  private encoder: VideoEncoder
  private i = 0
  private keyEvery: number

  constructor(width: number, height: number, fps: number) {
    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width, height },
      fastStart: 'in-memory',
    })
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        throw e
      },
    })
    this.encoder.configure({
      codec: pickAvcCodec(width, height),
      width,
      height,
      bitrate: Math.round(width * height * fps * 0.12),
      framerate: fps,
    })
    this.keyEvery = Math.max(1, fps * 2)
  }

  encode(frame: VideoFrame): void {
    this.encoder.encode(frame, { keyFrame: this.i % this.keyEvery === 0 })
    this.i += 1
  }

  async finish(): Promise<Blob> {
    await this.encoder.flush()
    this.muxer.finalize()
    return new Blob([this.muxer.target.buffer], { type: 'video/mp4' })
  }
}

/** Top-level GPU datamosh: decode → flow-smear → re-encode to MP4. */
export async function gpuDatamosh(
  file: File,
  options: MoshOptions,
  onProgress?: MoshProgress,
): Promise<Blob> {
  if (!isGpuMoshSupported()) throw new GpuUnsupportedError('WebCodecs/WebGL2 unavailable')

  onProgress?.(0, 'Decoding')
  const clip = await decodeClip(file)
  if (clip.frames.length < 2) {
    clip.frames.forEach((f) => f.close())
    throw new GpuUnsupportedError('clip too short')
  }

  const maxDim = options.maxDimension ?? 960
  const scale = Math.min(1, maxDim / Math.max(clip.width, clip.height))
  const W = Math.max(2, Math.round((clip.width * scale) / 2) * 2)
  const H = Math.max(2, Math.round((clip.height * scale) / 2) * 2)

  const canvas = new OffscreenCanvas(W, H)
  const gl = canvas.getContext('webgl2')
  if (!gl) throw new GpuUnsupportedError('no webgl2')

  const enc = new Mp4Encoder(W, H, clip.fps)
  const total = clip.frames.length
  let done = 0

  try {
    runSmear(gl, W, H, clip.frames, clip.fps, { range: options.range, intensity: options.intensity ?? 0.8 }, (ts) => {
      const vf = new VideoFrame(canvas, { timestamp: ts })
      enc.encode(vf)
      vf.close()
      done += 1
      onProgress?.(0.1 + (done / total) * 0.8, 'Smearing')
    })
  } finally {
    clip.frames.forEach((f) => f.close())
  }

  onProgress?.(0.92, 'Encoding')
  const blob = await enc.finish()
  onProgress?.(1, 'Done')
  return blob
}
