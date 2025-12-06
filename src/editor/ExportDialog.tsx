import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { RenderSettings, ContainerFormat, ExportSource, RenderResolutionScale } from '../engine/renderTypes'
import type { Project, TimelineClip } from '../engine/types'
import { useProject } from '../shared/hooks/useProject'
import { timelineEndFrame } from './timelineUtils'

interface Props {
  project: Project
  isOpen: boolean
  onClose: () => void
}

type TargetKind = 'timeline' | 'region' | 'clip' | 'source'
type PresetId = 'h264-preview' | 'h264-1080' | 'prores-master'

const containerExtensions: Record<ContainerFormat, string> = {
  mp4: 'mp4',
  mov: 'mov',
  mkv: 'mkv',
  webm: 'webm',
}

const safeId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `render-${Date.now()}`)

const defaultFileName = (project: Project) => {
  const base = project.metadata.name?.trim() || 'export'
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${base}-${timestamp}`
}

const createSourceForTarget = (
  kind: TargetKind,
  _project: Project,
  region: { inFrame: number; outFrame: number },
  clipId?: string,
  sourceId?: string,
): ExportSource => {
  if (kind === 'region') return { kind: 'timeline', inFrame: region.inFrame, outFrame: region.outFrame }
  if (kind === 'clip' && clipId) return { kind: 'clip', clipId }
  if (kind === 'source' && sourceId) return { kind: 'source', sourceId }
  return { kind: 'timeline' }
}

const createBaseSettings = (project: Project, source: ExportSource): RenderSettings => ({
  id: safeId(),
  projectId: project.metadata.name || 'project',
  source,
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
  fileName: defaultFileName(project),
  fileExtension: containerExtensions.mp4,
})

const presets: { id: PresetId; label: string; apply: (settings: RenderSettings, project: Project) => RenderSettings }[] = [
  {
    id: 'h264-preview',
    label: 'H.264 Preview (1/2 res)',
    apply: (settings) => ({
      ...settings,
      container: 'mp4',
      videoCodec: 'h264',
      audioCodec: settings.includeAudio ? 'aac' : 'none',
      rateControl: { mode: 'crf', value: 28 },
      renderResolutionScale: 0.5,
      pixelFormat: 'yuv420p',
      fileExtension: containerExtensions.mp4,
    }),
  },
  {
    id: 'h264-1080',
    label: 'H.264 1080p (YouTube)',
    apply: (settings) => ({
      ...settings,
      container: 'mp4',
      videoCodec: 'h264',
      audioCodec: settings.includeAudio ? 'aac' : 'none',
      outputResolution: 'custom',
      width: 1920,
      height: 1080,
      fpsMode: 'project',
      rateControl: { mode: 'bitrate', kbps: 12000 },
      pixelFormat: 'yuv420p',
      renderResolutionScale: 1,
      fileExtension: containerExtensions.mp4,
    }),
  },
  {
    id: 'prores-master',
    label: 'ProRes 422 HQ (Master)',
    apply: (settings, project) => ({
      ...settings,
      container: 'mov',
      videoCodec: 'prores_422_hq',
      audioCodec: settings.includeAudio ? 'pcm_s16le' : 'none',
      outputResolution: 'project',
      width: project.settings.width,
      height: project.settings.height,
      fpsMode: 'project',
      rateControl: { mode: 'bitrate', kbps: 200000 },
      pixelFormat: 'yuv422p10le',
      renderResolutionScale: 1,
      fileExtension: containerExtensions.mov,
    }),
  },
]

const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
  <div className="space-y-4 rounded-xl border border-surface-300/60 bg-surface-200/80 p-4 shadow-panel">
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</p>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
    {children}
  </div>
)

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export const ExportDialog = ({ project, isOpen, onClose }: Props) => {
  const { selection, renderQueue, addRenderJob, startRenderJob } = useProject()
  const [targetKind, setTargetKind] = useState<TargetKind>('timeline')
  const [selectedClipId, setSelectedClipId] = useState<string>('')
  const [selectedSourceId, setSelectedSourceId] = useState<string>('')
  const [region, setRegion] = useState<{ inFrame: number; outFrame: number }>({ inFrame: 0, outFrame: 0 })
  const [settings, setSettings] = useState<RenderSettings>(() =>
    createBaseSettings(project, createSourceForTarget('timeline', project, { inFrame: 0, outFrame: 0 })),
  )
  const [presetId, setPresetId] = useState<PresetId>('h264-preview')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [validationError, setValidationError] = useState('')

  const clipOptions = useMemo(() => project.timeline.clips, [project.timeline.clips])
  const sourceOptions = useMemo(() => project.sources, [project.sources])

  useEffect(() => {
    if (!isOpen) return
    const defaultRange = selection.timeRange ?? { startFrame: 0, endFrame: timelineEndFrame(project.timeline) }
    const initialClipId = project.timeline.clips[0]?.id ?? ''
    const initialSourceId = project.sources[0]?.id ?? ''
    setRegion({ inFrame: defaultRange.startFrame, outFrame: defaultRange.endFrame })
    setSelectedClipId(initialClipId)
    setSelectedSourceId(initialSourceId)
    const baseSource = createSourceForTarget(targetKind, project, { inFrame: defaultRange.startFrame, outFrame: defaultRange.endFrame }, initialClipId, initialSourceId)
    setSettings(createBaseSettings(project, baseSource))
    setPresetId('h264-preview')
    setValidationError('')
  }, [isOpen, project, selection.timeRange, targetKind])

  const updateSettings = useCallback((patch: Partial<RenderSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const applyPreset = (id: PresetId) => {
    const preset = presets.find((p) => p.id === id)
    if (!preset) return
    setPresetId(id)
    setSettings((prev) => preset.apply({ ...prev }, project))
  }

  const handleTargetChange = (kind: TargetKind) => {
    setTargetKind(kind)
    const source = createSourceForTarget(kind, project, region, selectedClipId, selectedSourceId)
    updateSettings({ source })
  }

  const handleRegionChange = (key: 'inFrame' | 'outFrame', value: number) => {
    setRegion((prev) => {
      const next = { ...prev, [key]: value }
      if (targetKind === 'region') {
        updateSettings({ source: { kind: 'timeline', inFrame: next.inFrame, outFrame: next.outFrame } })
      }
      return next
    })
  }

  const handleContainerChange = (container: ContainerFormat) => {
    const fileExtension = containerExtensions[container]
    updateSettings({ container, fileExtension })
  }

  const handleRenderScaleChange = (value: RenderResolutionScale) => {
    updateSettings({ renderResolutionScale: value })
  }

  const targetClip = useMemo(() => clipOptions.find((clip) => clip.id === selectedClipId), [clipOptions, selectedClipId])
  const targetSource = useMemo(() => sourceOptions.find((source) => source.id === selectedSourceId), [sourceOptions, selectedSourceId])

  useEffect(() => {
    if (targetKind === 'clip' && targetClip) {
      updateSettings({ source: { kind: 'clip', clipId: targetClip.id } })
    }
    if (targetKind === 'source' && targetSource) {
      updateSettings({ source: { kind: 'source', sourceId: targetSource.id } })
    }
  }, [targetClip, targetSource, targetKind, updateSettings])

  const fps = settings.fpsMode === 'project' ? project.settings.fps : settings.fps ?? project.settings.fps
  const frameRange = useMemo(() => {
    const source = settings.source
    if (source.kind === 'clip') {
      const clip = clipOptions.find((c) => c.id === source.clipId)
      if (clip) return { start: clip.startFrame, end: clip.endFrame }
    }
    if (source.kind === 'source') {
      const matchedSource = sourceOptions.find((s) => s.id === source.sourceId)
      if (matchedSource) return { start: 0, end: matchedSource.durationFrames }
    }
    if (source.kind === 'timeline') {
      return {
        start: source.inFrame ?? 0,
        end: source.outFrame ?? timelineEndFrame(project.timeline),
      }
    }
    return { start: 0, end: timelineEndFrame(project.timeline) }
  }, [settings.source, clipOptions, sourceOptions, project.timeline])

  const durationFrames = Math.max(0, (frameRange.end ?? 0) - (frameRange.start ?? 0) + 1)
  const durationSeconds = fps > 0 ? durationFrames / fps : 0
  const estimatedKbps =
    settings.rateControl.mode === 'bitrate'
      ? settings.rateControl.kbps
      : Math.max(2000, Math.round(6000 * settings.renderResolutionScale))
  const estimatedSizeMb = (estimatedKbps / 8) * durationSeconds / 1024

  const validate = (): string => {
    if (!settings.fileName.trim()) return 'File name is required'
    if (settings.outputResolution === 'custom' && (!settings.width || !settings.height)) {
      return 'Custom width and height are required'
    }
    if (settings.fpsMode === 'override' && !settings.fps) {
      return 'Frames per second must be set when overriding project FPS'
    }
    if (settings.includeAudio && settings.audioCodec === 'none') {
      return 'Select an audio codec when including audio'
    }
    if (settings.source.kind === 'clip' && !settings.source.clipId) return 'Select a clip to export'
    if (settings.source.kind === 'source' && !settings.source.sourceId) return 'Select a source to export'
    if (settings.source.kind === 'timeline' && settings.source.outFrame !== undefined && settings.source.inFrame !== undefined) {
      if (settings.source.outFrame < settings.source.inFrame) return 'Out frame must be after in frame'
    }
    return ''
  }

  const handleAddToQueue = () => {
    const error = validate()
    if (error) {
      setValidationError(error)
      return
    }
    const nextSettings: RenderSettings = {
      ...settings,
      id: safeId(),
      fileExtension: containerExtensions[settings.container],
      source: createSourceForTarget(targetKind, project, region, selectedClipId, selectedSourceId),
    }

    if (import.meta.env.DEV) {
      console.info('[dmosh] UI: export requested', {
        projectId: (project as { id?: string }).id ?? null,
        settings: {
          fileName: nextSettings.fileName,
          container: nextSettings.container,
          videoCodec: nextSettings.videoCodec,
          audioCodec: nextSettings.audioCodec,
          width: nextSettings.width,
          height: nextSettings.height,
          fpsMode: nextSettings.fpsMode,
          fps: nextSettings.fps,
        },
      })
    }

    addRenderJob({ id: nextSettings.id, projectId: project.metadata.name ?? 'project', settings: nextSettings })
    startRenderJob(nextSettings.id)
    setValidationError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-surface-300/60 bg-surface-100/80 p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Delivery</p>
            <h3 className="text-2xl font-semibold text-white">Export render</h3>
            <p className="text-sm text-slate-400">Configure target, quality, and output before adding to the queue.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-surface-300/60 px-3 py-2 text-sm text-slate-200 transition hover:border-accent/70 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          <Section title="Target" subtitle="Choose what to export">
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
              <label className="flex items-center gap-2 rounded-lg border border-surface-300/60 bg-surface-300/40 px-3 py-2">
                <input
                  type="radio"
                  checked={targetKind === 'timeline'}
                  onChange={() => handleTargetChange('timeline')}
                />
                <span>Timeline (full)</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-surface-300/60 bg-surface-300/40 px-3 py-2">
                <input
                  type="radio"
                  checked={targetKind === 'region'}
                  onChange={() => handleTargetChange('region')}
                />
                <span>Region (In/Out)</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-surface-300/60 bg-surface-300/40 px-3 py-2">
                <input
                  type="radio"
                  checked={targetKind === 'clip'}
                  onChange={() => handleTargetChange('clip')}
                />
                <span>Clip</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-surface-300/60 bg-surface-300/40 px-3 py-2">
                <input
                  type="radio"
                  checked={targetKind === 'source'}
                  onChange={() => handleTargetChange('source')}
                />
                <span>Source</span>
              </label>
            </div>
            {targetKind === 'region' && (
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
                <label className="space-y-1">
                  <span className="text-xs text-slate-400">In (frame)</span>
                  <input
                    type="number"
                    value={region.inFrame}
                    onChange={(e) => handleRegionChange('inFrame', Number(e.target.value))}
                    className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Out (frame)</span>
                  <input
                    type="number"
                    value={region.outFrame}
                    onChange={(e) => handleRegionChange('outFrame', Number(e.target.value))}
                    className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
                  />
                </label>
              </div>
            )}
            {targetKind === 'clip' && (
              <label className="space-y-1 text-sm text-slate-200">
                <span className="text-xs text-slate-400">Clip</span>
                <select
                  className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
                  value={selectedClipId}
                  onChange={(e) => {
                    setSelectedClipId(e.target.value)
                    updateSettings({ source: { kind: 'clip', clipId: e.target.value } })
                  }}
                >
                  {clipOptions.map((clip: TimelineClip) => (
                    <option key={clip.id} value={clip.id}>
                      {clip.id} · {clip.timelineStartFrame}–{clip.timelineStartFrame + (clip.endFrame - clip.startFrame)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {targetKind === 'source' && (
              <label className="space-y-1 text-sm text-slate-200">
                <span className="text-xs text-slate-400">Source</span>
                <select
                  className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
                  value={selectedSourceId}
                  onChange={(e) => {
                    setSelectedSourceId(e.target.value)
                    updateSettings({ source: { kind: 'source', sourceId: e.target.value } })
                  }}
                >
                  {sourceOptions.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.originalName}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </Section>

          <Section title="Render preset" subtitle="Choose a starting point and tweak quality">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className={`flex h-full flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition ${
                    presetId === preset.id
                      ? 'border-accent/80 bg-accent/10 text-white'
                      : 'border-surface-300/60 bg-surface-300/40 text-slate-200 hover:border-accent/60'
                  }`}
                >
                  <span className="font-semibold">{preset.label}</span>
                  <span className="text-xs text-slate-400">{preset.id}</span>
                </button>
              ))}
            </div>

            <button
              className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              Advanced {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm text-slate-200">
                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Container</span>
                  <select
                    value={settings.container}
                    onChange={(e) => handleContainerChange(e.target.value as ContainerFormat)}
                    className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
                  >
                    <option value="mp4">MP4</option>
                    <option value="mov">MOV</option>
                    <option value="mkv">MKV</option>
                    <option value="webm">WebM</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Video codec</span>
                  <select
                    value={settings.videoCodec}
                    onChange={(e) => updateSettings({ videoCodec: e.target.value as RenderSettings['videoCodec'] })}
                    className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
                  >
                    <option value="h264">H.264</option>
                    <option value="h265">H.265</option>
                    <option value="vp9">VP9</option>
                    <option value="av1">AV1</option>
                    <option value="prores_422">ProRes 422</option>
                    <option value="prores_422_hq">ProRes 422 HQ</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Pixel format</span>
                  <select
                    value={settings.pixelFormat}
                    onChange={(e) => updateSettings({ pixelFormat: e.target.value as RenderSettings['pixelFormat'] })}
                    className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
                  >
                    <option value="yuv420p">YUV 4:2:0</option>
                    <option value="yuv422p10le">YUV 4:2:2 10-bit</option>
                    <option value="yuv444p10le">YUV 4:4:4 10-bit</option>
                  </select>
                </label>

                <div className="space-y-1">
                  <span className="text-xs text-slate-400">Rate control</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 rounded-md border border-surface-300/60 bg-surface-300/40 px-2 py-1">
                      <input
                        type="radio"
                        checked={settings.rateControl.mode === 'crf'}
                        onChange={() => updateSettings({ rateControl: { mode: 'crf', value: 20 } })}
                      />
                      <span>CRF</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border border-surface-300/60 bg-surface-300/40 px-2 py-1">
                      <input
                        type="radio"
                        checked={settings.rateControl.mode === 'bitrate'}
                        onChange={() => updateSettings({ rateControl: { mode: 'bitrate', kbps: 8000 } })}
                      />
                      <span>Bitrate</span>
                    </label>
                  </div>
                  {settings.rateControl.mode === 'crf' ? (
                    <input
                      type="number"
                      value={settings.rateControl.value}
                      min={0}
                      max={40}
                      onChange={(e) => updateSettings({ rateControl: { mode: 'crf', value: Number(e.target.value) } })}
                      className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1"
                    />
                  ) : (
                    <input
                      type="number"
                      value={settings.rateControl.kbps}
                      min={100}
                      onChange={(e) => updateSettings({ rateControl: { mode: 'bitrate', kbps: Number(e.target.value) } })}
                      className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1"
                    />
                  )}
                </div>

                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Keyframe interval</span>
                  <input
                    type="number"
                    value={settings.keyframeInterval === 'auto' ? '' : settings.keyframeInterval}
                    placeholder="Auto"
                    onChange={(e) =>
                      updateSettings({
                        keyframeInterval: e.target.value === '' ? 'auto' : Number(e.target.value),
                      })
                    }
                    className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-slate-400">B-frames</span>
                  <input
                    type="number"
                    value={settings.bFrames === 'auto' ? '' : settings.bFrames}
                    placeholder="Auto"
                    onChange={(e) => updateSettings({ bFrames: e.target.value === '' ? 'auto' : Number(e.target.value) })}
                    className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Render resolution scale</span>
                  <select
                    value={settings.renderResolutionScale}
                    onChange={(e) => handleRenderScaleChange(Number(e.target.value) as RenderResolutionScale)}
                    className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
                  >
                    <option value={1}>Full</option>
                    <option value={0.5}>1/2</option>
                    <option value={0.25}>1/4</option>
                  </select>
                </label>
              </div>
            )}
          </Section>

          <Section title="Output" subtitle="Where and how the file is written">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm text-slate-200">
              <label className="space-y-1">
                <span className="text-xs text-slate-400">File name</span>
                <input
                  value={settings.fileName}
                  onChange={(e) => updateSettings({ fileName: e.target.value })}
                  className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-slate-400">Container</span>
                <select
                  value={settings.container}
                  onChange={(e) => handleContainerChange(e.target.value as ContainerFormat)}
                  className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
                >
                  <option value="mp4">MP4</option>
                  <option value="mov">MOV</option>
                  <option value="mkv">MKV</option>
                  <option value="webm">WebM</option>
                </select>
              </label>

              <div className="space-y-2">
                <p className="text-xs text-slate-400">Output resolution</p>
                <label className="flex items-center gap-2 rounded-md border border-surface-300/60 bg-surface-300/40 px-2 py-1">
                  <input
                    type="radio"
                    checked={settings.outputResolution === 'project'}
                    onChange={() => updateSettings({ outputResolution: 'project' })}
                  />
                  <span>Match project ({project.settings.width}×{project.settings.height})</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-surface-300/60 bg-surface-300/40 px-2 py-1">
                  <input
                    type="radio"
                    checked={settings.outputResolution === 'custom'}
                    onChange={() => updateSettings({ outputResolution: 'custom' })}
                  />
                  <span>Custom</span>
                </label>
                {settings.outputResolution === 'custom' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={settings.width ?? ''}
                      placeholder="Width"
                      onChange={(e) => updateSettings({ width: Number(e.target.value) })}
                      className="rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1"
                    />
                    <input
                      type="number"
                      value={settings.height ?? ''}
                      placeholder="Height"
                      onChange={(e) => updateSettings({ height: Number(e.target.value) })}
                      className="rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-400">Frame rate</p>
                <label className="flex items-center gap-2 rounded-md border border-surface-300/60 bg-surface-300/40 px-2 py-1">
                  <input
                    type="radio"
                    checked={settings.fpsMode === 'project'}
                    onChange={() => updateSettings({ fpsMode: 'project', fps: project.settings.fps })}
                  />
                  <span>Match project ({project.settings.fps} fps)</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-surface-300/60 bg-surface-300/40 px-2 py-1">
                  <input
                    type="radio"
                    checked={settings.fpsMode === 'override'}
                    onChange={() => updateSettings({ fpsMode: 'override', fps: settings.fps ?? project.settings.fps })}
                  />
                  <span>Override</span>
                </label>
                {settings.fpsMode === 'override' && (
                  <input
                    type="number"
                    value={settings.fps ?? ''}
                    onChange={(e) => updateSettings({ fps: Number(e.target.value) })}
                    className="w-32 rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1"
                  />
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-400">Audio</p>
                <label className="flex items-center gap-2 text-slate-200">
                  <input
                    type="checkbox"
                    checked={settings.includeAudio}
                    onChange={(e) =>
                      updateSettings({ includeAudio: e.target.checked, audioCodec: e.target.checked ? settings.audioCodec : 'none' })
                    }
                  />
                  Include audio
                </label>
                {settings.includeAudio && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={settings.audioCodec}
                      onChange={(e) => updateSettings({ audioCodec: e.target.value as RenderSettings['audioCodec'] })}
                      className="rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1"
                    >
                      <option value="aac">AAC</option>
                      <option value="pcm_s16le">PCM (16-bit)</option>
                      <option value="opus">Opus</option>
                    </select>
                    <select
                      value={settings.audioSampleRate}
                      onChange={(e) => updateSettings({ audioSampleRate: Number(e.target.value) as RenderSettings['audioSampleRate'] })}
                      className="rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1"
                    >
                      <option value={44100}>44.1 kHz</option>
                      <option value={48000}>48 kHz</option>
                    </select>
                    <select
                      value={settings.audioChannels}
                      onChange={(e) => updateSettings({ audioChannels: Number(e.target.value) as RenderSettings['audioChannels'] })}
                      className="rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1"
                    >
                      <option value={1}>Mono</option>
                      <option value={2}>Stereo</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between rounded-lg border border-surface-300/60 bg-surface-300/40 px-3 py-2 text-xs text-slate-300">
              <div className="space-x-3">
                <span className="font-mono text-white">{durationFrames}f</span>
                <span className="text-slate-400">({formatDuration(durationSeconds)})</span>
              </div>
              <div className="text-slate-400">Est. size: ~{estimatedSizeMb.toFixed(2)} MB @ {estimatedKbps} kbps</div>
            </div>
          </Section>
        </div>

        {validationError && <p className="mt-3 text-sm text-rose-300">{validationError}</p>}

        <div className="mt-6 flex items-center justify-between text-sm text-slate-300">
          <div>
            In queue: {renderQueue.length} job{renderQueue.length === 1 ? '' : 's'}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-md border border-surface-300/60 px-4 py-2 transition hover:border-accent/70 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToQueue}
              className="rounded-md border border-accent/70 bg-accent/20 px-4 py-2 text-white transition hover:bg-accent/30"
            >
              Add to queue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
