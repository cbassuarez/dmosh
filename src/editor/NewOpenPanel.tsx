import { useRef } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { useProject } from '../shared/hooks/useProject'

const NewOpenPanel = () => {
  const { newProject, loadProjectFromFile, error } = useProject()
  const inputRef = useRef<HTMLInputElement>(null)

  const onOpen = () => inputRef.current?.click()

  const handleFile = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    await loadProjectFromFile(file)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-surface-300/60 bg-surface-200/80 p-8 text-center shadow-panel">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Datamosh Editor</p>
      <h1 className="text-2xl font-semibold text-white">Create or open a project</h1>
      <p className="text-sm text-slate-400">Manage your sources, timeline, and operations to start moshing.</p>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <button
          onClick={newProject}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/20 px-4 py-3 text-white transition hover:-translate-y-[1px] hover:shadow-lg"
        >
          <Plus className="h-4 w-4" /> New Project
        </button>
        <button
          onClick={onOpen}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-surface-300/60 bg-surface-300/60 px-4 py-3 text-white transition hover:-translate-y-[1px] hover:border-accent/60"
        >
          <FolderOpen className="h-4 w-4" /> Open Project JSON
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          onChange={(e) => handleFile(e.target.files)}
          className="hidden"
        />
      </div>
      {error && (
        <div className="w-full rounded-lg border border-red-500/60 bg-red-500/10 px-4 py-2 text-left text-sm text-red-200">
          Project error: {error}
        </div>
      )}
    </div>
  )
}

export default NewOpenPanel

