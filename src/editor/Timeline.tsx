/* eslint-disable react-refresh/only-export-components */
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Project, Source, TimelineClip } from '../engine/types'
import { useProject } from '../shared/hooks/useProject'
import {
  FRAME_COLORS,
  framesToPx,
  generateFramePattern,
} from './timelineUtils'
import { useSourceThumbnail } from './thumbnailService'

export { framesToPx, generateFramePattern } from './timelineUtils'

interface Props {
  project: Project
}

type TimelineClipBlockProps = {
  clip: TimelineClip
  source?: Source
  zoom: number
  isSelected: boolean
  onSelect: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
  onTrimStart: (edge: 'start' | 'end', event: React.MouseEvent<HTMLSpanElement, MouseEvent>) => void
}

const TimelineClipBlock = ({ clip, source, zoom, isSelected, onSelect, onTrimStart }: TimelineClipBlockProps) => {
  const width = framesToPx(clip.endFrame - clip.startFrame, zoom)
  const left = framesToPx(clip.timelineStartFrame, zoom)
  const pattern = generateFramePattern(clip.endFrame - clip.startFrame)
  const { url, isLoading } = useSourceThumbnail(source)

  return (
    <motion.div
      layout
      style={{ width, left }}
      className={`absolute top-2 h-14 overflow-hidden rounded-md border ${
        isSelected ? 'border-accent bg-accent/30' : 'border-surface-300/60 bg-surface-300/80'
      } px-3 py-2`}
      onMouseDown={onSelect}
    >
      <div className="pointer-events-none absolute inset-0 opacity-75">
        {url && <img src={url} alt={`${source?.originalName ?? clip.sourceId} thumbnail`} className="h-full w-full object-cover" />}
        {!url && isLoading && <div className="h-full w-full animate-pulse bg-surface-400/50" />}
        {!url && !isLoading && <div className="h-full w-full bg-surface-400/30" />}
        <div className="absolute inset-0 bg-gradient-to-r from-surface-900/50 via-surface-900/10 to-surface-900/50" />
      </div>
      <div className="relative z-10 flex items-center justify-between text-xs text-white">
        <span>{source?.originalName ?? clip.id}</span>
        <span className="text-[10px] text-slate-200">{clip.startFrame}–{clip.endFrame}</span>
      </div>
      <div className="relative z-10 mt-2 flex items-center gap-2 text-[11px] text-slate-200">
        <span
          className="cursor-ew-resize"
          onMouseDown={(e) => {
            e.stopPropagation()
            onTrimStart('start', e)
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
            onTrimStart('end', e)
          }}
        >
          ▶
        </span>
      </div>
    </motion.div>
  )
}

const Timeline = ({ project }: Props) => {
  const {
    selection,
    selectClip,
    setCurrentFrame,
    setTimelineFrame,
    setTimeRange,
    placeClipFromSource,
    moveClip,
    trimClip,
    addTrack,
    removeTrack,
    reorderTrack,
    setPlayState,
  } = useProject()
  const [zoom, setZoom] = useState(2)
  const [dragClip, setDragClip] = useState<{ id: string; startX: number; original: number } | null>(null)
  const [trimState, setTrimState] = useState<{ id: string; edge: 'start' | 'end'; startX: number } | null>(null)
  const [rangeStart, setRangeStart] = useState<number | null>(null)
  const [playheadDrag, setPlayheadDrag] = useState(false)
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
      if (playheadDrag && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const px = (event.clientX - rect.left) / zoom
        setPlayState('paused')
        setTimelineFrame(Math.max(0, Math.round(px)))
      }
    }
    const onUp = () => {
      setDragClip(null)
      setTrimState(null)
      setRangeStart(null)
      setPlayheadDrag(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragClip, trimState, zoom, moveClip, trimClip, playheadDrag, setPlayState, setTimelineFrame])

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
    setPlayState('paused')
    setTimelineFrame(Math.max(0, Math.round(px)))
    setPlayheadDrag(true)
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
    setTimelineFrame(end)
    setRangeStart(null)
  }

  const handleRemoveTrack = (trackId: string) => {
    const hasClips = project.timeline.clips.some((clip) => clip.trackId === trackId)
    if (!hasClips || window.confirm('Delete track and clips? This will delete this track and all clips on it. This cannot be undone.')) {
      removeTrack(trackId)
    }
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
          .map((track, trackIdx) => (
            <div key={track.id} className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="rounded border border-surface-300/60 px-2 py-1 font-mono text-[11px] text-white">{track.name}</span>
                <span className="text-slate-500">Video track</span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    className="rounded border border-surface-300/60 px-2 py-[2px] text-white hover:border-accent disabled:opacity-40"
                    disabled={trackIdx === 0}
                    onClick={() => reorderTrack(track.id, project.timeline.tracks[trackIdx - 1]?.id ?? track.id)}
                  >
                    ↑
                  </button>
                  <button
                    className="rounded border border-surface-300/60 px-2 py-[2px] text-white hover:border-accent disabled:opacity-40"
                    disabled={trackIdx === project.timeline.tracks.length - 1}
                    onClick={() => reorderTrack(track.id, project.timeline.tracks[trackIdx + 1]?.id ?? track.id)}
                  >
                    ↓
                  </button>
                  <button
                    className="rounded border border-surface-300/60 px-2 py-[2px] text-white hover:border-accent"
                    onClick={() => handleRemoveTrack(track.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div
                className="relative h-20 overflow-hidden rounded-lg border border-surface-300/60 bg-surface-300/60"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, track.id)}
                onMouseDown={onBackgroundMouseDown}
                onMouseUp={onBackgroundMouseUp}
              >
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-accent"
                  style={{ left: framesToPx(selection.currentFrame, zoom) }}
                />
                {project.timeline.clips
                  .filter((clip) => clip.trackId === track.id)
                  .map((clip) => {
                    const source = project.sources.find((s) => s.id === clip.sourceId)
                    return (
                      <TimelineClipBlock
                        key={clip.id}
                        clip={clip}
                        source={source}
                        zoom={zoom}
                        isSelected={selection.selectedClipId === clip.id}
                        onSelect={(e) => {
                          e.stopPropagation()
                          setRangeStart(null)
                          selectClip(clip.id)
                          setCurrentFrame(clip.timelineStartFrame)
                          setDragClip({ id: clip.id, startX: e.clientX, original: clip.timelineStartFrame })
                        }}
                        onTrimStart={(edge, event) => {
                          event.stopPropagation()
                          setTrimState({ id: clip.id, edge, startX: event.clientX })
                        }}
                      />
                    )
                  })}
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

