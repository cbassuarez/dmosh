import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import AssetsPanel from '../components/editor/AssetsPanel'
import Inspector from '../components/editor/Inspector'
import Timeline from '../components/editor/Timeline'
import TopBar from '../components/editor/TopBar'
import Viewer from '../components/editor/Viewer'
import { useEngineStatus } from '../hooks/useEngineStatus'
import { useMasks } from '../hooks/useMasks'
import { useTimelineData } from '../hooks/useTimelineData'
import { resizeLeftPanel, resizeRightPanel } from '../utils/panelSizing'

const EditorPage = () => {
  const status = useEngineStatus()
  const { masks, activeMask } = useMasks()
  const { clips, selectedClip, setSelectedClip } = useTimelineData()

  const containerRef = useRef<HTMLDivElement>(null)
  const [sizes, setSizes] = useState({ left: 280, right: 320, center: 760 })
  const [dragging, setDragging] = useState<null | 'left' | 'right'>(null)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!dragging || !containerRef.current) return
      const containerWidth = containerRef.current.getBoundingClientRect().width
      setSizes((prev) =>
        dragging === 'left'
          ? resizeLeftPanel(containerWidth, prev, event.movementX)
          : resizeRightPanel(containerWidth, prev, event.movementX),
      )
    }
    const handleUp = () => setDragging(null)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      <TopBar projectName="Untitled Project" status={status} />
      <div ref={containerRef} className="mt-4 flex min-h-[70vh] gap-3">
        <AnimatePresence initial={false}>
          {leftOpen && (
            <motion.aside
              key="left"
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="relative shrink-0 overflow-hidden rounded-xl border border-surface-300/60 bg-surface-200/80 p-3 shadow-panel"
              style={{ width: sizes.left }}
            >
              <AssetsPanel masks={masks} clips={clips} />
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
              onClick={() => setLeftOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-surface-300/60 px-3 py-2 hover:border-accent/60"
            >
              {leftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              {leftOpen ? 'Hide assets' : 'Show assets'}
            </button>
            <button
              onClick={() => setRightOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-surface-300/60 px-3 py-2 hover:border-accent/60"
            >
              {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              {rightOpen ? 'Hide inspector' : 'Show inspector'}
            </button>
          </div>
          <Viewer />
          <Timeline clips={clips} onSelect={setSelectedClip} selectedId={selectedClip} />
        </div>

        <AnimatePresence initial={false}>
          {rightOpen && (
            <motion.aside
              key="right"
              initial={{ x: 16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 24, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="relative shrink-0"
              style={{ width: sizes.right }}
            >
              <Inspector
                selectedClip={clips.find((clip) => clip.id === selectedClip)}
                activeMask={masks.find((mask) => mask.id === activeMask)}
              />
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

export default EditorPage
