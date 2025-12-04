export interface PanelSizes {
  left: number
  right: number
  center: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const resizeLeftPanel = (
  containerWidth: number,
  sizes: PanelSizes,
  delta: number,
  minLeft = 200,
  minCenter = 420,
): PanelSizes => {
  const maxLeft = Math.max(minLeft, containerWidth - sizes.right - minCenter)
  const nextLeft = clamp(sizes.left + delta, minLeft, maxLeft)
  const center = Math.max(minCenter, containerWidth - nextLeft - sizes.right)
  return { left: nextLeft, right: sizes.right, center }
}

export const resizeRightPanel = (
  containerWidth: number,
  sizes: PanelSizes,
  delta: number,
  minRight = 260,
  minCenter = 420,
): PanelSizes => {
  const maxRight = Math.max(minRight, containerWidth - sizes.left - minCenter)
  const nextRight = clamp(sizes.right + delta, minRight, maxRight)
  const center = Math.max(minCenter, containerWidth - sizes.left - nextRight)
  return { left: sizes.left, right: nextRight, center }
}
