import AppRouter from './router'
import { ProjectProvider } from './shared/hooks/useProject'

const App = () => (
  <ProjectProvider>
    <AppRouter />
  </ProjectProvider>
)

export default App
