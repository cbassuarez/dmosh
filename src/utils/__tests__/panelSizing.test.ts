import { describe, expect, it } from 'vitest'
import { resizeLeftPanel, resizeRightPanel } from '../panelSizing'

const baseSizes = { left: 280, right: 320, center: 800 }
const width = 1400

describe('panel sizing math', () => {
  it('respects minimum center width when resizing left', () => {
    const next = resizeLeftPanel(width, baseSizes, 400, 200, 420)
    expect(next.left).toBeLessThan(width)
    expect(next.center).toBeGreaterThanOrEqual(420)
  })

  it('respects minimum center width when resizing right', () => {
    const next = resizeRightPanel(width, baseSizes, 500, 260, 420)
    expect(next.right).toBeLessThan(width)
    expect(next.center).toBeGreaterThanOrEqual(420)
  })

  it('shrinks left panel when dragging left negatively', () => {
    const next = resizeLeftPanel(width, baseSizes, -120)
    expect(next.left).toBeLessThan(baseSizes.left)
  })
})
