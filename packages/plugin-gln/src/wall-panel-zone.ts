import type { AnyNode, AnyNodeId, WallNode, ZoneNode } from '@pascal-app/core'
import type { GlnWallPanelSide } from './wall-panel-schema'

function pointInPolygon(point: [number, number], polygon: [number, number][]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!
    const b = polygon[j]!
    const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0])
    const onSegment =
      Math.abs(cross) < 1e-9 &&
      point[0] >= Math.min(a[0], b[0]) - 1e-9 &&
      point[0] <= Math.max(a[0], b[0]) + 1e-9 &&
      point[1] >= Math.min(a[1], b[1]) - 1e-9 &&
      point[1] <= Math.max(a[1], b[1]) + 1e-9
    if (onSegment) return true
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      inside = !inside
    }
  }
  return inside
}

export type WallPanelZoneResolution =
  | { status: 'resolved'; zoneId: ZoneNode['id']; candidateIds: ZoneNode['id'][] }
  | { status: 'ambiguous'; zoneId: null; candidateIds: ZoneNode['id'][] }
  | { status: 'unassigned'; zoneId: null; candidateIds: [] }

export function resolveWallPanelZone(args: {
  wall: WallNode
  side: GlnWallPanelSide
  localX: number
  nodes: Readonly<Record<AnyNodeId, AnyNode>>
}): WallPanelZoneResolution {
  const { wall, side, localX, nodes } = args
  const dx = wall.end[0] - wall.start[0]
  const dz = wall.end[1] - wall.start[1]
  const length = Math.hypot(dx, dz)
  if (length < 1e-6) return { status: 'unassigned', zoneId: null, candidateIds: [] }
  const dirX = dx / length
  const dirZ = dz / length
  const sign = side === 'front' ? 1 : -1
  const sampleDistance = Math.max((wall.thickness ?? 0.2) / 2 + 0.12, 0.2)
  const point: [number, number] = [
    wall.start[0] + dirX * localX - dirZ * sampleDistance * sign,
    wall.start[1] + dirZ * localX + dirX * sampleDistance * sign,
  ]

  const candidateIds = Object.values(nodes)
    .filter(
      (node): node is ZoneNode =>
        node.type === 'zone' &&
        node.parentId === wall.parentId &&
        pointInPolygon(point, node.polygon),
    )
    .map((zone) => zone.id)

  if (candidateIds.length === 1) {
    return { status: 'resolved', zoneId: candidateIds[0]!, candidateIds }
  }
  if (candidateIds.length > 1) {
    return { status: 'ambiguous', zoneId: null, candidateIds }
  }
  return { status: 'unassigned', zoneId: null, candidateIds: [] }
}
