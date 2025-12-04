import { useEffect, useState } from 'react'
import EditorShell from '../editor/EditorShell'
import NewProjectModal from '../editor/new-project/NewProjectModal'
import OnboardingLanding from '../editor/OnboardingLanding'
import { cleanupSourcePreviewUrls } from '../engine/types'
import { useProject } from '../shared/hooks/useProject'

const EditorPage = () => {
  const { project, setProject, loadProjectFromFile } = useProject()
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!project && !dismissed) {
      setNewProjectOpen(true)
    }
  }, [project, dismissed])

  const handleClose = () => {
    setNewProjectOpen(false)
    setDismissed(true)
  }

  const openModal = () => {
    setDismissed(false)
    setNewProjectOpen(true)
  }

  const handleCreate = (nextProject: Parameters<typeof setProject>[0]) => {
    cleanupSourcePreviewUrls(project)
    setProject(nextProject)
    setDismissed(false)
    setNewProjectOpen(false)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      {project ? (
        <EditorShell onOpenNewProject={openModal} />
      ) : (
        <OnboardingLanding onOpenNewProject={openModal} onOpenProjectFile={loadProjectFromFile} />
      )}
      <NewProjectModal isOpen={newProjectOpen} onClose={handleClose} onCreate={handleCreate} />
    </div>
  )
}

export default EditorPage
