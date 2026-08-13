import type { AnyNode } from '@pascal-app/core'
import type { GlnHydronicInstallationMode } from './hydronic-pipe-schema'

export type HydronicPlanPoint = [number, number]
export type HydronicPoint = [number, number, number]

const DEFAULT_WALL_SNAP_DISTANCE_M = 0.45
const DEFAULT_WALL_THICKNESS_M = 0.1
const WALL_PIPE_CLEARANCE_M = 0.025

type WallLike = Pick<AnyNode, 'parentId' | 'type'> & {
  start?: readonly [number, number]
  end?: readonly [number, number]
  thickness?: number
}

function projectToSegment(
  point: HydronicPlanPoint,
  start: readonly [number, number],
  end: readonly [number, number],
) {
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared < 1e-8) return null
  const t = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared),
  )
  const projected: HydronicPlanPoint = [start[0] + dx * t, start[1] + dz * t]
  return {
    projected,
    tangent: [dx / Math.sqrt(lengthSquared), dz / Math.sqrt(lengthSquared)] as HydronicPlanPoint,
    distance: Math.hypot(point[0] - projected[0], point[1] - projected[1]),
  }
}

/** Snap a route to the nearest face of a straight wall on the active level. */
export function snapHydronicPointToWall(
  point: HydronicPlanPoint,
  nodes: Record<string, AnyNode | undefined>,
  levelId: string,
  maxDistanceM = DEFAULT_WALL_SNAP_DISTANCE_M,
): HydronicPlanPoint | null {
  let best: { point: HydronicPlanPoint; distance: number } | null = null
  for (const candidate of Object.values(nodes)) {
    const wall = candidate as WallLike | undefined
    if (wall?.type !== 'wall' || wall.parentId !== levelId || !wall.start || !wall.end) {
      continue
    }
    const projection = projectToSegment(point, wall.start, wall.end)
    if (!projection || projection.distance > maxDistanceM) continue
    const normal: HydronicPlanPoint = [-projection.tangent[1], projection.tangent[0]]
    const side =
      (point[0] - projection.projected[0]) * normal[0] +
        (point[1] - projection.projected[1]) * normal[1] <
      0
        ? -1
        : 1
    const offset = (wall.thickness ?? DEFAULT_WALL_THICKNESS_M) / 2 + WALL_PIPE_CLEARANCE_M
    const facePoint: HydronicPlanPoint = [
      projection.projected[0] + normal[0] * offset * side,
      projection.projected[1] + normal[1] * offset * side,
    ]
    if (!best || projection.distance < best.distance) {
      best = { point: facePoint, distance: projection.distance }
    }
  }
  return best?.point ?? null
}

export function resolveHydronicInstallationPoint({
  mode,
  point,
  nodes,
  levelId,
}: {
  mode: GlnHydronicInstallationMode
  point: HydronicPoint
  nodes: Record<string, AnyNode | undefined>
  levelId: string
}): HydronicPoint {
  if (mode !== 'wall') return point
  const snapped = snapHydronicPointToWall([point[0], point[2]], nodes, levelId)
  return snapped ? [snapped[0], point[1], snapped[1]] : point
}

export function snapHydronicPointAlong45(
  origin: HydronicPoint,
  candidate: HydronicPoint,
  distanceStepM = 0,
): HydronicPoint {
  const dx = candidate[0] - origin[0]
  const dz = candidate[2] - origin[2]
  const distance = Math.hypot(dx, dz)
  if (distance < 1e-8) return candidate
  const angle = Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) * (Math.PI / 4)
  const snappedDistance =
    distanceStepM > 0
      ? Math.max(distanceStepM, Math.round(distance / distanceStepM) * distanceStepM)
      : distance
  return [
    origin[0] + Math.cos(angle) * snappedDistance,
    candidate[1],
    origin[2] + Math.sin(angle) * snappedDistance,
  ]
}
