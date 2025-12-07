import type { MoshNode } from '../mosh/moshModel'

export function getMoshFrameIndexMapping(
  totalFrames: number,
  moshEnabled?: boolean,
  moshNodes?: MoshNode[] | null,
): number[] {
  if (!moshEnabled || !moshNodes || moshNodes.length === 0) {
    return Array.from({ length: totalFrames }, (_, index) => index)
  }

  const mapping: number[] = []
  for (let index = 0; index < totalFrames; index += 1) {
    if (index % 2 === 0) {
      mapping.push(index)
    }
  }
  return mapping
}
