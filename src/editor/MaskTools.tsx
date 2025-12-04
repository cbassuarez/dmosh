import { Wand2, Circle, Square } from 'lucide-react'

const MaskTools = () => {
  return (
    <div className="flex items-center gap-2 rounded-md border border-surface-300/60 px-3 py-2 text-xs text-slate-300">
      <span className="font-mono text-[11px] uppercase text-slate-500">Mask tools</span>
      <button className="rounded border border-surface-300/60 px-2 py-1 text-white transition hover:border-accent hover:text-accent">
        <Square className="h-4 w-4" />
      </button>
      <button className="rounded border border-surface-300/60 px-2 py-1 text-white transition hover:border-accent hover:text-accent">
        <Circle className="h-4 w-4" />
      </button>
      <button className="rounded border border-surface-300/60 px-2 py-1 text-white transition hover:border-accent hover:text-accent">
        <Wand2 className="h-4 w-4" />
      </button>
    </div>
  )
}

export default MaskTools
