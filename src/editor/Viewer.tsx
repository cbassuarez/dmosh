import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { EngineProgress, PlaybackMode, PreviewScale } from '../engine/engine'
import { Project } from '../engine/types'
import { useVideoEngine } from '../engine/worker/workerClient'
import { useProject } from '../shared/hooks/useProject'

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

  const seconds = selection.currentFrame / project.settings.fps
  const timecode = new Date(seconds * 1000).toISOString().substring(14, 23)

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
      <div className="relative flex h-[320px] items-center justify-center bg-gradient-to-br from-surface-200 to-surface-300">
        <canvas ref={canvasRef} className="h-full w-full object-contain" />
        <div className="absolute bottom-3 right-3 rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-1 text-xs text-slate-300">
          {lastProgress.phase === 'idle' ? 'Idle' : `${lastProgress.phase} ${(lastProgress.progress * 100).toFixed(0)}%`}
        </div>
      </div>
    </motion.div>
  )
}

export default Viewer
