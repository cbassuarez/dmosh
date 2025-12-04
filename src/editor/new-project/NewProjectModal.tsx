import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Film,
  Layers,
  Dice6,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Project } from '../../engine/types'
import { formatHash } from '../../shared/hooks/useProject'
import {
  WizardDetails,
  WizardMediaItem,
  WizardSettings,
  buildProjectFromWizard,
  suggestFps,
  suggestResolution,
  totalDurationSeconds,
} from './newProjectBuilder'

type Props = {
  isOpen: boolean
  onClose: () => void
  onCreate: (project: Project) => void
}

type WizardStep = 0 | 1 | 2

type MediaDraft = WizardMediaItem & {
  status: 'pending' | 'analyzing' | 'ready' | 'error'
  message?: string
  file?: File
}

const defaultSettings: WizardSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  blockSize: 16,
  autoCreateTrack: true,
}

const authorStorageKey = 'datamosh-last-author'
let untitledCounter = 1

const randomName = () => `Untitled mosh ${String(untitledCounter++).padStart(2, '0')}`

const createDefaultDetails = (): WizardDetails => ({
  name: randomName(),
  author: localStorage.getItem(authorStorageKey) ?? '',
  description: '',
  seed: undefined,
})

const stepLabels = ['Details', 'Media', 'Timeline & Settings']

const motionVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
}

const computeHash = async (file: File) => {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const readVideoMetadata = async (file: File) =>
  new Promise<{ width?: number; height?: number; duration?: number; fps?: number }>((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : undefined
      resolve({ width: video.videoWidth, height: video.videoHeight, duration, fps: undefined })
      URL.revokeObjectURL(url)
    }
    video.onerror = () => {
      resolve({})
      URL.revokeObjectURL(url)
    }
    video.src = url
  })

const summarizeResolution = (media: WizardMediaItem[]) => {
  const buckets: Record<string, number> = {}
  media.forEach((item) => {
    const { width, height } = item.profile || {}
    if (!width || !height) return
    const key = `${width}×${height}`
    buckets[key] = (buckets[key] ?? 0) + 1
  })
  return Object.entries(buckets)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label} (${count})`)
}

const summarizeFps = (media: WizardMediaItem[]) => {
  const buckets: Record<string, number> = {}
  media.forEach((item) => {
    const fps = item.profile?.fps
    if (!fps) return
    buckets[fps] = (buckets[fps] ?? 0) + 1
  })
  return Object.entries(buckets)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([fps, count]) => `${fps} fps (${count})`)
}

const NewProjectModal = ({ isOpen, onClose, onCreate }: Props) => {
  const [step, setStep] = useState<WizardStep>(0)
  const [details, setDetails] = useState<WizardDetails>(createDefaultDetails)
  const [showSeed, setShowSeed] = useState(false)
  const [media, setMedia] = useState<MediaDraft[]>([])
  const [settings, setSettings] = useState<WizardSettings>(defaultSettings)
  const [customFps, setCustomFps] = useState('')
  const [customWidth, setCustomWidth] = useState('')
  const [customHeight, setCustomHeight] = useState('')
  const [nameError, setNameError] = useState('')
  const [hasTouchedFps, setHasTouchedFps] = useState(false)
  const [hasTouchedResolution, setHasTouchedResolution] = useState(false)
  const dropRef = useRef<HTMLLabelElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setStep(0)
      setDetails(createDefaultDetails())
      setMedia([])
      setSettings(defaultSettings)
      setCustomFps('')
      setCustomHeight('')
      setCustomWidth('')
      setShowSeed(false)
      setHasTouchedFps(false)
      setHasTouchedResolution(false)
      setNameError('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const modal = modalRef.current
    const focusable = modal?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!modal) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'Tab' && focusable && focusable.length > 0) {
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault()
            last.focus()
          }
        } else if (document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!details.author) return
    localStorage.setItem(authorStorageKey, details.author)
  }, [details.author])

  useEffect(() => {
    if (!media.length) return
    const suggestedFps = suggestFps(media, settings.fps)
    const suggestedRes = suggestResolution(media, { width: settings.width, height: settings.height })
    setSettings((prev) => ({
      ...prev,
      fps: hasTouchedFps ? prev.fps : suggestedFps,
      width: hasTouchedResolution ? prev.width : suggestedRes.width,
      height: hasTouchedResolution ? prev.height : suggestedRes.height,
    }))
  }, [media, hasTouchedFps, hasTouchedResolution, settings.fps, settings.height, settings.width])

  const handleDetailsChange = (key: keyof WizardDetails, value: string | number | undefined) => {
    setDetails((prev) => ({ ...prev, [key]: value }))
    if (key === 'name' && nameError && value) setNameError('')
  }

  type VideoMeta = { width?: number; height?: number; duration?: number; fps?: number }

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    const incoming = Array.from(files).map<MediaDraft>((file, idx) => ({
      id: `media-${Date.now()}-${idx}`,
      fileName: file.name,
      hash: undefined,
      pixelFormat: 'unknown',
      hasAudio: false,
      durationFrames: undefined,
      profile: undefined,
      status: 'analyzing',
      file,
    }))
    setMedia((prev) => [...prev, ...incoming])

    for (const draft of incoming) {
      const hash = await computeHash(draft.file!)
      const metaData = (await readVideoMetadata(draft.file!).catch(() => ({}))) as VideoMeta
      setMedia((prev) =>
        prev.map((item) => {
          if (item.id !== draft.id) return item
          const durationFrames = metaData.duration ? Math.round((metaData.duration || 0) * settings.fps) : settings.fps * 5
          const profile =
            metaData.width && metaData.height
              ? {
                  width: metaData.width,
                  height: metaData.height,
                  fps: metaData.fps || settings.fps,
                  codec: 'unknown',
                  hasBFrames: false,
                  gopSize: null,
                }
              : undefined
          return {
            ...item,
            hash,
            profile,
            durationFrames,
            status: 'ready',
          }
        }),
      )
    }
  }

  const handleRemoveMedia = (id: string) => setMedia((prev) => prev.filter((item) => item.id !== id))

  const goNext = () => {
    if (step === 0 && !details.name.trim()) {
      setNameError('Project name is required')
      return
    }
    setStep((prev) => {
      const next = prev === 2 ? 2 : ((prev + 1) as WizardStep)
      return next
    })
  }

  const goBack = () =>
    setStep((prev) => {
      const next = prev === 0 ? 0 : ((prev - 1) as WizardStep)
      return next
    })

  const handleCreate = () => {
    if (!details.name.trim()) {
      setNameError('Project name is required')
      setStep(0)
      return
    }
    const normalizedSettings: WizardSettings = {
      ...settings,
      fps: Math.max(1, settings.fps || Number(customFps) || defaultSettings.fps),
      width: Math.max(1, settings.width),
      height: Math.max(1, settings.height),
    }
    const project = buildProjectFromWizard({ details, media, settings: normalizedSettings })
    onCreate(project)
  }

  const fpsForDuration = useMemo(() => Math.max(1, settings.fps || Number(customFps) || defaultSettings.fps), [settings.fps, customFps])
  const summaryDuration = useMemo(() => totalDurationSeconds(media, fpsForDuration), [media, fpsForDuration])
  const resolutionSummary = useMemo(() => summarizeResolution(media), [media])
  const fpsSummary = useMemo(() => summarizeFps(media), [media])

  const showEmptyMediaWarning = step === 1 && media.length === 0
  const timelinePreviewClips = useMemo(() => {
    const totalFrames = media.reduce((sum, item) => sum + (item.durationFrames ?? fpsForDuration * 5), 0)
    if (!totalFrames) return []
    return media.map((item) => {
      const duration = item.durationFrames ?? fpsForDuration * 5
      return Math.max(8, Math.round((duration / totalFrames) * 100))
    })
  }, [media, fpsForDuration])

  const invalidSettings = settings.fps <= 0 || settings.width <= 0 || settings.height <= 0

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur"
      aria-modal
      role="dialog"
      ref={modalRef}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="relative flex w-full max-w-5xl flex-col gap-4 rounded-2xl border border-surface-300/80 bg-surface-100/90 p-6 shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">New Project</p>
              <h2 className="text-lg font-semibold text-white">Guided setup</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1 text-xs text-slate-400 transition hover:text-white hover:underline"
          >
            Cancel
          </button>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-surface-300/60 bg-surface-200/80 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            {stepLabels.map((label, index) => {
              const active = step === index
              const complete = step > index
              return (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                      active
                        ? 'border-accent/80 bg-accent/20 text-white'
                        : 'border-surface-300/60 bg-surface-300/30 text-slate-400'
                    }`}
                  >
                    {complete ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className={active ? 'text-white' : ''}>{label}</span>
                  {index < stepLabels.length - 1 && <div className="h-px w-10 bg-surface-300/60" />}
                </div>
              )
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border border-surface-300/60 bg-surface-100/40 p-4">
              <AnimatePresence mode="wait" initial={false}>
                {step === 0 && (
                  <motion.div
                    key="details"
                    variants={motionVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Step 1</p>
                      <h3 className="text-lg font-semibold text-white">Project details</h3>
                      <p className="text-sm text-slate-400">Name your project and add optional metadata.</p>
                    </div>
                    <div className="space-y-3">
                      <label className="block space-y-1 text-sm text-slate-300">
                        <span>Project name *</span>
                        <input
                          className="w-full rounded-lg border border-surface-300/60 bg-surface-300/30 px-3 py-2 text-white outline-none focus:border-accent/70"
                          value={details.name}
                          onChange={(e) => handleDetailsChange('name', e.target.value)}
                        />
                        {nameError && <p className="text-xs text-red-400">{nameError}</p>}
                      </label>
                      <label className="block space-y-1 text-sm text-slate-300">
                        <span>Author</span>
                        <input
                          className="w-full rounded-lg border border-surface-300/60 bg-surface-300/30 px-3 py-2 text-white outline-none focus:border-accent/70"
                          value={details.author}
                          onChange={(e) => handleDetailsChange('author', e.target.value)}
                        />
                      </label>
                      <label className="block space-y-1 text-sm text-slate-300">
                        <span>Description</span>
                        <textarea
                          rows={3}
                          className="w-full rounded-lg border border-surface-300/60 bg-surface-300/30 px-3 py-2 text-white outline-none focus:border-accent/70"
                          value={details.description}
                          onChange={(e) => handleDetailsChange('description', e.target.value)}
                        />
                      </label>
                      <div className="rounded-lg border border-surface-300/60 bg-surface-300/20 p-3">
                        <button
                          className="flex items-center gap-2 text-sm text-slate-200 transition hover:text-white"
                          onClick={() => setShowSeed((v) => !v)}
                        >
                          <Dice6 className="h-4 w-4" /> Advanced: random seed
                        </button>
                        <AnimatePresence initial={false}>
                          {showSeed && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-3 space-y-2 text-sm text-slate-300"
                            >
                              <p className="text-xs text-slate-400">
                                Control deterministic effects. Leave empty for a random seed.
                              </p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={details.seed ?? ''}
                                  onChange={(e) => handleDetailsChange('seed', e.target.value ? Number(e.target.value) : undefined)}
                                  className="w-32 rounded-lg border border-surface-300/60 bg-surface-300/30 px-3 py-2 text-white outline-none focus:border-accent/70"
                                />
                                <button
                                  className="rounded-md border border-accent/60 px-3 py-2 text-sm text-white transition hover:bg-accent/20"
                                  onClick={() => handleDetailsChange('seed', Math.floor(Math.random() * 10_000_000))}
                                >
                                  Randomize
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        className="rounded-md px-3 py-2 text-sm text-slate-400 transition hover:text-white"
                        onClick={onClose}
                      >
                        Cancel
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-md bg-accent/90 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-[1px]"
                        onClick={goNext}
                      >
                        Next: Add Media <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="media"
                    variants={motionVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Step 2</p>
                        <h3 className="text-lg font-semibold text-white">Add media</h3>
                        <p className="text-sm text-slate-400">Drop video files to populate your sources bin.</p>
                      </div>
                      {showEmptyMediaWarning && (
                        <div className="flex items-center gap-2 rounded-md border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                          <AlertCircle className="h-4 w-4" /> No media yet. You can import later.
                        </div>
                      )}
                    </div>

                    <label
                      ref={dropRef}
                      className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-surface-300/70 bg-surface-300/20 px-6 py-10 text-center transition hover:border-accent/70 hover:bg-accent/5"
                      onDragOver={(e) => {
                        e.preventDefault()
                        dropRef.current?.classList.add('border-accent')
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        dropRef.current?.classList.remove('border-accent')
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        dropRef.current?.classList.remove('border-accent')
                        handleFiles(e.dataTransfer?.files ?? null)
                      }}
                    >
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFiles(e.target.files)}
                      />
                      <div className="flex items-center gap-3 rounded-full border border-surface-300/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                        <Upload className="h-4 w-4" /> Drop video files here or browse
                      </div>
                      <p className="mt-2 text-xs text-slate-500">We’ll analyze resolution and fps to suggest timeline settings.</p>
                    </label>

                    <div className="space-y-2">
                      {media.length === 0 && (
                        <div className="flex items-center gap-2 rounded-lg border border-surface-300/60 bg-surface-300/20 px-3 py-2 text-sm text-slate-400">
                          <Film className="h-4 w-4" /> No clips yet.
                        </div>
                      )}
                      {media.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-between rounded-lg border border-surface-300/60 bg-surface-300/30 px-3 py-2 text-sm text-white"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.fileName}</span>
                              <span className="rounded-full border border-surface-300/60 px-2 py-0.5 text-[11px] text-slate-300">
                                {item.status === 'analyzing' ? 'Analyzing…' : 'Ready'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              {item.profile?.width && item.profile.height && (
                                <span>
                                  {item.profile.width}×{item.profile.height}
                                </span>
                              )}
                              {item.profile?.fps && <span>{item.profile.fps} fps</span>}
                              {item.durationFrames && <span>{Math.round(item.durationFrames / settings.fps)}s est.</span>}
                              {item.hash && <span className="text-slate-500">{formatHash(item.hash)}</span>}
                              {item.normalizationError && (
                                <span className="text-red-300">{item.normalizationError.message}</span>
                              )}
                            </div>
                          </div>
                          <button
                            aria-label="Remove clip"
                            onClick={() => handleRemoveMedia(item.id)}
                            className="rounded-md p-2 text-slate-400 transition hover:bg-surface-300/50 hover:text-white"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </motion.div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 transition hover:text-white"
                        onClick={goBack}
                      >
                        <ChevronLeft className="h-4 w-4" /> Back: Details
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-md bg-accent/90 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-[1px]"
                        onClick={goNext}
                      >
                        Next: Timeline <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="timeline"
                    variants={motionVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Step 3</p>
                      <h3 className="text-lg font-semibold text-white">Timeline & Settings</h3>
                      <p className="text-sm text-slate-400">Choose fps, resolution, and layout for your timeline.</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1 text-sm text-slate-300">
                        <label className="flex items-center justify-between text-xs text-slate-400">FPS</label>
                        <select
                          className="w-full rounded-lg border border-surface-300/60 bg-surface-300/30 px-3 py-2 text-white outline-none focus:border-accent/70"
                          value={hasTouchedFps ? String(settings.fps) : String(settings.fps)}
                          onChange={(e) => {
                            const value = Number(e.target.value)
                            if (Number.isNaN(value)) return
                            setHasTouchedFps(true)
                            setSettings((prev) => ({ ...prev, fps: value }))
                            setCustomFps('')
                          }}
                        >
                          {[suggestFps(media, settings.fps), 23.976, 24, 25, 29.97, 30, 50, 60]
                            .filter((v, idx, arr) => arr.indexOf(v) === idx)
                            .map((fps) => (
                              <option key={fps} value={fps}>
                                {fps} fps
                              </option>
                            ))}
                          <option value={-1}>Custom…</option>
                        </select>
                        <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
                          <AlertCircle className="h-3 w-3" /> Mixed sources will be conformed to this fps.
                        </div>
                        {settings.fps === -1 && (
                          <input
                            type="number"
                            value={customFps}
                            onChange={(e) => {
                              setCustomFps(e.target.value)
                              const numeric = Number(e.target.value)
                              if (!Number.isNaN(numeric)) setSettings((prev) => ({ ...prev, fps: numeric }))
                            }}
                            className="mt-2 w-32 rounded-lg border border-surface-300/60 bg-surface-300/30 px-3 py-2 text-white outline-none focus:border-accent/70"
                          />
                        )}
                      </div>

                      <div className="space-y-1 text-sm text-slate-300">
                        <label className="flex items-center justify-between text-xs text-slate-400">Resolution</label>
                        <select
                          className="w-full rounded-lg border border-surface-300/60 bg-surface-300/30 px-3 py-2 text-white outline-none focus:border-accent/70"
                          value={`${settings.width}x${settings.height}`}
                          onChange={(e) => {
                            if (e.target.value === 'custom') {
                              setHasTouchedResolution(true)
                              setSettings((prev) => ({ ...prev, width: prev.width, height: prev.height }))
                              return
                            }
                            const [width, height] = e.target.value.split('x').map(Number)
                            setHasTouchedResolution(true)
                            setSettings((prev) => ({ ...prev, width, height }))
                            setCustomHeight('')
                            setCustomWidth('')
                          }}
                        >
                          {[suggestResolution(media, { width: settings.width, height: settings.height }),
                            { width: 3840, height: 2160 },
                            { width: 2560, height: 1440 },
                            { width: 1920, height: 1080 },
                            { width: 1280, height: 720 },
                          ]
                            .map((res) => `${res.width}x${res.height}`)
                            .filter((v, idx, arr) => arr.indexOf(v) === idx)
                            .map((value) => (
                              <option key={value} value={value}>
                                {value.replace('x', ' × ')}
                              </option>
                            ))}
                          <option value="custom">Custom…</option>
                        </select>
                        <p className="pt-1 text-xs text-slate-500">Clips smaller will scale up; larger will scale down.</p>
                        {hasTouchedResolution && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="number"
                              placeholder="Width"
                              value={customWidth}
                              onChange={(e) => {
                                setCustomWidth(e.target.value)
                                const width = Number(e.target.value)
                                if (!Number.isNaN(width)) setSettings((prev) => ({ ...prev, width }))
                              }}
                              className="w-24 rounded-lg border border-surface-300/60 bg-surface-300/30 px-3 py-2 text-white outline-none focus:border-accent/70"
                            />
                            <input
                              type="number"
                              placeholder="Height"
                              value={customHeight}
                              onChange={(e) => {
                                setCustomHeight(e.target.value)
                                const height = Number(e.target.value)
                                if (!Number.isNaN(height)) setSettings((prev) => ({ ...prev, height }))
                              }}
                              className="w-24 rounded-lg border border-surface-300/60 bg-surface-300/30 px-3 py-2 text-white outline-none focus:border-accent/70"
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 text-sm text-slate-300">
                        <label className="flex items-center justify-between text-xs text-slate-400">Block size</label>
                        <select
                          className="w-full rounded-lg border border-surface-300/60 bg-surface-300/30 px-3 py-2 text-white outline-none focus:border-accent/70"
                          value={settings.blockSize}
                          onChange={(e) => setSettings((prev) => ({ ...prev, blockSize: Number(e.target.value) }))}
                        >
                          {[8, 16, 32, 64].map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                        <p className="pt-1 text-xs text-slate-500">Controls spatial granularity of moshing.</p>
                      </div>

                      <div className="space-y-2 rounded-lg border border-surface-300/60 bg-surface-300/20 p-3 text-sm text-slate-300">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={settings.autoCreateTrack}
                            onChange={(e) => setSettings((prev) => ({ ...prev, autoCreateTrack: e.target.checked }))}
                            className="mt-1 h-4 w-4 rounded border-surface-300/60 bg-surface-300/50 text-accent focus:ring-accent"
                          />
                          <div>
                            <p className="font-medium">Auto-create a track with all imported clips</p>
                            <p className="text-xs text-slate-500">Clips will be laid out end-to-end without overlaps.</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {media.length > 0 && (
                      <div className="rounded-lg border border-surface-300/60 bg-surface-300/20 p-3">
                        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                          <Layers className="h-4 w-4" /> Timeline preview
                        </p>
                        <div className="flex h-12 items-center gap-1 rounded-md border border-surface-300/50 bg-surface-100/40 p-1">
                          {timelinePreviewClips.map((width, idx) => (
                            <div
                              key={idx}
                              className="h-full rounded-md bg-gradient-to-br from-accent/70 to-orange-500/70"
                              style={{ width: `${width}%` }}
                            />
                          ))}
                        </div>
                        {summaryDuration > 60 && (
                          <p className="mt-2 text-xs text-amber-200">Long timeline detected; playback may be heavy.</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <button
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 transition hover:text-white"
                        onClick={goBack}
                      >
                        <ChevronLeft className="h-4 w-4" /> Back: Media
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-md bg-accent/90 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-[1px]"
                        onClick={handleCreate}
                        disabled={invalidSettings}
                      >
                        Create Project <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-surface-300/60 bg-surface-300/20 p-4 text-sm text-slate-200">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                <span>Project preview</span>
                <span className="rounded-full border border-surface-300/60 px-2 py-1 text-[11px] text-slate-300">Step {step + 1}/3</span>
              </div>
              <div className="space-y-2 rounded-lg border border-surface-300/60 bg-surface-100/30 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Name</p>
                    <p className="font-semibold text-white">{details.name || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Author</p>
                    <p className="text-white">{details.author || '—'}</p>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  <p>{details.description || 'No description yet.'}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Seed</span>
                  <span className="rounded-full border border-surface-300/60 px-2 py-1 text-white">
                    {details.seed ?? 'Random'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-surface-300/60 bg-surface-100/30 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Sources</span>
                  <span className="rounded-full border border-surface-300/60 px-2 py-1 text-white">{media.length}</span>
                </div>
                {media.length === 0 ? (
                  <p className="text-xs text-slate-500">No media added yet.</p>
                ) : (
                  <ul className="space-y-1 text-xs text-slate-300">
                    {media.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{item.fileName}</span>
                        <span className="text-slate-500">{item.profile?.fps ? `${item.profile.fps} fps` : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {fpsSummary.length > 0 && (
                  <p className="text-[11px] text-slate-500">FPS suggestions: {fpsSummary.join(', ')}</p>
                )}
                {resolutionSummary.length > 0 && (
                  <p className="text-[11px] text-slate-500">Resolutions: {resolutionSummary.join(', ')}</p>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-surface-300/60 bg-surface-100/30 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Timeline</span>
                  <span className="rounded-full border border-surface-300/60 px-2 py-1 text-white">{settings.fps} fps</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="rounded-md border border-surface-300/60 bg-surface-300/20 p-2">
                    <p className="text-[11px] text-slate-500">Resolution</p>
                    <p className="font-semibold text-white">
                      {settings.width} × {settings.height}
                    </p>
                  </div>
                  <div className="rounded-md border border-surface-300/60 bg-surface-300/20 p-2">
                    <p className="text-[11px] text-slate-500">Block size</p>
                    <p className="font-semibold text-white">{settings.blockSize}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Auto track</span>
                  <span className="rounded-full border border-surface-300/60 px-2 py-1 text-white">
                    {settings.autoCreateTrack ? 'Enabled' : 'Off'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Layers className="h-3 w-3" />
                  Estimated duration: {summaryDuration.toFixed(1)}s
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default NewProjectModal

