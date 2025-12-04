/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Project, TimelineClip } from '../engine/types'
import { useProject } from '../shared/hooks/useProject'

interface Props {
  project: Project
}

const FRAME_COLORS = {
  I: 'bg-emerald-500',
  P: 'bg-blue-500',
  B: 'bg-slate-400',
}

export const generateFramePattern = (length: number) => {
  const pattern: ('I' | 'P' | 'B')[] = []
  for (let i = 0; i < length; i += 1) {
    if (i % 30 === 0) {
      pattern.push('I')
    } else if (i % 3 === 0) {
      pattern.push('P')
    } else {
      pattern.push('B')
    }
  }
  return pattern
}

export const framesToPx = (frames: number, zoom: number) => Math.max(2, frames * zoom)

const Timeline = ({ project }: Props) => {
  const { selection, selectClip, setCurrentFrame, setTimeRange, placeClipFromSource, moveClip, trimClip, addTrack } =
    useProject()
  const [zoom, setZoom] = useState(2)
  const [dragClip, setDragClip] = useState<{ id: string; startX: number; original: number } | null>(null)
  const [trimState, setTrimState] = useState<{ id: string; edge: 'start' | 'end'; startX: number } | null>(null)
  const [rangeStart, setRangeStart] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (dragClip && containerRef.current) {
        const deltaPx = event.clientX - dragClip.startX
        moveClip(dragClip.id, Math.round(deltaPx / zoom))
        setDragClip((prev) => (prev ? { ...prev, startX: event.clientX } : null))
      }
      if (trimState && containerRef.current) {
        const deltaPx = event.clientX - trimState.startX
        trimClip(trimState.id, trimState.edge, Math.round(deltaPx / zoom))
        setTrimState((prev) => (prev ? { ...prev, startX: event.clientX } : null))
      }
    }
    const onUp = () => {
      setDragClip(null)
      setTrimState(null)
      setRangeStart(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragClip, trimState, zoom, moveClip, trimClip])

  const onDrop = (event: React.DragEvent<HTMLDivElement>, trackId: string) => {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/source-id')
    if (!sourceId) return
    const rect = containerRef.current?.getBoundingClientRect()
    const px = event.clientX - (rect?.left ?? 0)
    placeClipFromSource(sourceId, Math.round(px / zoom), trackId)
  }

  const onBackgroundMouseDown = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    const px = (event.clientX - (rect?.left ?? 0)) / zoom
    selectClip(null)
    setRangeStart(px)
    setTimeRange(null)
  }

  const onBackgroundMouseUp = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (rangeStart === null) return
    const rect = containerRef.current?.getBoundingClientRect()
    const px = (event.clientX - (rect?.left ?? 0)) / zoom
    const start = Math.floor(Math.min(rangeStart, px))
    const end = Math.ceil(Math.max(rangeStart, px))
    setTimeRange({ startFrame: start, endFrame: end })
    setCurrentFrame(end)
    setRangeStart(null)
  }

  const renderClip = (clip: TimelineClip) => {
    const width = framesToPx(clip.endFrame - clip.startFrame, zoom)
    const left = framesToPx(clip.timelineStartFrame, zoom)
    const pattern = generateFramePattern(clip.endFrame - clip.startFrame)

    return (
      <motion.div
        key={clip.id}
        layout
        style={{ width, left }}
        className={`absolute top-2 h-14 rounded-md border ${
          selection.selectedClipId === clip.id ? 'border-accent bg-accent/30' : 'border-surface-300/60 bg-surface-300/80'
        } px-3 py-2`}
        onMouseDown={(e) => {
          e.stopPropagation()
          setRangeStart(null)
          selectClip(clip.id)
          setCurrentFrame(clip.timelineStartFrame)
          setDragClip({ id: clip.id, startX: e.clientX, original: clip.timelineStartFrame })
        }}
      >
        <div className="flex items-center justify-between text-xs text-white">
          <span>{clip.id}</span>
          <span className="text-[10px] text-slate-200">{clip.startFrame}–{clip.endFrame}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-300">
          <span
            className="cursor-ew-resize"
            onMouseDown={(e) => {
              e.stopPropagation()
              setTrimState({ id: clip.id, edge: 'start', startX: e.clientX })
            }}
          >
            ◀
          </span>
          <div className="flex h-4 flex-1 items-center gap-[2px] overflow-hidden">
            {pattern.slice(0, 120).map((type, idx) => (
              <div key={`${clip.id}-${idx}`} className={`h-full w-[2px] ${FRAME_COLORS[type]}`} />
            ))}
          </div>
          <span
            className="cursor-ew-resize"
            onMouseDown={(e) => {
              e.stopPropagation()
              setTrimState({ id: clip.id, edge: 'end', startX: e.clientX })
            }}
          >
            ▶
          </span>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="rounded-xl border border-surface-300/60 bg-surface-200/80 p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Timeline</p>
          <p className="text-sm text-slate-300">
            {project.settings.width}x{project.settings.height} @ {project.settings.fps}fps
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <button
            className="rounded-md border border-surface-300/60 px-2 py-1 hover:border-accent"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}
          >
            -
          </button>
          <span className="w-14 text-center">{zoom.toFixed(1)}x</span>
          <button
            className="rounded-md border border-surface-300/60 px-2 py-1 hover:border-accent"
            onClick={() => setZoom((z) => Math.min(8, z + 0.5))}
          >
            +
          </button>
          <button
            className="rounded-md border border-surface-300/60 px-3 py-1 hover:border-accent"
            onClick={addTrack}
          >
            + Track
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-3" ref={containerRef}>
        {project.timeline.tracks
          .slice()
          .sort((a, b) => a.index - b.index)
          .map((track) => (
            <div key={track.id} className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="rounded border border-surface-300/60 px-2 py-1 font-mono text-[11px] text-white">{track.name}</span>
                <span className="text-slate-500">Video track</span>
              </div>
              <div
                className="relative h-20 overflow-hidden rounded-lg border border-surface-300/60 bg-surface-300/60"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, track.id)}
                onMouseDown={onBackgroundMouseDown}
                onMouseUp={onBackgroundMouseUp}
              >
                {project.timeline.clips
                  .filter((clip) => clip.trackId === track.id)
                  .map((clip) => renderClip(clip))}
                {selection.timeRange && (
                  <div
                    className="absolute top-0 h-full bg-accent/10"
                    style={{
                      left: framesToPx(selection.timeRange.startFrame, zoom),
                      width: framesToPx(Math.max(1, selection.timeRange.endFrame - selection.timeRange.startFrame), zoom),
                    }}
                  />
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export default Timeline

