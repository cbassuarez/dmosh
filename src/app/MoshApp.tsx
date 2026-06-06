import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, RotateCcw, Upload, Zap, X, AlertTriangle, Dices, Volume2 } from 'lucide-react'
import { activeBackend } from '../mosh/backend'
import { EFFECTS_WITHOUT_INTENSITY, type MoshEffect, type Range } from '../mosh/datamosh'

type Status = 'idle' | 'working' | 'done' | 'error'

interface EffectDef {
  id: MoshEffect
  name: string
  blurb: string
  clips: 1 | 2
}

const EFFECTS: EffectDef[] = [
  { id: 'bloom', name: 'Bloom', blurb: 'Strip keyframes — motion melts across the frame.', clips: 1 },
  { id: 'bloomBurst', name: 'Bloom Burst', blurb: 'Explode the strongest motion frame into a psychedelic burst.', clips: 1 },
  { id: 'stutter', name: 'Stutter', blurb: 'Repeat predicted frames — judder and echo.', clips: 1 },
  { id: 'shuffle', name: 'Shuffle', blurb: 'Scramble motion out of order — chaotic glitch.', clips: 1 },
  { id: 'sort', name: 'Sort', blurb: 'Reorder frames by motion energy.', clips: 1 },
  { id: 'reverse', name: 'Reverse', blurb: 'Play motion backward over the footage.', clips: 1 },
  { id: 'transition', name: 'Transition', blurb: 'Bleed one clip into the next at the cut.', clips: 2 },
]

const KNOB: Partial<Record<MoshEffect, string>> = {
  bloom: 'Smear',
  bloomBurst: 'Burst',
  stutter: 'Judder',
  shuffle: 'Chaos',
}
// Effects whose output varies with the seed (worth a "new variation" reroll).
const RANDOMIZED: ReadonlySet<MoshEffect> = new Set<MoshEffect>(['bloom', 'bloomBurst', 'shuffle'])

const SOFT_SIZE_WARN = 40 * 1024 * 1024

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}

export default function MoshApp() {
  const [effect, setEffect] = useState<MoshEffect>('bloom')
  const [intensity, setIntensity] = useState(0.8)
  const [range, setRange] = useState<Range>({ start: 0, end: 1 })
  const [seed, setSeed] = useState(0x6d6f7368)
  const [keepAudio, setKeepAudio] = useState(false)
  const [clipA, setClipA] = useState<File | null>(null)
  const [clipB, setClipB] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  const def = useMemo(() => EFFECTS.find((e) => e.id === effect)!, [effect])
  const needsTwo = def.clips === 2
  const needsIntensity = !EFFECTS_WITHOUT_INTENSITY.has(effect)
  const isRandomized = RANDOMIZED.has(effect)
  const ready = clipA != null && (!needsTwo || clipB != null)

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [resultUrl])

  const sizeWarning =
    (clipA && clipA.size > SOFT_SIZE_WARN) || (clipB && clipB.size > SOFT_SIZE_WARN)

  const run = useCallback(
    async (runSeed: number) => {
      if (!clipA || (needsTwo && !clipB)) return
      setStatus('working')
      setError(null)
      setProgress(0)
      setPhase('Warming up ffmpeg…')
      if (resultUrl) {
        URL.revokeObjectURL(resultUrl)
        setResultUrl(null)
      }
      try {
        const inputs = needsTwo ? [clipA, clipB!] : [clipA]
        const blob = await activeBackend.process(
          inputs,
          { effect, intensity, seed: runSeed, keepAudio, range: needsTwo ? undefined : range },
          (r, p) => {
            setProgress(r)
            setPhase(p)
          },
        )
        setResultUrl(URL.createObjectURL(blob))
        setStatus('done')
      } catch (err) {
        console.error('[dmosh] mosh failed:', err)
        setError(err instanceof Error ? err.message : 'Something broke mid-mosh.')
        setStatus('error')
      }
    },
    [clipA, clipB, needsTwo, effect, intensity, keepAudio, range, resultUrl],
  )

  // A fresh variation rerolls the seed (for randomized effects) and re-runs.
  const vary = useCallback(() => {
    const next = isRandomized ? randomSeed() : seed
    setSeed(next)
    void run(next)
  }, [isRandomized, seed, run])

  const reset = useCallback(() => {
    if (resultUrl) URL.revokeObjectURL(resultUrl)
    setResultUrl(null)
    setStatus('idle')
    setProgress(0)
    setPhase('')
    setError(null)
  }, [resultUrl])

  const working = status === 'working'

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-100 text-slate-100">
      <Backdrop />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-10 sm:px-8">
        <Header />

        <section className="mt-10 flex-1">
          <Step n="01" label={needsTwo ? 'Source clips' : 'Source clip'}>
            <div className={needsTwo ? 'grid gap-3 sm:grid-cols-2' : ''}>
              <Dropzone
                file={clipA}
                onFile={setClipA}
                onClear={() => setClipA(null)}
                tag={needsTwo ? 'A' : undefined}
                disabled={working}
              />
              {needsTwo && (
                <Dropzone
                  file={clipB}
                  onFile={setClipB}
                  onClear={() => setClipB(null)}
                  tag="B"
                  disabled={working}
                />
              )}
            </div>
            {sizeWarning && (
              <p className="mt-3 flex items-center gap-2 font-mono text-xs text-amber-400/90">
                <AlertTriangle size={13} /> Big file — browser moshing is happiest under ~40&nbsp;MB and a few seconds.
              </p>
            )}
          </Step>

          <Step n="02" label="Effect">
            <div className="grid gap-2 sm:grid-cols-3">
              {EFFECTS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  disabled={working}
                  onClick={() => setEffect(e.id)}
                  className={[
                    'group relative overflow-hidden rounded-md border px-3 py-3 text-left transition-colors disabled:opacity-50',
                    effect === e.id
                      ? 'border-accent bg-accent/10 shadow-glow'
                      : 'border-white/10 bg-surface-300/60 hover:border-white/25',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-soft">
                      {e.id === effect ? '▸ ' : ''}
                      {e.name}
                    </span>
                    {e.clips === 2 && (
                      <span className="rounded bg-white/10 px-1 font-mono text-[9px] text-slate-400">2×</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs leading-snug text-slate-400">{e.blurb}</div>
                </button>
              ))}
            </div>
          </Step>

          {!needsTwo && (
            <Step n="03" label="Mosh range">
              <RangeSlider start={range.start} end={range.end} onChange={setRange} disabled={working} />
              <p className="mt-2 font-mono text-[10px] text-slate-600">
                {range.start <= 0 && range.end >= 1
                  ? 'whole clip — drag the handles to mosh only part of it'
                  : `moshing ${Math.round(range.start * 100)}%–${Math.round(range.end * 100)}% of the clip`}
              </p>
            </Step>
          )}

          {needsIntensity && (
            <Step n="04" label="Amount">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={intensity}
                  disabled={working}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className="dmosh-range h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-400 disabled:opacity-50"
                />
                <div className="w-24 shrink-0 text-right">
                  <span className="font-mono text-2xl tabular-nums text-accent">
                    {Math.round(intensity * 100)}
                  </span>
                  <span className="ml-1 font-mono text-xs text-slate-500">{KNOB[effect] ?? ''}</span>
                </div>
              </div>
            </Step>
          )}

          <div className="mt-9">
            <AnimatePresence mode="wait">
              {status === 'done' && resultUrl ? (
                <Result
                  key="result"
                  url={resultUrl}
                  effect={effect}
                  canVary={isRandomized}
                  onVary={vary}
                  onAgain={reset}
                />
              ) : working ? (
                <Progress key="progress" value={progress} phase={phase} />
              ) : (
                <motion.div key="action" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {status === 'error' && error && (
                    <p className="mb-3 flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-xs text-danger">
                      <AlertTriangle size={14} /> {error}
                    </p>
                  )}
                  <OptionsBar
                    keepAudio={keepAudio}
                    onKeepAudio={setKeepAudio}
                    canRandomize={isRandomized}
                    onRandomize={() => setSeed(randomSeed())}
                  />
                  <MoshButton disabled={!ready} onClick={() => run(seed)} />
                  {!ready && (
                    <p className="mt-3 text-center font-mono text-xs text-slate-600">
                      {needsTwo ? 'drop two clips to begin' : 'drop a clip to begin'}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  )
}

/* ---------- pieces ---------- */

function Header() {
  return (
    <header className="select-none">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="dmosh-glitch relative font-mono text-5xl font-bold tracking-tight sm:text-6xl"
        data-text="DMOSH"
      >
        DMOSH
      </motion.h1>
      <p className="mt-2 max-w-md font-mono text-xs leading-relaxed text-slate-500">
        Add a clip. Datamosh it. The melting, the smear, the broken-codec glitch —
        rendered entirely in your browser. Nothing is uploaded.
      </p>
    </header>
  )
}

function Step({ n, label, children }: { n: string; label: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-xs text-accent">{n}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500">{label}</span>
        <span className="h-px flex-1 translate-y-[-1px] bg-white/5" />
      </div>
      {children}
    </motion.div>
  )
}

function OptionsBar({
  keepAudio,
  onKeepAudio,
  canRandomize,
  onRandomize,
}: {
  keepAudio: boolean
  onKeepAudio: (v: boolean) => void
  canRandomize: boolean
  onRandomize: () => void
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => onKeepAudio(!keepAudio)}
        className={[
          'flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors',
          keepAudio
            ? 'border-accent/60 bg-accent/10 text-accent-soft'
            : 'border-white/10 bg-surface-300/60 text-slate-500 hover:border-white/25',
        ].join(' ')}
      >
        <Volume2 size={13} /> Keep audio
      </button>
      {canRandomize && (
        <button
          type="button"
          onClick={onRandomize}
          className="flex items-center gap-2 rounded-md border border-white/10 bg-surface-300/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-slate-500 transition-colors hover:border-white/25"
        >
          <Dices size={13} /> Reroll
        </button>
      )}
    </div>
  )
}

function RangeSlider({
  start,
  end,
  onChange,
  disabled,
}: {
  start: number
  end: number
  onChange: (r: Range) => void
  disabled?: boolean
}) {
  const MIN_GAP = 0.04
  const pct = (v: number) => Math.round(v * 100)
  return (
    <div className="dmosh-dual relative h-6">
      <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-400" />
      <div
        className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent/80"
        style={{ left: `${pct(start)}%`, right: `${100 - pct(end)}%` }}
      />
      <input
        type="range"
        min={0}
        max={100}
        value={pct(start)}
        disabled={disabled}
        aria-label="Mosh start"
        onChange={(e) => onChange({ start: Math.min(Number(e.target.value) / 100, end - MIN_GAP), end })}
        className="dmosh-range"
      />
      <input
        type="range"
        min={0}
        max={100}
        value={pct(end)}
        disabled={disabled}
        aria-label="Mosh end"
        onChange={(e) => onChange({ start, end: Math.max(Number(e.target.value) / 100, start + MIN_GAP) })}
        className="dmosh-range"
      />
    </div>
  )
}

function Dropzone({
  file,
  onFile,
  onClear,
  tag,
  disabled,
}: {
  file: File | null
  onFile: (f: File) => void
  onClear: () => void
  tag?: string
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const take = (files: FileList | null) => {
    const f = files?.[0]
    if (f && f.type.startsWith('video/')) onFile(f)
  }

  if (file && previewUrl) {
    return (
      <div className="relative overflow-hidden rounded-md border border-white/10 bg-black">
        <video src={previewUrl} className="h-40 w-full object-cover opacity-90" muted playsInline />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-6">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-slate-200">{file.name}</p>
            <p className="font-mono text-[10px] text-slate-500">{prettySize(file.size)}</p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Remove clip"
              className="rounded border border-white/15 bg-black/50 p-1 text-slate-300 hover:border-accent hover:text-accent"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {tag && (
          <span className="absolute left-2 top-2 rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold text-black">
            {tag}
          </span>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files)
      }}
      className={[
        'flex h-40 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed text-center transition-colors disabled:opacity-50',
        over ? 'border-accent bg-accent/5' : 'border-white/15 bg-surface-300/40 hover:border-white/30',
      ].join(' ')}
    >
      <Upload size={20} className={over ? 'text-accent' : 'text-slate-500'} />
      <span className="font-mono text-xs text-slate-400">{tag ? `Clip ${tag} — ` : ''}drop or browse</span>
      <span className="font-mono text-[10px] text-slate-600">mp4 · mov · webm</span>
      <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => take(e.target.files)} />
    </button>
  )
}

function MoshButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-md border border-accent bg-accent py-4 font-mono text-sm font-bold uppercase tracking-[0.3em] text-black transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-surface-300 disabled:text-slate-600"
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        <Zap size={16} className="fill-current" /> Mosh
      </span>
      {!disabled && (
        <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-500 group-hover:translate-x-full" />
      )}
    </button>
  )
}

function Progress({ value, phase }: { value: number; phase: string }) {
  const pct = Math.round(value * 100)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="rounded-md border border-white/10 bg-surface-300/60 p-5"
    >
      <div className="mb-3 flex items-baseline justify-between font-mono text-xs">
        <span className="uppercase tracking-[0.2em] text-accent-soft">{phase || 'Working…'}</span>
        <span className="tabular-nums text-slate-400">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-100">
        <motion.div
          className="dmosh-bar h-full rounded-full bg-accent"
          animate={{ width: `${pct}%` }}
          transition={{ ease: 'linear', duration: 0.2 }}
        />
      </div>
      <p className="mt-3 font-mono text-[10px] text-slate-600">
        first run loads the ffmpeg engine (~30&nbsp;MB) — hang tight.
      </p>
    </motion.div>
  )
}

function Result({
  url,
  effect,
  canVary,
  onVary,
  onAgain,
}: {
  url: string
  effect: MoshEffect
  canVary: boolean
  onVary: () => void
  onAgain: () => void
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
      <div className="overflow-hidden rounded-md border border-accent/40 bg-black shadow-glow">
        <video src={url} className="w-full" controls autoPlay loop muted playsInline />
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={url}
          download={`dmosh-${effect}.mp4`}
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-accent bg-accent py-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:bg-accent-soft"
        >
          <Download size={15} /> Download
        </a>
        {canVary && (
          <button
            type="button"
            onClick={onVary}
            className="flex items-center justify-center gap-2 rounded-md border border-white/15 bg-surface-300 px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-slate-300 transition hover:border-white/30"
          >
            <Dices size={15} /> Variation
          </button>
        )}
        <button
          type="button"
          onClick={onAgain}
          className="flex items-center justify-center gap-2 rounded-md border border-white/15 bg-surface-300 px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-slate-300 transition hover:border-white/30"
        >
          <RotateCcw size={15} /> New
        </button>
      </div>
    </motion.div>
  )
}

function Footer() {
  return (
    <footer className="mt-12 flex items-center justify-between border-t border-white/5 pt-4 font-mono text-[10px] text-slate-600">
      <span>dmosh · client-side datamosher</span>
      <span>ffmpeg.wasm · mpeg4/avi keyframe surgery</span>
    </footer>
  )
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(255,81,53,0.10),transparent_55%)]" />
      <div className="dmosh-grain absolute inset-0 opacity-[0.05]" />
      <div className="dmosh-scan absolute inset-0 opacity-[0.04]" />
    </div>
  )
}
