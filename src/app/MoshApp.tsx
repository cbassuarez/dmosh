import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, RotateCcw, Dices, AlertTriangle, X, Github } from 'lucide-react'
import { EFFECTS_WITHOUT_INTENSITY, type MoshEffect, type Range } from '../mosh/datamosh'
import EffectPreview from './EffectPreview'
import { processMoshQueued } from '../mosh/processQueue'
import { getLicenseStatus, activateLicense, type LicenseStatus } from '../mosh/license'
import { useLatestRelease } from './useLatestRelease'

type Status = 'idle' | 'working' | 'done' | 'error'
type View = 'preview' | 'a' | 'b' | 'output'

interface EffectDef {
  id: MoshEffect
  name: string
  blurb: string
  clips: 1 | 2
  gpu?: boolean
}

// Technical names that surface the mechanism.
const EFFECTS: EffectDef[] = [
  { id: 'flow', name: 'Optical-flow warp', blurb: 'Computes per-pixel motion and feeds it back through a warp — a liquid melt, on the GPU.', clips: 1, gpu: true },
  { id: 'bloom', name: 'P-frame duplication', blurb: 'Duplicates predicted frames so their motion re-applies — the continuous codec melt.', clips: 1 },
  { id: 'bloomBurst', name: 'Peak-frame repeat', blurb: 'Repeats the single highest-residual P-frame many times — one explosive pulse.', clips: 1 },
  { id: 'stutter', name: 'Interval repeat', blurb: 'Repeats frames at a fixed interval — freeze, jump, echo.', clips: 1 },
  { id: 'shuffle', name: 'P-frame shuffle', blurb: 'Reorders predicted frames at random so motion is applied out of sequence.', clips: 1 },
  { id: 'sort', name: 'Residual sort', blurb: 'Orders predicted frames by encoded size (≈ motion energy).', clips: 1 },
  { id: 'reverse', name: 'P-frame reversal', blurb: 'Plays the predicted-frame motion backward over the footage.', clips: 1 },
  { id: 'transition', name: 'I-frame removal', blurb: 'Strips I/P frames at the cut between two clips so A melts into B.', clips: 2 },
]

const KNOB: Partial<Record<MoshEffect, string>> = {
  flow: 'melt',
  bloom: 'smear',
  bloomBurst: 'burst',
  stutter: 'rate',
  shuffle: 'chaos',
  transition: 'bleed',
}
const RANDOMIZED: ReadonlySet<MoshEffect> = new Set<MoshEffect>(['shuffle'])
const SOFT_SIZE_WARN = 40 * 1024 * 1024
const GITHUB_URL = 'https://github.com/cbassuarez/dmosh'
const RELEASE_URL = `${GITHUB_URL}/releases/latest`
const DESKTOP_URL = `${GITHUB_URL}#desktop-app`
// The live site (GitHub Pages). The buy/checkout flow will live here; until a
// real store is wired, this lands on the site rather than a fictional domain.
const BUY_URL = 'https://cbassuarez.github.io/dmosh/buy'

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
const randomSeed = () => Math.floor(Math.random() * 0x7fffffff)

// A fresh accent hue each load — distinct identity per session, legible on white.
function randomAccent(): { base: string; soft: string } {
  const h = Math.floor(Math.random() * 360)
  return { base: `hsl(${h} 64% 45%)`, soft: `hsl(${h} 66% 38%)` }
}

export default function MoshApp() {
  const releaseVersion = useLatestRelease()
  const accent = useMemo(randomAccent, [])
  const accentVars = { '--accent': accent.base, '--accent-soft': accent.soft } as React.CSSProperties

  const [effect, setEffect] = useState<MoshEffect>('bloom')
  const [intensity, setIntensity] = useState(0.7)
  const [range, setRange] = useState<Range>({ start: 0, end: 1 })
  const [seed, setSeed] = useState(0x6d6f7368)
  const [keepAudio, setKeepAudio] = useState(false)
  const [dropI, setDropI] = useState(true)
  const [dropP, setDropP] = useState(false)
  const [repeat, setRepeat] = useState(4)
  const [clipA, setClipA] = useState<File | null>(null)
  const [clipB, setClipB] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [view, setView] = useState<View>('preview')
  const [license, setLicense] = useState<LicenseStatus>({ mode: 'unlocked', remaining: 0 })
  const [licenseKey, setLicenseKey] = useState('')
  const [activateError, setActivateError] = useState<string | null>(null)
  const [desktopOpen, setDesktopOpen] = useState(false)

  useEffect(() => {
    void getLicenseStatus().then(setLicense)
  }, [])

  const def = useMemo(() => EFFECTS.find((e) => e.id === effect)!, [effect])
  const needsTwo = def.clips === 2
  const needsIntensity = !EFFECTS_WITHOUT_INTENSITY.has(effect)
  const needsFrameTargets = effect === 'transition'
  const needsRepeat = effect === 'stutter'
  const isRandomized = RANDOMIZED.has(effect)
  const ready = clipA != null && (!needsTwo || clipB != null)
  const working = status === 'working'

  const urlA = useMemo(() => (clipA ? URL.createObjectURL(clipA) : null), [clipA])
  const urlB = useMemo(() => (clipB ? URL.createObjectURL(clipB) : null), [clipB])
  useEffect(() => () => void (urlA && URL.revokeObjectURL(urlA)), [urlA])
  useEffect(() => () => void (urlB && URL.revokeObjectURL(urlB)), [urlB])
  useEffect(() => () => void (resultUrl && URL.revokeObjectURL(resultUrl)), [resultUrl])

  const toggleDropI = () => setDropI((v) => (v && !dropP ? v : !v))
  const toggleDropP = () => setDropP((v) => (v && !dropI ? v : !v))

  const sizeWarning =
    (clipA && clipA.size > SOFT_SIZE_WARN) || (clipB && clipB.size > SOFT_SIZE_WARN)

  const run = useCallback(
    async (runSeed: number) => {
      if (!clipA || (needsTwo && !clipB)) return
      setStatus('working')
      setError(null)
      setProgress(0)
      setPhase('warming up')
      if (resultUrl) {
        URL.revokeObjectURL(resultUrl)
        setResultUrl(null)
      }
      try {
        const inputs = needsTwo ? [clipA, clipB!] : [clipA]
        const blob = await processMoshQueued(
          inputs,
          { effect, intensity, seed: runSeed, keepAudio, range: needsTwo ? undefined : range, dropI, dropP, repeat },
          (r, p) => {
            setProgress(r)
            setPhase(p.toLowerCase())
          },
        )
        setResultUrl(URL.createObjectURL(blob))
        setStatus('done')
        void getLicenseStatus().then(setLicense) // trial count may have ticked
        setView('output')
      } catch (err) {
        console.error('[dmosh] mosh failed:', err)
        setError(err instanceof Error ? err.message : 'something broke mid-mosh')
        setStatus('error')
      }
    },
    [clipA, clipB, needsTwo, effect, intensity, keepAudio, range, dropI, dropP, repeat, resultUrl],
  )

  const vary = useCallback(() => {
    const next = isRandomized ? randomSeed() : seed
    setSeed(next)
    void run(next)
  }, [isRandomized, seed, run])

  const clearResult = useCallback(() => {
    if (resultUrl) URL.revokeObjectURL(resultUrl)
    setResultUrl(null)
    setStatus('idle')
    setProgress(0)
    setPhase('')
    setError(null)
    setView('preview')
  }, [resultUrl])

  return (
    <div style={accentVars} className="flex h-screen flex-col bg-neutral-50 text-neutral-800">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-white px-4 py-2.5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-sm font-semibold tracking-tight text-neutral-900">dmosh</span>
          <span className="h-3.5 w-px bg-neutral-300" />
          <span className="text-xs text-neutral-500">browser datamosher</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDesktopOpen(true)}
            title="Native desktop build for power users — faster, larger files. Buy it prebuilt or compile the source yourself."
            className="hidden items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 font-mono text-[10px] text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900 sm:inline-flex sm:h-6"
          >
            <Download size={11} /> desktop build
          </button>
          <a
            href={RELEASE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-6 items-center rounded border border-neutral-200 bg-neutral-50 px-2 font-mono text-[10px] text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
          >
            release {releaseVersion}
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="dmosh on GitHub"
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-neutral-200 bg-neutral-50 text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-900"
          >
            <Github size={14} />
          </a>
          <span className="hidden font-mono text-[10px] text-neutral-400 sm:block">ffmpeg.wasm · webcodecs · mpeg4/avi</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[340px_1fr]">
        {/* controls */}
        <aside className="min-h-0 overflow-y-auto border-b border-neutral-200 bg-white md:border-b-0 md:border-r">
          <Section title="Source">
            <div className="space-y-2">
              <DropRow file={clipA} label={needsTwo ? 'A' : 'clip'} onFile={setClipA} onClear={() => setClipA(null)} disabled={working} />
              {needsTwo && <DropRow file={clipB} label="B" onFile={setClipB} onClear={() => setClipB(null)} disabled={working} />}
            </div>
            {sizeWarning && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600">
                <AlertTriangle size={11} /> large file — browser moshing prefers under 40&nbsp;MB
              </p>
            )}
          </Section>

          <Section title="Effect">
            <div className="overflow-hidden rounded-md border border-neutral-200">
              {EFFECTS.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  disabled={working}
                  onClick={() => { setEffect(e.id); if (view === 'output' || view === 'a' || view === 'b') setView('preview') }}
                  className={[
                    'flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-[13px] transition-colors disabled:opacity-40',
                    i > 0 ? 'border-t border-neutral-100' : '',
                    effect === e.id ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50',
                  ].join(' ')}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: effect === e.id ? 'var(--accent)' : '#d4d4d4' }} />
                  <span className="flex-1">{e.name}</span>
                  {e.gpu && <span className="font-mono text-[9px] text-neutral-400">GPU</span>}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">{def.blurb}</p>
          </Section>

          <Section title="Parameters">
            <div className="space-y-4">
              {needsIntensity && (
                <Field label="Amount" value={`${Math.round(intensity * 100)} ${KNOB[effect] ?? ''}`}>
                  <Slider value={intensity} min={0} max={1} step={0.01} disabled={working} ariaLabel="Amount" onChange={setIntensity} />
                </Field>
              )}
              {needsRepeat && (
                <Field label="Repeat" value={`${repeat}×`}>
                  <Slider value={repeat} min={1} max={16} step={1} disabled={working} ariaLabel="Repeat" onChange={setRepeat} />
                </Field>
              )}
              {needsFrameTargets && (
                <div>
                  <Label>Strip frames</Label>
                  <div className="mt-1.5 flex gap-1.5">
                    <Chip active={dropI} disabled={working} onClick={toggleDropI}>I-frames</Chip>
                    <Chip active={dropP} disabled={working} onClick={toggleDropP}>P-frames</Chip>
                  </div>
                </div>
              )}
              {!needsTwo && (
                <Field label="Range" value={range.start <= 0 && range.end >= 1 ? 'whole clip' : `${Math.round(range.start * 100)}–${Math.round(range.end * 100)}%`}>
                  <RangeSlider start={range.start} end={range.end} disabled={working} onChange={setRange} />
                </Field>
              )}
            </div>
          </Section>

          <Section title="Output">
            <div className="flex items-center justify-between">
              <CheckRow checked={keepAudio} disabled={working} onClick={() => setKeepAudio((v) => !v)}>Keep audio</CheckRow>
              {isRandomized && (
                <button type="button" disabled={working} onClick={() => setSeed(randomSeed())} className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-800 disabled:opacity-40">
                  <Dices size={12} /> reroll
                </button>
              )}
            </div>
          </Section>

          <div className="p-3">
            {license.mode === 'expired' ? (
              <div className="space-y-2">
                <p className="text-[12px] text-neutral-700">Trial finished. Enter a license key to keep moshing.</p>
                <input
                  type="text"
                  value={licenseKey}
                  placeholder="license key"
                  onChange={(e) => setLicenseKey(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 font-mono text-[11px] outline-none focus:border-neutral-500"
                />
                {activateError && <p className="text-[11px] text-red-500">{activateError}</p>}
                <button
                  type="button"
                  disabled={!licenseKey.trim()}
                  onClick={async () => {
                    setActivateError(null)
                    try {
                      setLicense(await activateLicense(licenseKey.trim()))
                    } catch (e) {
                      setActivateError(e instanceof Error ? e.message : 'activation failed')
                    }
                  }}
                  style={licenseKey.trim() ? { background: 'var(--accent)' } : undefined}
                  className="w-full rounded-md py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:bg-neutral-200 disabled:text-neutral-400"
                >
                  Activate
                </button>
                <a href={BUY_URL} target="_blank" rel="noreferrer" className="block text-center text-[10px] text-neutral-400 hover:text-neutral-600">
                  buy a license
                </a>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!ready || working}
                  onClick={() => run(seed)}
                  style={ready && !working ? { background: 'var(--accent)' } : undefined}
                  className="w-full rounded-md py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
                >
                  {working ? 'moshing…' : 'Mosh'}
                </button>
                {!ready && <p className="mt-2 text-center text-[11px] text-neutral-400">{needsTwo ? 'load two clips to begin' : 'load a clip to begin'}</p>}
                {license.mode === 'trial' && (
                  <p className="mt-2 text-center text-[10px] text-neutral-400">
                    trial · {license.remaining} mosh{license.remaining === 1 ? '' : 'es'} left
                  </p>
                )}
              </>
            )}
          </div>
        </aside>

        {/* viewport */}
        <main className="flex min-h-0 flex-1 flex-col bg-black">
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
            {view === 'output' && resultUrl ? (
              <video key={resultUrl} src={resultUrl} className="max-h-full max-w-full" controls autoPlay loop playsInline />
            ) : view === 'a' && urlA ? (
              <video key={urlA} src={urlA} className="max-h-full max-w-full" autoPlay loop muted playsInline />
            ) : view === 'b' && urlB ? (
              <video key={urlB} src={urlB} className="max-h-full max-w-full" autoPlay loop muted playsInline />
            ) : clipA && urlA ? (
              <EffectPreview
                key={urlA}
                clipA={clipA}
                clipB={clipB}
                sourceUrl={urlA}
                effect={effect}
                intensity={intensity}
                range={range}
                repeat={repeat}
                dropI={dropI}
                dropP={dropP}
                seed={seed}
              />
            ) : (
              <div className="text-center text-xs text-neutral-500">
                <div className="mb-1.5 text-neutral-300">no clip loaded</div>
                <div className="text-[11px] text-neutral-500">drop a video into the source panel</div>
              </div>
            )}

            {working && (
              <div className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-2 backdrop-blur-sm">
                <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px] text-white">
                  <span>{phase || 'working'}</span>
                  <span className="tabular-nums text-white/60">{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%`, background: 'var(--accent)' }} />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-neutral-800 bg-neutral-950 px-4 py-2">
            <div className="flex items-center gap-1">
              {clipA && <Tab active={view === 'preview'} onClick={() => setView('preview')}>preview</Tab>}
              {clipA && <Tab active={view === 'a'} onClick={() => setView('a')}>{needsTwo ? 'source A' : 'source'}</Tab>}
              {clipB && <Tab active={view === 'b'} onClick={() => setView('b')}>source B</Tab>}
              {resultUrl && <Tab active={view === 'output'} onClick={() => setView('output')}>output</Tab>}
            </div>

            <div className="flex items-center gap-2">
              {status === 'error' && error && (
                <span className="flex items-center gap-1.5 text-[11px] text-red-400"><AlertTriangle size={12} /> {error}</span>
              )}
              {status === 'done' && resultUrl && (
                <>
                  {isRandomized && (
                    <button type="button" onClick={vary} className="flex items-center gap-1.5 rounded border border-neutral-700 px-2.5 py-1.5 text-[11px] text-neutral-300 hover:border-neutral-500">
                      <Dices size={12} /> variation
                    </button>
                  )}
                  <button type="button" onClick={clearResult} className="flex items-center gap-1.5 rounded border border-neutral-700 px-2.5 py-1.5 text-[11px] text-neutral-300 hover:border-neutral-500">
                    <RotateCcw size={12} /> reset
                  </button>
                  <a href={resultUrl} download={`dmosh-${effect}.mp4`} style={{ background: 'var(--accent)' }} className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90">
                    <Download size={12} /> download
                  </a>
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {desktopOpen && <DesktopModal onClose={() => setDesktopOpen(false)} />}
    </div>
  )
}

/* ---------- primitives ---------- */

function DesktopModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">dmosh desktop</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">
              The native build uses your machine's ffmpeg instead of WebAssembly — much faster, and it
              handles large files the browser can't. Same app, two ways to get it.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 text-neutral-400 hover:text-neutral-700">
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          <a href={BUY_URL} target="_blank" rel="noreferrer" className="rounded-md border border-neutral-200 p-3 transition-colors hover:border-neutral-300">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-neutral-900">Buy the prebuilt app</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ background: 'var(--accent)' }}>paid</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
              Signed, auto-updating, ready to run. Free trial, then a one-time license key. Funds development.
            </p>
          </a>
          <a href={DESKTOP_URL} target="_blank" rel="noreferrer" className="rounded-md border border-neutral-200 p-3 transition-colors hover:border-neutral-300">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-neutral-900">Compile it yourself</span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">free</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
              Same app, fully featured, no key. Needs Node + Rust + ffmpeg. Build steps in the README.
            </p>
          </a>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-neutral-200 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <h2 className="text-[13px] font-medium text-neutral-800">{title}</h2>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>
      {children}
    </section>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-neutral-500">{children}</span>
}

function Field({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-[11px] tabular-nums text-neutral-700">{value}</span>
      </div>
      {children}
    </div>
  )
}

function Slider({ value, min, max, step, disabled, ariaLabel, onChange }: { value: number; min: number; max: number; step: number; disabled?: boolean; ariaLabel: string; onChange: (v: number) => void }) {
  return (
    <input
      type="range" min={min} max={max} step={step} value={value} disabled={disabled} aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className="dmosh-range h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 disabled:opacity-40"
    />
  )
}

function Chip({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" disabled={disabled} onClick={onClick}
      style={active ? { borderColor: 'var(--accent)', color: 'var(--accent-soft)' } : undefined}
      className={['rounded border px-2 py-1 text-[11px] transition-colors disabled:opacity-40', active ? 'bg-neutral-50' : 'border-neutral-300 text-neutral-500 hover:border-neutral-400'].join(' ')}
    >
      {children}
    </button>
  )
}

function CheckRow({ checked, disabled, onClick, children }: { checked: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex items-center gap-2 text-[12px] text-neutral-700 disabled:opacity-40">
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border" style={checked ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : { borderColor: '#d4d4d4' }}>
        {checked && <span className="h-1.5 w-1.5 rounded-[1px] bg-white" />}
      </span>
      {children}
    </button>
  )
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={['rounded px-2.5 py-1 text-[11px] transition-colors', active ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'].join(' ')}>
      {children}
    </button>
  )
}

function DropRow({ file, label, onFile, onClear, disabled }: { file: File | null; label: string; onFile: (f: File) => void; onClear: () => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const take = (files: FileList | null) => {
    const f = files?.[0]
    if (f && f.type.startsWith('video/')) onFile(f)
  }

  if (file) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2">
        <span className="font-mono text-[10px] text-neutral-400">{label}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] text-neutral-800">{file.name}</p>
          <p className="font-mono text-[10px] text-neutral-400">{prettySize(file.size)}</p>
        </div>
        {!disabled && (
          <button type="button" onClick={onClear} aria-label={`Remove ${label}`} className="text-neutral-400 hover:text-neutral-700">
            <X size={13} />
          </button>
        )}
      </div>
    )
  }

  return (
    <button
      type="button" disabled={disabled} onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files) }}
      style={over ? { borderColor: 'var(--accent)' } : undefined}
      className={['flex w-full items-center gap-2 rounded-md border border-dashed px-2.5 py-3 text-left text-[12px] transition-colors disabled:opacity-40', over ? 'bg-neutral-50' : 'border-neutral-300 text-neutral-500 hover:border-neutral-400'].join(' ')}
    >
      <span className="font-mono text-[10px] text-neutral-400">{label}</span>
      <span className="text-neutral-500">drop a video or browse</span>
      <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => take(e.target.files)} />
    </button>
  )
}

function RangeSlider({ start, end, onChange, disabled }: { start: number; end: number; onChange: (r: Range) => void; disabled?: boolean }) {
  const MIN_GAP = 0.04
  const pct = (v: number) => Math.round(v * 100)
  return (
    <div className="dmosh-dual relative h-5">
      <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-neutral-200" />
      <div className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ left: `${pct(start)}%`, right: `${100 - pct(end)}%`, background: 'var(--accent)' }} />
      <input type="range" min={0} max={100} value={pct(start)} disabled={disabled} aria-label="Mosh start" onChange={(e) => onChange({ start: Math.min(Number(e.target.value) / 100, end - MIN_GAP), end })} className="dmosh-range" />
      <input type="range" min={0} max={100} value={pct(end)} disabled={disabled} aria-label="Mosh end" onChange={(e) => onChange({ start, end: Math.max(Number(e.target.value) / 100, start + MIN_GAP) })} className="dmosh-range" />
    </div>
  )
}
