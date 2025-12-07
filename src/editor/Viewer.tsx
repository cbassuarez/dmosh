import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Pause,
  Play,
  Square,
  StepBack,
  StepForward,
  RotateCcw,
  RotateCw,
  Gauge,
  Layers,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Project, TimelineClip } from '../engine/types'
import {
  buildContextForClip,
  collectGraphsForClip,
  compileMoshPipelineFromGraphs,
  extractActiveMoshOperations,
  type MoshContextFrame,
} from '../engine/moshPipeline'
import type { MoshNode, MoshScopeId } from '../mosh/moshModel'
import { useProject } from '../shared/hooks/useProject'
import { getActiveClipAtFrame, timelineEndFrame } from './timelineUtils'
import { ViewerMode, ViewerOverlays, ViewerResolution } from './viewerState'

interface Props {
  project: Project

  /**
   * Optional Mosh playback configuration. When provided and enabled, Viewer
   * will use the structural mosh engine for playback mapping (Mosh tab only).
   */
  moshEnabled?: boolean
  moshScope?: MoshScopeId | null
  moshNodes?: MoshNode[] | null
}

const resolutionLabel: Record<ViewerResolution, string> = {
  full: 'Full',
  half: '1/2',
  quarter: '1/4',
}

const viewerModes: ViewerMode[] = ['original', 'moshed', 'compare']

const formatTimecode = (frame: number, fps: number) => {
  const totalSeconds = Math.max(0, frame) / fps
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const frames = Math.floor(frame % fps)
  const pad = (value: number, len = 2) => value.toString().padStart(len, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`
}

const OverlayToggle = ({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) => (
  <label className="flex items-center gap-2 text-xs text-slate-200">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
)

interface VideoViewportProps {
  kind: 'original' | 'moshed'
  project: Project
  frame: number
  resolution: ViewerResolution
  overlays: ViewerOverlays
  previewMaxHeight?: number
  bypassMosh?: boolean
  moshEnabled?: boolean
  moshScope?: MoshScopeId | null
  moshNodes?: MoshNode[] | null
}

const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1
  const thirdsX = [width / 3, (2 * width) / 3]
  const thirdsY = [height / 3, (2 * height) / 3]
  thirdsX.forEach((x) => {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  })
  thirdsY.forEach((y) => {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  })
}

const drawSafeArea = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.strokeStyle = 'rgba(52,211,153,0.8)'
  ctx.lineWidth = 2
  const marginX = width * 0.1
  const marginY = height * 0.1
  ctx.strokeRect(marginX, marginY, width - marginX * 2, height - marginY * 2)
}

const drawMotionVectors = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.strokeStyle = 'rgba(94,234,212,0.7)'
  const step = Math.max(20, width / 12)
  for (let x = step; x < width; x += step) {
    for (let y = step; y < height; y += step) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 8, y - 6)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + 8, y - 6)
      ctx.lineTo(x + 3, y - 8)
      ctx.stroke()
    }
  }
}

const drawMasks = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.strokeStyle = 'rgba(59,130,246,0.8)'
  ctx.setLineDash([6, 6])
  ctx.strokeRect(width * 0.2, height * 0.25, width * 0.35, height * 0.3)
  ctx.setLineDash([])
}

const drawGlitchIntensity = (ctx: CanvasRenderingContext2D, width: number, height: number, frame: number) => {
  const intensity = (Math.sin(frame / 10) + 1) / 2
  ctx.fillStyle = `rgba(244,63,94,${0.15 + intensity * 0.25})`
  ctx.fillRect(0, 0, width, height)
}

const mapTimelineFrameToMoshedFrame = (
  frames: MoshContextFrame[],
  clipOffset: number,
  clipDuration: number,
): MoshContextFrame | null => {
  if (!frames.length || clipDuration <= 0) return null
  const clampedOffset = Math.max(0, Math.min(clipDuration - 1, clipOffset))
  const denominator = Math.max(1, clipDuration - 1)
  const ratio = denominator === 0 ? 0 : clampedOffset / denominator
  const targetIndex = Math.min(frames.length - 1, Math.round(ratio * Math.max(frames.length - 1, 0)))
  return frames[targetIndex] ?? null
}

const VideoViewport = ({
  kind,
  project,
  frame,
  resolution,
  overlays,
  previewMaxHeight,
  bypassMosh,
  moshEnabled,
  moshScope,
  moshNodes,
}: VideoViewportProps) => {
    const shouldApplyMoshPlayback =
      kind === 'moshed' && moshEnabled && !(project.moshBypassGlobal ?? false) && !bypassMosh
  const { isPreviewUrlActive } = useProject()
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  void moshScope

  const clip = useMemo(() => getActiveClipAtFrame(project, frame), [project, frame])
  const source = useMemo(() => project.sources.find((s) => s.id === clip?.sourceId), [clip?.sourceId, project.sources])

  const moshGraphs = useMemo(() => (clip ? collectGraphsForClip(project, clip) : collectGraphsForClip(project, null)), [clip, project])
  const compiledPipeline = useMemo(() => compileMoshPipelineFromGraphs(moshGraphs), [moshGraphs])
  const baseContext = useMemo(() => (clip ? buildContextForClip(clip, project.timeline.fps) : null), [clip, project.timeline.fps])
  const shouldApplyMoshPlayback =
    kind === 'moshed' && moshEnabled && !(project.moshBypassGlobal ?? false) && !bypassMosh

    const moshedFrames = useMemo(() => {
      if (!baseContext) return []

      // If we are not in a moshed viewport or mosh is disabled/bypassed,
      // just return the base frames unchanged.
      if (!shouldApplyMoshPlayback) {
        return baseContext.frames
      }

      // Apply the compiled pipeline from all relevant graphs
      const result = compiledPipeline(baseContext)
      return result.frames
    }, [baseContext, compiledPipeline, shouldApplyMoshPlayback])

    const activeOps = useMemo(() => {
      // If mosh is disabled or globally/viewer-bypassed, treat as no active ops.
      if (!moshEnabled || (project.moshBypassGlobal ?? false) || (bypassMosh ?? false)) {
        return []
      }

      // When a per-scope node list is provided (Mosh view), show that.
      if (moshNodes && moshNodes.length > 0) {
        return moshNodes.filter((node) => !node.bypass).map((node) => node.op)
      }

      // Otherwise, compute from all graphs relevant to this clip.
      return extractActiveMoshOperations(moshGraphs)
    }, [moshEnabled, bypassMosh, moshNodes, moshGraphs, project.moshBypassGlobal])

  const clipDuration = useMemo(() => (clip ? Math.max(0, clip.endFrame - clip.startFrame) : 0), [clip])
  const shouldBypassMosh = (project.moshBypassGlobal ?? false) || (bypassMosh ?? false)

  const previewUrl = source?.previewUrl
  const safePreviewUrl =
    typeof previewUrl === 'string' && previewUrl.startsWith('blob:') && !isPreviewUrlActive(previewUrl)
      ? undefined
      : previewUrl

  useEffect(() => {
    if (!videoRef.current || !clip || !safePreviewUrl) return
    const clipOffset = frame - clip.timelineStartFrame
    const clipLocalFrame = clip.startFrame + clipOffset
    const targetFrames = kind === 'moshed' && !shouldBypassMosh ? moshedFrames : baseContext?.frames ?? []
    const mappedFrame = mapTimelineFrameToMoshedFrame(targetFrames, clipOffset, clipDuration)
    const mappedLocalFrame = mappedFrame?.contentFrom ?? clipLocalFrame
    const timeSeconds = mappedLocalFrame / project.timeline.fps
    const video = videoRef.current
    if (Number.isFinite(timeSeconds) && Math.abs(video.currentTime - timeSeconds) > 1 / project.timeline.fps) {
      try {
        video.currentTime = timeSeconds
      } catch {
        /* noop */
      }
    }
  }, [
    baseContext?.frames,
    clip,
    clipDuration,
    frame,
    kind,
    moshedFrames,
    project.timeline.fps,
    safePreviewUrl,
    shouldBypassMosh,
  ])

  useEffect(() => {
    const canvas = overlayRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const resolutionScale = resolution === 'full' ? 1 : resolution === 'half' ? 0.5 : 0.25
    const previewScale = previewMaxHeight ? Math.min(1, previewMaxHeight / project.settings.height) : 1
    const scale = resolutionScale * previewScale
    const width = Math.max(container.clientWidth, Math.round(project.settings.width * scale))
    const height = Math.max(container.clientHeight, Math.round(project.settings.height * scale))
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)

    if (overlays.grid) drawGrid(ctx, width, height)
    if (overlays.safeArea) drawSafeArea(ctx, width, height)
    if (overlays.masks) drawMasks(ctx, width, height)
    if (overlays.motionVectors) drawMotionVectors(ctx, width, height)
    if (overlays.glitchIntensity) drawGlitchIntensity(ctx, width, height, frame)
    if (overlays.timecode) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'
      ctx.fillRect(width - 150, 12, 138, 28)
      ctx.fillStyle = 'white'
      ctx.font = '14px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.fillText(formatTimecode(frame, project.timeline.fps), width - 140, 32)
    }
    if (overlays.clipName && clip && source) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'
      ctx.fillRect(12, 12, Math.min(width - 24, 220), 26)
      ctx.fillStyle = 'white'
      ctx.font = '13px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.fillText(source.originalName, 20, 30)
    }
  }, [
    clip,
    frame,
    overlays.clipName,
    overlays.glitchIntensity,
    overlays.grid,
    overlays.masks,
    overlays.motionVectors,
    overlays.safeArea,
    overlays.timecode,
    previewMaxHeight,
    project.settings.height,
    project.settings.width,
    project.timeline.fps,
    resolution,
    source,
  ])

  if (!clip || !safePreviewUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400" data-testid={`viewport-${kind}`}>
        No clip under playhead
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative h-full w-full" data-testid={`viewport-${kind}`}>
      <video
        ref={videoRef}
        src={safePreviewUrl}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
      />
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {kind === 'moshed' && (
        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[60%] flex-col gap-1 text-[11px] text-white">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface-900/80 px-3 py-[6px] font-mono uppercase tracking-[0.12em] text-slate-100">
            {shouldBypassMosh
              ? 'Mosh bypassed'
              : activeOps.length > 0
                ? `Mosh pipeline: ${activeOps.join(' · ')}`
                : 'Mosh pipeline: none'}
          </span>
          {shouldBypassMosh && (
            <span className="rounded-full bg-amber-500/80 px-3 py-[6px] font-mono uppercase tracking-[0.12em] text-surface-900">
              Global or viewer bypass is enabled
            </span>
          )}
        </div>
      )}
    </div>
  )
}

const CompareView = ({
  project,
  frame,
  resolution,
  overlays,
  previewMaxHeight,
  bypassMosh,
  moshEnabled,
  moshScope,
  moshNodes,
}: {
  project: Project
  frame: number
  resolution: ViewerResolution
  overlays: ViewerOverlays
  previewMaxHeight?: number
  bypassMosh: boolean
  moshEnabled?: boolean
  moshScope?: MoshScopeId | null
  moshNodes?: MoshNode[] | null
}) => (
  <div className="grid h-full grid-cols-2 gap-[1px] bg-surface-900">
    <VideoViewport
      kind="original"
      project={project}
      frame={frame}
      resolution={resolution}
      overlays={overlays}
      previewMaxHeight={previewMaxHeight}
    />
    <VideoViewport
      kind="moshed"
      project={project}
      frame={frame}
      resolution={resolution}
      overlays={overlays}
      previewMaxHeight={previewMaxHeight}
      bypassMosh={bypassMosh}
      moshEnabled={moshEnabled}
      moshScope={moshScope}
      moshNodes={moshNodes}
    />
  </div>
)

const ModeToggle = ({
  mode,
  onChange,
  options,
}: {
  mode: ViewerMode
  onChange: (mode: ViewerMode) => void
  options: ViewerMode[]
}) => (
  <div className="flex items-center gap-2 rounded-md border border-surface-300/60 bg-surface-300/30 p-1">
    {options.map((option) => (
      <button
        key={option}
        onClick={() => onChange(option)}
        className={`rounded px-3 py-[6px] text-xs uppercase tracking-[0.12em] ${
          option === mode ? 'bg-accent text-black shadow' : 'text-slate-200 hover:bg-surface-100/20'
        }`}
      >
        {option}
      </button>
    ))}
  </div>
)

const Viewer = ({ project, moshEnabled, moshScope, moshNodes }: Props) => {
  const {
    transport,
    viewer,
    viewerRuntimeSettings,
    setViewerMode,
    setViewerResolution,
    setViewerOverlays,
    setViewerRuntimeSettings,
    setPlayState,
    setTimelineFrame,
  } = useProject()
  const [overlayOpen, setOverlayOpen] = useState(false)
  const currentTimelineFrame = Math.round(transport.currentTimelineFrame)
  const activeClip: TimelineClip | null = useMemo(
    () => getActiveClipAtFrame(project, currentTimelineFrame),
    [project, currentTimelineFrame],
  )
  const timelineLastFrame = useMemo(() => timelineEndFrame(project.timeline), [project.timeline])
  const playbackLabel = transport.playState === 'playing' ? 'Playing' : transport.playState === 'paused' ? 'Paused' : 'Stopped'
  const bypassMosh = viewerRuntimeSettings.bypassMosh ?? false

  const step = (delta: number) => {
    setPlayState('paused')
    setTimelineFrame(Math.max(0, currentTimelineFrame + delta))
  }

  const onStop = () => {
    setPlayState('stopped')
    setTimelineFrame(0)
  }

  const togglePlay = () => {
    setPlayState(transport.playState === 'playing' ? 'paused' : 'playing')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26 }}
      className="relative overflow-hidden rounded-xl border border-surface-300/60 bg-surface-200/80 shadow-panel"
    >
      <div className="flex items-center justify-between border-b border-surface-300/60 px-4 py-3 text-xs text-slate-200">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Viewer</span>
          <ModeToggle mode={viewer.mode} onChange={setViewerMode} options={viewerModes} />
        </div>
        <div className="font-mono text-[13px] tracking-[0.12em] text-white">
          {formatTimecode(currentTimelineFrame, project.timeline.fps)}
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="relative">
            <button
              onClick={() => setOverlayOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-surface-300/60 px-3 py-2 text-white transition hover:border-accent/70"
            >
              <Layers className="h-4 w-4" /> Overlays
            </button>
            {overlayOpen && (
              <div className="absolute right-0 top-10 z-20 w-52 rounded-md border border-surface-300/60 bg-surface-200/95 p-3 shadow-xl">
                <div className="space-y-2">
                  <OverlayToggle
                    label="Safe area"
                    checked={viewer.overlays.safeArea}
                    onChange={(value) => setViewerOverlays({ safeArea: value })}
                  />
                  <OverlayToggle label="Grid" checked={viewer.overlays.grid} onChange={(value) => setViewerOverlays({ grid: value })} />
                  <OverlayToggle
                    label="Timecode"
                    checked={viewer.overlays.timecode}
                    onChange={(value) => setViewerOverlays({ timecode: value })}
                  />
                  <OverlayToggle
                    label="Clip name"
                    checked={viewer.overlays.clipName}
                    onChange={(value) => setViewerOverlays({ clipName: value })}
                  />
                  <OverlayToggle
                    label="Masks"
                    checked={viewer.overlays.masks}
                    onChange={(value) => setViewerOverlays({ masks: value })}
                  />
                  <OverlayToggle
                    label="Motion vectors"
                    checked={viewer.overlays.motionVectors}
                    onChange={(value) => setViewerOverlays({ motionVectors: value })}
                  />
                  <OverlayToggle
                    label="Glitch intensity"
                    checked={viewer.overlays.glitchIntensity}
                    onChange={(value) => setViewerOverlays({ glitchIntensity: value })}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-md border border-surface-300/60 px-2 py-1">
            <Gauge className="h-4 w-4 text-slate-400" />
            <select
              value={viewer.resolution}
              onChange={(e) => setViewerResolution(e.target.value as ViewerResolution)}
              className="bg-transparent text-white focus:outline-none"
            >
              <option value="full">Full</option>
              <option value="half">1/2</option>
              <option value="quarter">1/4</option>
            </select>
            <span className="rounded-full bg-surface-100/40 px-2 py-[2px] text-[11px] text-slate-300">{resolutionLabel[viewer.resolution]} res</span>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-surface-300/60 px-3 py-2 text-[11px] text-slate-200">
            <input
              type="checkbox"
              checked={bypassMosh}
              onChange={(e) => setViewerRuntimeSettings({ bypassMosh: e.target.checked })}
            />
            Bypass mosh operations
          </label>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-surface-300/60 bg-black/80" data-testid="viewer-preview">
          {viewer.mode === 'compare' && (
            <CompareView
              project={project}
              frame={currentTimelineFrame}
              resolution={viewer.resolution}
              overlays={viewer.overlays}
              previewMaxHeight={viewerRuntimeSettings.previewMaxHeight}
              bypassMosh={bypassMosh || (project.moshBypassGlobal ?? false)}
              moshEnabled={moshEnabled}
              moshScope={moshScope}
              moshNodes={moshNodes}
            />
          )}
          {viewer.mode === 'original' && (
            <VideoViewport
              kind="original"
              project={project}
              frame={currentTimelineFrame}
              resolution={viewer.resolution}
              overlays={viewer.overlays}
              previewMaxHeight={viewerRuntimeSettings.previewMaxHeight}
            />
          )}
          {viewer.mode === 'moshed' && (
            <VideoViewport
              kind="moshed"
              project={project}
              frame={currentTimelineFrame}
              resolution={viewer.resolution}
              overlays={viewer.overlays}
              previewMaxHeight={viewerRuntimeSettings.previewMaxHeight}
              bypassMosh={bypassMosh || (project.moshBypassGlobal ?? false)}
              moshEnabled={moshEnabled}
              moshScope={moshScope}
              moshNodes={moshNodes}
            />
          )}
          {!activeClip && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-surface-900/40 px-6 text-center text-sm text-slate-300">
              {project.timeline.clips.length > 0
                ? 'No clip under playhead. Move the playhead over a clip on the timeline.'
                : 'No clips in project yet. Add sources and place clips on the timeline.'}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-surface-300/60 bg-surface-300/40 px-4 py-3 text-xs text-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={onStop}
              className="rounded-md border border-surface-300/60 p-2 text-white transition hover:border-accent/70"
              aria-label="Stop"
            >
              <Square className="h-4 w-4" />
            </button>
            <button
              onClick={togglePlay}
              className="rounded-md border border-surface-300/60 p-2 text-white transition hover:border-accent/70"
              aria-label={transport.playState === 'playing' ? 'Pause' : 'Play'}
            >
              {transport.playState === 'playing' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={() => step(-1)}
              className="rounded-md border border-surface-300/60 p-2 text-white transition hover:border-accent/70"
              aria-label="Step backward"
            >
              <StepBack className="h-4 w-4" />
            </button>
            <button
              onClick={() => step(1)}
              className="rounded-md border border-surface-300/60 p-2 text-white transition hover:border-accent/70"
              aria-label="Step forward"
            >
              <StepForward className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTimelineFrame(0)}
              className="rounded-md border border-surface-300/60 p-2 text-white transition hover:border-accent/70"
              aria-label="Jump to start"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTimelineFrame(timelineLastFrame)}
              className="rounded-md border border-surface-300/60 p-2 text-white transition hover:border-accent/70"
              aria-label="Jump to end"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-300">
            <span className="rounded-full border border-surface-300/60 px-3 py-1">{playbackLabel}</span>
            <span className="rounded-full border border-surface-300/60 px-3 py-1">
              Preview {resolutionLabel[viewer.resolution]}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default Viewer
