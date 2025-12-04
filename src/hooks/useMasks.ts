import { useMemo, useState } from 'react'

export interface Mask {
  id: string
  name: string
  type: 'ellipse' | 'rect'
  mode: 'add' | 'subtract'
  active: boolean
}

export const useMasks = () => {
  const [activeMask, setActiveMask] = useState('mask-ellipse')
  const masks = useMemo<Mask[]>(
    () => [
      { id: 'mask-ellipse', name: 'Glow halo', type: 'ellipse', mode: 'add', active: true },
      { id: 'mask-rect', name: 'Frame gutter', type: 'rect', mode: 'subtract', active: false },
    ],
    [],
  )

  return { masks, activeMask, setActiveMask }
}
