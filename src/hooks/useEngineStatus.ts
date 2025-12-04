import { useMemo } from 'react'

export type EngineState = 'Idle' | 'Analyzing' | 'Rendering'

export const useEngineStatus = () => {
  return useMemo(
    () => ({
      state: 'Idle' as EngineState,
      timecode: '00:00:12:04',
      fps: 24,
      message: 'Ready for playback',
    }),
    [],
  )
}
