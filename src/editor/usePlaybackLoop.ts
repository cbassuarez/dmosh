import { useEffect } from 'react'
import { timelineEndFrame } from './timelineUtils'
import { useProject } from '../shared/hooks/useProject'

export const usePlaybackLoop = () => {
  const { project, transport, setTimelineFrame, setPlayState } = useProject()

  useEffect(() => {
    if (!project) return undefined
    if (transport.playState !== 'playing') return undefined

    let animationFrameId: number
    let lastTime = performance.now()
    const maxFrame = timelineEndFrame(project.timeline)

    const tick = (now: number) => {
      const deltaSeconds = (now - lastTime) / 1000
      lastTime = now

      const deltaFrames = transport.fps * deltaSeconds
      const nextFrame = transport.currentTimelineFrame + deltaFrames

      if (nextFrame >= maxFrame) {
        setTimelineFrame(maxFrame)
        setPlayState('stopped')
        return
      }

      setTimelineFrame(Math.floor(nextFrame))
      animationFrameId = requestAnimationFrame(tick)
    }

    animationFrameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [project, setPlayState, setTimelineFrame, transport.currentTimelineFrame, transport.fps, transport.playState])
}
