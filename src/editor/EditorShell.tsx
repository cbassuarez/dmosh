import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { motion as motionTokens } from '../shared/theme'
import { useEngine } from '../shared/hooks/useEngine'
import { useProject } from '../shared/hooks/useProject'
import ProjectPanel from './ProjectPanel'
import Viewer from './Viewer'
import Timeline from './Timeline'
import Inspector from './Inspector'
import MaskTools from './MaskTools'

const MIN_PANEL_WIDTH = 220

const handleResize = (
  container: HTMLDivElement | null,
  current: { left: number; right: number; center: number },
  delta: number,
  side: 'left' | 'right',
) => {
  if (!container) return current
  const width = container.getBoundingClientRect().width
  if (side === 'left') {
    const next = Math.max(MIN_PANEL_WIDTH, current.left + delta)
    const center = Math.max(400, width - next - current.right - 12)
    return { left: next, right: current.right, center }
  }
  const next = Math.max(MIN_PANEL_WIDTH, current.right - delta)
  const center = Math.max(400, width - current.left - next - 12)
  return { left: current.left, right: next, center }
}

const EditorShell = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<null | 'left' | 'right'>(null)
  const [open, setOpen] = useState({ left: true, right: true })
  const [sizes, setSizes] = useState({ left: 280, right: 320, center: 720 })

  const { project } = useProject()
  const { status } = useEngine()

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragging) return
      setSizes((prev) => handleResize(containerRef.current, prev, event.movementX, dragging))
    }
    const onUp = () => setDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const statusLabel = useMemo(() => {
    if (status.phase === 'analyzing') return 'Analyzing'
    if (status.phase === 'rendering') return 'Rendering'
    return 'Idle'
  }, [status.phase])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-surface-300/60 bg-surface-200/80 px-4 py-3 shadow-panel">
        <div className="flex items-center gap-3 text-sm text-slate-200">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Project</span>
          <span className="font-medium text-white">{project.metadata.name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="rounded-full border border-surface-300/60 px-3 py-1 font-mono text-[11px]">Seed {project.seed}</span>
          <span className="rounded-full border border-surface-300/60 px-3 py-1">{statusLabel}</span>
        </div>
      </div>
      <div ref={containerRef} className="flex min-h-[70vh] gap-3">
        <AnimatePresence initial={false}>
          {open.left && (
            <motion.aside
              key="left"
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: motionTokens.medium.duration }}
              className="relative shrink-0 overflow-hidden rounded-xl border border-surface-300/60 bg-surface-200/80"
              style={{ width: sizes.left }}
            >
              <ProjectPanel project={project} />
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                onMouseDown={() => setDragging('left')}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="flex flex-1 flex-col gap-3" style={{ minWidth: sizes.center }}>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <button
              onClick={() => setOpen((v) => ({ ...v, left: !v.left }))}
              className="flex items-center gap-2 rounded-md border border-surface-300/60 px-3 py-2 transition hover:border-accent/70 hover:text-white"
            >
              {open.left ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              {open.left ? 'Hide project' : 'Show project'}
            </button>
            <MaskTools />
            <button
              onClick={() => setOpen((v) => ({ ...v, right: !v.right }))}
              className="flex items-center gap-2 rounded-md border border-surface-300/60 px-3 py-2 transition hover:border-accent/70 hover:text-white"
            >
              {open.right ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              {open.right ? 'Hide inspector' : 'Show inspector'}
            </button>
          </div>
          <Viewer project={project} />
          <Timeline project={project} />
        </div>

        <AnimatePresence initial={false}>
          {open.right && (
            <motion.aside
              key="right"
              initial={{ x: 16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 24, opacity: 0 }}
              transition={{ duration: motionTokens.medium.duration }}
              className="relative shrink-0 overflow-hidden rounded-xl border border-surface-300/60 bg-surface-200/80"
              style={{ width: sizes.right }}
            >
              <Inspector project={project} />
              <div
                className="absolute left-0 top-0 h-full w-2 cursor-col-resize"
                onMouseDown={() => setDragging('right')}
              />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default EditorShell
