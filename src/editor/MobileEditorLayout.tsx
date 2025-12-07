import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BadgeHelp,
  Clapperboard,
  Download,
  FolderDown,
  MoreVertical,
  PencilLine,
  Play,
  Plus,
  Square,
  Wand2,
} from 'lucide-react'
import type { RenderResolutionScale, RenderSettings } from '../engine/renderTypes'
import { type Project } from '../engine/types'
import { useProject } from '../shared/hooks/useProject'
import { framesToPx, timelineEndFrame } from './timelineUtils'
import Viewer from './Viewer'
import ProjectPanel from './ProjectPanel'
import Inspector from './Inspector'
import MaskTools from './MaskTools'
import RenderQueuePanel from './RenderQueuePanel'
import { MobileMode } from './mobileTypes'
import MoshGraphPanel from '../mosh/ui/MoshGraphPanel'

const navItems: { id: MobileMode; label: string; icon: React.ReactNode }[] = [
  { id: 'project', label: 'Project', icon: <Clapperboard className="h-5 w-5" /> },
  { id: 'edit', label: 'Edit', icon: <PencilLine className="h-5 w-5" /> },
  { id: 'mosh', label: 'Mosh', icon: <Wand2 className="h-5 w-5" /> },
  { id: 'export', label: 'Export', icon: <Download className="h-5 w-5" /> },
]

const AppBarMobile = ({ project, onImport, onNew }: { project: Project; onImport: () => void; onNew: () => void }) => (
  <header className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-300/60 bg-surface-900/90 px-4 py-3 backdrop-blur">
    <div className="flex items-center gap-3">
      <button aria-label="Help" className="rounded-full border border-surface-300/60 p-2 text-slate-300">
        <BadgeHelp className="h-4 w-4" />
      </button>
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Project</p>
        <p className="font-semibold text-white">{project.metadata.name}</p>
      </div>
    </div>
    <div className="flex items-center gap-2 text-xs text-slate-300">
      <button
        onClick={onImport}
        className="flex items-center gap-2 rounded-full border border-surface-300/60 px-3 py-2 text-white transition hover:border-accent/70"
      >
        <FolderDown className="h-4 w-4" /> Import
      </button>
      <button
        onClick={onNew}
        className="flex items-center gap-2 rounded-full border border-surface-300/60 px-3 py-2 text-white transition hover:border-accent/70"
      >
        <Plus className="h-4 w-4" /> New
      </button>
      <button className="rounded-full border border-surface-300/60 p-2 text-white">
        <MoreVertical className="h-4 w-4" />
      </button>
    </div>
  </header>
)

const BottomNavMobile = ({ mode, onChange }: { mode: MobileMode; onChange: (mode: MobileMode) => void }) => (
  <nav className="sticky bottom-0 z-10 grid grid-cols-4 border-t border-surface-300/60 bg-surface-900/90 text-slate-200">
    {navItems.map((item) => (
      <button
        key={item.id}
        onClick={() => onChange(item.id)}
        className={`flex flex-col items-center justify-center gap-1 py-3 text-xs ${
          item.id === mode ? 'text-accent' : 'text-slate-300'
        }`}
      >
        {item.icon}
        <span className="font-medium">{item.label}</span>
      </button>
    ))}
  </nav>
)

const TimelineClipBadge = ({
  width,
  left,
  label,
  isSelected,
  onMouseDown,
}: {
  width: number
  left: number
  label: string
  isSelected: boolean
  onMouseDown: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
}) => (
  <div
    className={`absolute top-2 h-14 rounded-lg border px-3 py-2 text-left text-xs font-medium ${
      isSelected ? 'border-accent bg-accent/20 text-white' : 'border-surface-300/60 bg-surface-300/60 text-slate-200'
    }`}
    style={{ width, left }}
    onMouseDown={onMouseDown}
  >
    {label}
  </div>
)

const TrackSelector = ({
  trackIds,
  activeTrackId,
  onChange,
}: {
  trackIds: { id: string; name: string }[]
  activeTrackId: string
  onChange: (id: string) => void
}) => (
  <div className="flex gap-2 overflow-x-auto pb-2">
    {trackIds.map((track) => (
      <button
        key={track.id}
        onClick={() => onChange(track.id)}
        className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs transition ${
          track.id === activeTrackId
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-surface-300/60 text-slate-300 hover:border-accent/60'
        }`}
      >
        {track.name}
      </button>
    ))}
  </div>
)

const TimelineStripMobile = () => {
  const {
    project,
    selection,
    setPlayState,
    setTimelineFrame,
    selectClip,
    moveClip,
    trimClip,
    setTimeRange,
    setCurrentFrame,
    activeMobileTrackId,
    setActiveMobileTrackId,
  } = useProject()
  const [zoom, setZoom] = useState<number>(2)
  const [dragClip, setDragClip] = useState<{ id: string; startX: number } | null>(null)
  const [trimState, setTrimState] = useState<{ id: string; edge: 'start' | 'end'; startX: number } | null>(null)
  const [playheadDrag, setPlayheadDrag] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeTrack = useMemo(() => {
    const defaultTrack = project?.timeline.tracks[0]
    return project?.timeline.tracks.find((t) => t.id === activeMobileTrackId) ?? defaultTrack
  }, [activeMobileTrackId, project])

  useEffect(() => {
    if (!project || !activeTrack) return
    setActiveMobileTrackId(activeTrack.id)
  }, [activeTrack, project, setActiveMobileTrackId])

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
      setPlayheadDrag(false)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragClip, moveClip, trimClip, playheadDrag, setPlayState, setTimelineFrame, zoom, trimState])

  if (!project || !activeTrack) return null

  const clips = project.timeline.clips.filter((clip) => clip.trackId === activeTrack.id)

  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-200/80 p-4 shadow-panel">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Timeline</p>
          <p className="text-sm text-white">{project.settings.width}x{project.settings.height} @ {project.settings.fps}fps</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-surface-300/60 px-2 py-1 hover:border-accent"
            onClick={() => setZoom((z) => Math.max(0.5, Number(z) - 0.5))}
          >
            -
          </button>
          <span className="w-14 text-center">{Number(zoom).toFixed(1)}x</span>
          <button
            className="rounded-md border border-surface-300/60 px-2 py-1 hover:border-accent"
            onClick={() => setZoom((z) => Math.min(8, Number(z) + 0.5))}
          >
            +
          </button>
        </div>
      </div>

      <TrackSelector
        trackIds={project.timeline.tracks.map((t, idx) => ({ id: t.id, name: t.name ?? `Track ${idx + 1}` }))}
        activeTrackId={activeTrack.id}
        onChange={(id) => setActiveMobileTrackId(id)}
      />

      <div
        ref={containerRef}
        className="relative mt-2 h-28 overflow-hidden rounded-xl border border-surface-300/60 bg-surface-300/60"
        onMouseDown={(event) => {
          const rect = containerRef.current?.getBoundingClientRect()
          const px = ((event.clientX - (rect?.left ?? 0)) / Number(zoom)) as number
          selectClip(null)
          setPlayState('paused')
          setTimelineFrame(Math.max(0, Math.round(px)))
          setTimeRange(null)
          setCurrentFrame(Math.max(0, Math.round(px)))
          setPlayheadDrag(true)
        }}
      >
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-accent"
          style={{ left: framesToPx(selection.currentFrame, Number(zoom)) }}
        />

        {clips.map((clip) => {
          const width = framesToPx(clip.endFrame - clip.startFrame, Number(zoom))
          const left = framesToPx(clip.timelineStartFrame, Number(zoom))
          return (
            <div key={clip.id}>
              <div
                className="absolute top-4 flex h-16 items-center"
                style={{ left, width }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  selectClip(clip.id)
                  setCurrentFrame(clip.timelineStartFrame)
                  setDragClip({ id: clip.id, startX: e.clientX })
                }}
              >
                <TimelineClipBadge
                  width={width}
                  left={0}
                  label={clip.id}
                  isSelected={selection.selectedClipId === clip.id}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    selectClip(clip.id)
                    setCurrentFrame(clip.timelineStartFrame)
                    setDragClip({ id: clip.id, startX: e.clientX })
                  }}
                />
                <button
                  className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-1 text-[10px] text-white"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setTrimState({ id: clip.id, edge: 'start', startX: e.clientX })
                  }}
                >
                  ◀
                </button>
                <button
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-1 text-[10px] text-white"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setTrimState({ id: clip.id, edge: 'end', startX: e.clientX })
                  }}
                >
                  ▶
                </button>
              </div>
            </div>
          )
        })}

        {selection.timeRange && (
          <div
            className="absolute top-0 h-full bg-accent/10"
            style={{
              left: framesToPx(selection.timeRange.startFrame, Number(zoom)),
              width: framesToPx(Math.max(1, selection.timeRange.endFrame - selection.timeRange.startFrame), Number(zoom)),
            }}
          />
        )}
      </div>
    </div>
  )
}

type MobilePreset = { id: string; label: string; apply: (settings: RenderSettings) => RenderSettings }

const presetOptions: MobilePreset[] = [
  {
    id: 'h264-preview',
    label: 'Quick Preview (1/2 res)',
    apply: (settings: RenderSettings) => ({
      ...settings,
      renderResolutionScale: 0.5 as RenderResolutionScale,
      previewOnly: true,
      container: 'mp4',
      videoCodec: 'h264',
    }),
  },
  {
    id: 'h264-1080',
    label: 'H.264 1080p',
    apply: (settings: RenderSettings) => ({
      ...settings,
      outputResolution: 'custom',
      width: 1920,
      height: 1080,
      renderResolutionScale: 1 as RenderResolutionScale,
      previewOnly: false,
      container: 'mp4',
      videoCodec: 'h264',
    }),
  },
  {
    id: 'prores-master',
    label: 'ProRes 422 HQ',
    apply: (settings: RenderSettings) => ({
      ...settings,
      container: 'mov',
      videoCodec: 'prores_422_hq',
      renderResolutionScale: 1 as RenderResolutionScale,
      previewOnly: false,
    }),
  },
]

const ExportSheetMobile = ({ project, onClose }: { project: Project; onClose: () => void }) => {
  const { selection, addRenderJob, startRenderJob } = useProject()
  const defaultRange = selection.timeRange ?? { startFrame: 0, endFrame: timelineEndFrame(project.timeline) }
  const [preset, setPreset] = useState(presetOptions[0])
  const [settings, setSettings] = useState<RenderSettings>(() => ({
    id: crypto.randomUUID(),
    projectId: project.metadata.name,
    source: { kind: 'timeline', inFrame: defaultRange.startFrame, outFrame: defaultRange.endFrame },
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    outputResolution: 'project',
    width: project.settings.width,
    height: project.settings.height,
    fpsMode: 'project',
    fps: project.settings.fps,
    pixelFormat: 'yuv420p',
    rateControl: { mode: 'crf', value: 20 },
    keyframeInterval: 'auto',
    bFrames: 'auto',
    includeAudio: true,
    audioSampleRate: 48000,
    audioChannels: 2,
    datamosh: { mode: 'none' },
    preserveBrokenGOP: true,
    burnInTimecode: false,
    burnInClipName: false,
    burnInMasks: false,
    renderResolutionScale: 1,
    previewOnly: false,
    fileName: `${project.metadata.name}-mobile-export`,
    fileExtension: 'mp4',
  }))

  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      source: { kind: 'timeline', inFrame: defaultRange.startFrame, outFrame: defaultRange.endFrame },
      width: project.settings.width,
      height: project.settings.height,
      fps: project.settings.fps,
    }))
  }, [defaultRange.endFrame, defaultRange.startFrame, project.settings.fps, project.settings.height, project.settings.width])

  const summary = useMemo(
    () => `${settings.width}x${settings.height} @ ${settings.fps}fps • ${preset.label}`,
    [preset.label, settings.fps, settings.height, settings.width],
  )

  const startExport = () => {
    const applied = preset.apply(settings)
    const jobSettings: RenderSettings = { ...applied, id: crypto.randomUUID() }
    addRenderJob({ id: jobSettings.id, projectId: project.metadata.name ?? 'project', settings: jobSettings })
    startRenderJob(jobSettings.id)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Export</p>
          <p className="text-sm text-white">Ready to render</p>
        </div>
        <button onClick={onClose} className="rounded-full border border-surface-300/60 px-3 py-1 text-sm text-slate-200">
          Done
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-400">Target</p>
        <div className="grid grid-cols-2 gap-2">
          {['timeline', 'region'].map((target) => (
            <button
              key={target}
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  source:
                    target === 'timeline'
                      ? { kind: 'timeline', inFrame: defaultRange.startFrame, outFrame: defaultRange.endFrame }
                      : { kind: 'timeline', inFrame: defaultRange.startFrame, outFrame: defaultRange.endFrame },
                }))
              }
              className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                settings.source.kind === 'timeline' && target === 'timeline'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-surface-300/60 text-slate-200'
              }`}
            >
              {target === 'timeline' ? 'Timeline' : 'Region'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-400">Preset</p>
        <div className="grid grid-cols-1 gap-2">
          {presetOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                setPreset(option)
                setSettings((prev) => option.apply(prev))
              }}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                preset.id === option.id ? 'border-accent bg-accent/10 text-accent' : 'border-surface-300/60 text-slate-200'
              }`}
            >
              <span className="font-medium">{option.label}</span>
              {preset.id === option.id && <span className="text-[11px] uppercase">Selected</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-400">Output</p>
        <div className="rounded-lg border border-surface-300/60 bg-surface-200/80 p-3 text-sm text-slate-200">
          <div className="flex items-center justify-between">
            <span>File name</span>
            <input
              value={settings.fileName}
              onChange={(e) => setSettings((prev) => ({ ...prev, fileName: e.target.value }))}
              className="rounded-md border border-surface-300/60 bg-surface-900 px-3 py-2 text-sm text-white focus:border-accent"
            />
          </div>
          <p className="mt-3 text-xs text-slate-400">{summary}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onClose} className="w-1/2 rounded-lg border border-surface-300/60 px-4 py-3 text-sm text-slate-200">
          Cancel
        </button>
        <button
          onClick={startExport}
          className="w-1/2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-accent/40"
        >
          Add to queue
        </button>
      </div>
    </div>
  )
}

const BottomSheetArea = ({ mode, onCloseExport }: { mode: MobileMode; onCloseExport: () => void }) => {
  const { project } = useProject()

  if (!project) return null

  return (
    <div className="mt-3 rounded-t-3xl border border-surface-300/60 bg-surface-200/90 p-4 shadow-2xl">
      {mode === 'project' && <ProjectPanel project={project} />}
      {mode === 'edit' && (
        <div className="space-y-4">
          <Inspector project={project} />
          <MaskTools />
          <RenderQueuePanel />
        </div>
      )}
      {mode === 'mosh' && <MoshGraphPanel />}
      {mode === 'export' && <ExportSheetMobile project={project} onClose={onCloseExport} />}
    </div>
  )
}

const ViewerMobile = () => {
  const { project, setViewerRuntimeSettings, transport, setPlayState, setTimelineFrame } = useProject()
  const [hudVisible, setHudVisible] = useState(true)
  const lastTap = useRef<number>(0)

  useEffect(() => {
    setViewerRuntimeSettings({ previewMaxHeight: 1080 })
    return () => setViewerRuntimeSettings({ previewMaxHeight: undefined })
  }, [setViewerRuntimeSettings])

  if (!project) return null

  const togglePlay = () => {
    setPlayState(transport.playState === 'playing' ? 'paused' : 'playing')
  }

  const handleTap = () => {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      togglePlay()
    } else {
      setHudVisible((prev) => !prev)
    }
    lastTap.current = now
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-surface-300/60 bg-surface-200/80 shadow-panel">
      <div className="aspect-video" onClick={handleTap}>
        <Viewer project={project} />
      </div>
      {hudVisible && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTimelineFrame(0)}
              className="rounded-full border border-white/30 px-3 py-2"
              aria-label="Start"
            >
              <Square className="h-4 w-4" />
            </button>
            <button
              onClick={togglePlay}
              className="rounded-full border border-white/30 px-4 py-2"
              aria-label={transport.playState === 'playing' ? 'Pause' : 'Play'}
            >
              <Play className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-200">Preview capped at 1080p</p>
        </div>
      )}
    </div>
  )
}

const MobileEditorLayout = ({ onOpenNewProject }: { onOpenNewProject: () => void }) => {
  const { project, setMobileMode, mobileMode, importSources } = useProject()
  const fileInput = useRef<HTMLInputElement>(null)
  const mode = mobileMode ?? 'edit'
  const handleCloseExport = () => setMobileMode('edit')

  if (!project) return null

  return (
    <div className="flex min-h-screen flex-col bg-surface-900 text-slate-100">
      <AppBarMobile project={project} onImport={() => fileInput.current?.click()} onNew={onOpenNewProject} />
      <input
        ref={fileInput}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files) importSources(Array.from(files))
        }}
      />
      <main className="flex-1 space-y-3 px-3 pb-24 pt-3">
        <ViewerMobile />
        <TimelineStripMobile />
        <AnimatePresence>
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
            <BottomSheetArea mode={mode} onCloseExport={handleCloseExport} />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNavMobile
        mode={mode}
        onChange={(next) => {
          setMobileMode(next)
        }}
      />
    </div>
  )
}

export default MobileEditorLayout
