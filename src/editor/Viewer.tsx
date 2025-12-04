import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EngineProgress, PlaybackMode, PreviewScale } from '../engine/engine'
import { Project } from '../engine/types'
import { useVideoEngine } from '../engine/worker/workerClient'
import { useProject } from '../shared/hooks/useProject'
import { getActiveClipAtFrame } from './timelineUtils'
import { useSourceThumbnail } from './thumbnailService'

interface Props {
  project: Project
}

const Viewer = ({ project }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { selection, playState, play, pause, stop, stepBackward, stepForward } = useProject()
  const { engine, progress } = useVideoEngine()
  const [previewScale, setPreviewScale] = useState<PreviewScale>('full')
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('realTime')
  const [lastProgress, setLastProgress] = useState<EngineProgress>(progress)
  const currentTimelineFrame = Math.round(selection.currentFrame)
  const activeClip = useMemo(() => getActiveClipAtFrame(project, currentTimelineFrame), [project, currentTimelineFrame])
  const activeSource = useMemo(
    () => project.sources.find((s) => s.id === activeClip?.sourceId),
    [project.sources, activeClip],
  )
  const { url: activeThumbnail, isLoading: thumbnailLoading } = useSourceThumbnail(activeSource)
  const clipOffset = activeClip ? currentTimelineFrame - activeClip.timelineStartFrame : null
  const clipLocalFrame = activeClip && clipOffset !== null ? activeClip.startFrame + clipOffset : null
  const currentTimeSeconds = (clipLocalFrame ?? currentTimelineFrame) / project.timeline.fps

  useEffect(() => setLastProgress(progress), [progress])

  useEffect(() => {
    if (!engine || !project) return
    engine
      .renderFrame(selection.currentFrame, previewScale)
      .then((bitmap) => {
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(bitmap, 0, 0)
      })
      .catch(() => {})
  }, [engine, project, selection.currentFrame, previewScale])

  const timecode = new Date(currentTimeSeconds * 1000).toISOString().substring(14, 23)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26 }}
      className="relative overflow-hidden rounded-xl border border-surface-300/60 bg-surface-200/80 shadow-panel"
    >
      <div className="flex items-center justify-between border-b border-surface-300/60 px-4 py-2 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="uppercase tracking-[0.16em]">Viewer</span>
          <span className="rounded-md border border-surface-300/60 px-2 py-1 font-mono text-[11px] text-slate-300">{timecode}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <button
            onClick={() => (playState === 'playing' ? pause() : play())}
            className="rounded-md border border-surface-300/60 px-2 py-1 text-white transition hover:border-accent/70"
          >
            {playState === 'playing' ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => stop()}
            className="rounded-md border border-surface-300/60 px-2 py-1 text-white transition hover:border-accent/70"
          >
            Stop
          </button>
          <button
            onClick={() => stepBackward()}
            className="rounded-md border border-surface-300/60 px-2 py-1 text-white transition hover:border-accent/70"
          >
            -1f
          </button>
          <button
            onClick={() => stepForward()}
            className="rounded-md border border-surface-300/60 px-2 py-1 text-white transition hover:border-accent/70"
          >
            +1f
          </button>
          <select
            value={previewScale}
            onChange={(e) => setPreviewScale(e.target.value as PreviewScale)}
            className="rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1 text-white"
          >
            <option value="full">Full</option>
            <option value="half">Half</option>
            <option value="quarter">Quarter</option>
          </select>
          <select
            value={playbackMode}
            onChange={(e) => setPlaybackMode(e.target.value as PlaybackMode)}
            className="rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1 text-white"
          >
            <option value="realTime">Real-time</option>
            <option value="frameAccurate">Frame-accurate</option>
          </select>
          <span className="rounded-md border border-surface-300/60 px-2 py-1 text-slate-300">
            {project.settings.width}x{project.settings.height} @ {project.settings.fps}fps
          </span>
        </div>
      </div>
        <div className="relative flex h-[320px] items-center justify-center overflow-hidden bg-gradient-to-br from-surface-200 to-surface-300">
          {activeClip && (
            <div className="absolute inset-0 flex items-center justify-center">
              {activeThumbnail && (
                <img src={activeThumbnail} alt="Active frame preview" className="h-full w-full object-contain" />
              )}
              {!activeThumbnail && thumbnailLoading && (
                <div className="flex h-full w-full items-center justify-center bg-surface-200/80 text-xs text-slate-400">
                  Loading preview…
                </div>
              )}
              {!activeThumbnail && !thumbnailLoading && (
                <div className="flex h-full w-full items-center justify-center bg-surface-200/80 text-xs text-slate-400">
                  Preview unavailable
                </div>
              )}
            </div>
          )}
          {!activeClip && (
            <div className="pointer-events-none relative z-10 flex h-full w-full items-center justify-center px-6 text-center text-sm text-slate-400">
              {project.timeline.clips.length > 0
                ? 'No clip under playhead. Move the playhead over a clip on the timeline.'
                : 'No clips in project yet. Add sources and place clips on the timeline.'}
            </div>
          )}
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain opacity-70" />
          {activeClip && activeSource && (
            <div className="absolute bottom-3 left-3 z-10 rounded-md border border-surface-300/60 bg-surface-900/60 px-3 py-1 text-xs text-white">
              {activeSource.originalName} • Frame {clipLocalFrame ?? currentTimelineFrame}
            </div>
          )}
          <div className="absolute bottom-3 right-3 rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-1 text-xs text-slate-300">
            {lastProgress.phase === 'idle' ? 'Idle' : `${lastProgress.phase} ${(lastProgress.progress * 100).toFixed(0)}%`}
          </div>
        </div>
    </motion.div>
  )
}

export default Viewer
