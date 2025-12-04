import { Engine, EngineProgress, EngineResult, Project, RenderSettings } from './types'
import { selectEffectiveOperations } from './engine'

export class MockEngine implements Engine {
  private progress: EngineProgress = { phase: 'idle', progress: 0 }

  getProgress(): EngineProgress {
    return this.progress
  }

  async analyze(project: Project): Promise<void> {
    this.progress = { phase: 'analyzing', progress: 0.25, message: 'Parsing project' }
    void project
    this.progress = { phase: 'analyzing', progress: 1, message: 'Ready to render' }
  }

  async render(project: Project, settings?: RenderSettings): Promise<EngineResult> {
    this.progress = { phase: 'rendering', progress: 0.1, message: 'Planning topology' }
    const appliedOps = selectEffectiveOperations(project.operations)
    this.progress = {
      phase: 'rendering',
      progress: 1,
      message: `Rendered with ${appliedOps.length} operations`,
    }
    return { topologySummary: { preset: settings?.preset ?? 'web', appliedOperations: appliedOps.length } }
  }
}

export const createMockEngine = (): Engine => new MockEngine()
