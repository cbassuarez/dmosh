import { useEffect, useMemo, useState } from 'react'
import { ExportPreset, ExportResolutionMode, PreviewScale, RenderSettings } from '../engine/engine'
import { useVideoEngine } from '../engine/worker/workerClient'
import { Project } from '../engine/types'

interface Props {
  project: Project
  isOpen: boolean
  onClose: () => void
}

const presets: { label: string; value: ExportPreset; extension: string }[] = [
  { label: 'Web (H.264 / MP4)', value: 'web-h264', extension: 'mp4' },
  { label: 'Web (WebM / VPx)', value: 'web-webm', extension: 'webm' },
  { label: 'NLE (H.264 / MP4)', value: 'nle-h264', extension: 'mp4' },
  { label: 'NLE (ProRes-like / MOV)', value: 'nle-prores', extension: 'mov' },
  { label: 'Lossless-ish (H.264)', value: 'lossless-h264', extension: 'mkv' },
]

export const ExportDialog = ({ project, isOpen, onClose }: Props) => {
  const { engine, progress } = useVideoEngine()
  const resolutionOptions = useMemo(
    () => [
      { label: 'Project', value: 'project' as const, width: project.settings.width, height: project.settings.height },
      { label: '1080p', value: '1080', width: 1920, height: 1080 },
      { label: '720p', value: '720', width: 1280, height: 720 },
      { label: '4K', value: '4k', width: 3840, height: 2160 },
    ],
    [project.settings.height, project.settings.width],
  )
  const [preset, setPreset] = useState<ExportPreset>('web-h264')
  const [resolution, setResolution] = useState(resolutionOptions[0].value)
  const [usePreviewScale, setUsePreviewScale] = useState(false)
  const [previewScale, setPreviewScale] = useState<PreviewScale>('full')
  const [range, setRange] = useState({ start: 0, end: project.timeline.clips.reduce((max, c) => Math.max(max, c.endFrame), 0) })
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    setRange({ start: 0, end: project.timeline.clips.reduce((max, c) => Math.max(max, c.endFrame), 0) })
  }, [project])

  const resolutionMode: ExportResolutionMode = useMemo(() => {
    if (usePreviewScale) return { kind: 'inheritPreview', previewScale }
    if (resolution === 'project') return { kind: 'project' }
    const option = resolutionOptions.find((opt) => opt.value === resolution)
    return option ? { kind: 'explicit', width: option.width, height: option.height } : { kind: 'project' }
  }, [resolution, usePreviewScale, previewScale, resolutionOptions])

  const startExport = async () => {
    if (!engine) return
    setIsExporting(true)
    const settings: RenderSettings = {
      preset,
      resolution: resolutionMode,
      range: { startFrame: range.start, endFrame: range.end },
    }
    const blob = await engine.exportVideo(settings, () => {})
    const presetInfo = presets.find((p) => p.value === preset)
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = `${project.metadata.name || 'project'}.${presetInfo?.extension ?? 'mp4'}`
    anchor.click()
    URL.revokeObjectURL(anchor.href)
    setIsExporting(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[520px] rounded-xl border border-surface-300/60 bg-surface-200/90 p-6 shadow-panel">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Export</h3>
          <button onClick={onClose} className="text-slate-300 hover:text-white">
            Close
          </button>
        </div>
        <div className="space-y-4 text-sm text-slate-200">
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Preset</div>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as ExportPreset)}
              className="w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-3 py-2"
            >
              {presets.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Resolution</div>
            <div className="space-y-2">
              {resolutionOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-slate-200">
                  <input
                    type="radio"
                    checked={resolution === option.value}
                    onChange={() => setResolution(option.value)}
                  />
                  <span>
                    {option.label}
                    {option.value === 'project' ? ` (${project.settings.width}x${project.settings.height})` : ''}
                  </span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-slate-200">
                <input
                  type="checkbox"
                  checked={usePreviewScale}
                  onChange={(e) => setUsePreviewScale(e.target.checked)}
                />
                Use preview scale
                <select
                  value={previewScale}
                  onChange={(e) => setPreviewScale(e.target.value as PreviewScale)}
                  className="rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1"
                >
                  <option value="full">Full</option>
                  <option value="half">Half</option>
                  <option value="quarter">Quarter</option>
                </select>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-slate-200">
              Start frame
              <input
                type="number"
                value={range.start}
                onChange={(e) => setRange((r) => ({ ...r, start: Number(e.target.value) }))}
                className="mt-1 w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1"
              />
            </label>
            <label className="text-slate-200">
              End frame
              <input
                type="number"
                value={range.end}
                onChange={(e) => setRange((r) => ({ ...r, end: Number(e.target.value) }))}
                className="mt-1 w-full rounded-md border border-surface-300/60 bg-surface-200/80 px-2 py-1"
              />
            </label>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between text-sm text-slate-300">
          <div>
            {isExporting ? `${progress.phase} ${(progress.progress * 100).toFixed(0)}%` : 'Ready'}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-md border border-surface-300/60 px-4 py-2 transition hover:border-accent/70 hover:text-white"
            >
              Cancel
            </button>
            <button
              disabled={isExporting}
              onClick={startExport}
              className="rounded-md border border-accent/70 bg-accent/20 px-4 py-2 text-white transition hover:bg-accent/30"
            >
              {isExporting ? 'Exporting…' : 'Start export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
