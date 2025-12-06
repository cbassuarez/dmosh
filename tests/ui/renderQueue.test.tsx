import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import RenderQueuePanel from '../../src/editor/RenderQueuePanel'
import type { RenderSettings } from '../../src/engine/renderTypes'
import type { Project } from '../../src/engine/types'
import { ProjectProvider, useProject } from '../../src/shared/hooks/useProject'

// We only care that clicking Download calls downloadJobResult with the job.
// Engine-level export behavior is tested separately in tests/engine/export.test.ts.
const downloadJobResultMock = vi.fn()

vi.mock('../../src/editor/downloadHelpers', async () => {
const actual = await vi.importActual<typeof import('../../src/editor/downloadHelpers')>(
'../../src/editor/downloadHelpers',
)
return {
...actual,
downloadJobResult: (...args: unknown[]) => downloadJobResultMock(...args),
}
})

const project: Project = {
version: '0.1',
metadata: { name: 'Render Test', author: '', createdAt: '', updatedAt: '' },
seed: 2,
settings: { width: 1280, height: 720, fps: 30, blockSize: 16 },
sources: [],
timeline: {
fps: 30,
width: 1280,
height: 720,
tracks: [{ id: 't1', kind: 'video', name: 'Video 1', index: 0 }],
clips: [],
},
masks: [],
operations: {
dropKeyframes: [],
freezeReference: [],
redirectFrames: [],
holdSmear: [],
motionVectorTransforms: [],
},
automationCurves: [],
}

const defaultSettings: RenderSettings = {
id: 'job-1',
projectId: project.metadata.name,
source: { kind: 'timeline' },
container: 'mp4',
videoCodec: 'h264',
audioCodec: 'aac',
outputResolution: 'project',
width: project.settings.width,
height: project.settings.height,
fpsMode: 'project',
fps: project.settings.fps,
pixelFormat: 'yuv420p',
rateControl: { mode: 'crf', value: 20 },
keyframeInterval: 'auto',
bFrames: 'auto',
includeAudio: true,
audioSampleRate: 48000,
audioChannels: 2,
datamosh: { mode: 'none' },
preserveBrokenGOP: true,
burnInTimecode: false,
burnInClipName: false,
burnInMasks: false,
renderResolutionScale: 1,
previewOnly: false,
fileName: 'queued-test',
fileExtension: 'mp4',
}

// Seed a COMPLETED job directly in the project store, with a non-empty blob result.
// This isolates the RenderQueuePanel UI behavior from the actual export engine logic,
// which is already covered by engine tests.
const SeedCompletedJob = () => {
const { setProject, addRenderJob, updateRenderJob } = useProject()

useEffect(() => {
setProject(project)
addRenderJob({
id: 'job-1',
projectId: project.metadata.name,
settings: defaultSettings,
})

// Simulate that the job has already completed successfully
const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' })
updateRenderJob('job-1', {
  status: 'completed',
  progress: 100,
  result: {
    mimeType: 'video/mp4',
    fileName: 'queued-test.mp4',
    size: blob.size,
    blob,
  },
})
}, [addRenderJob, setProject, updateRenderJob])

return null
}

describe('RenderQueuePanel', () => {
it('shows a completed job and triggers download for its result', async () => {
render( <ProjectProvider> <SeedCompletedJob /> <RenderQueuePanel /> </ProjectProvider>,
)
// The job title should appear in the queue
const jobTitle = await screen.findByText('queued-test')
expect(jobTitle).toBeInTheDocument()

// Wait until the status shows "completed" somewhere in the panel
await waitFor(() => {
  expect(screen.getByText(/completed/i)).toBeInTheDocument()
})

// There should be a Download button for that completed job
const downloadButton = screen.getByRole('button', { name: 'Download' })
fireEvent.click(downloadButton)

expect(downloadJobResultMock).toHaveBeenCalledTimes(1)
})
})
