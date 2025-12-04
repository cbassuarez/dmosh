import EditorShell from '../editor/EditorShell'
import NewOpenPanel from '../editor/NewOpenPanel'
import { useProject } from '../shared/hooks/useProject'

const EditorPage = () => {
  const { project } = useProject()

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      {project ? <EditorShell /> : <NewOpenPanel />}
    </div>
  )
}

export default EditorPage
