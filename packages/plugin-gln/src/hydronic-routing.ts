import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import type { GlnHydronicRoute, GlnHydronicRouteReviewReason } from './hydronic-pipe-schema'

export type GlnRoutePoint = [number, number, number]

export type GlnRouteObstacle = {
  id: string
  kind: 'column' | 'door' | 'equipment' | 'window'
  max: GlnRoutePoint
  min: GlnRoutePoint
}

export type GlnRiserCandidate = {
  id: string
  kind: 'equipment-wall' | 'shaft'
  point: GlnRoutePoint
}

export type GlnHydronicRoutePlan = {
  path: GlnRoutePoint[]
  routing: GlnHydronicRoute
}

type RouteInput = {
  end: GlnRoutePoint
  endLevelId?: string | null
  endNodeId?: string
  obstacles?: readonly GlnRouteObstacle[]
  risers?: readonly GlnRiserCandidate[]
  serviceHeight?: number
  start: GlnRoutePoint
  startLevelId?: string | null
  startNodeId?: string
}

const POINT_EPSILON = 1e-5

function samePoint(a: readonly number[], b: readonly number[]) {
  return a.every((value, index) => Math.abs(value - b[index]!) < POINT_EPSILON)
}

function compactPath(path: GlnRoutePoint[]) {
  return path.filter((point, index) => index === 0 || !samePoint(point, path[index - 1]!))
}

function blockedByBox(from: GlnRoutePoint, to: GlnRoutePoint, obstacle: GlnRouteObstacle): boolean {
  // Standard segment/AABB slab test. The planner only emits rectilinear runs,
  // but this is intentionally general so a user-edited waypoint still gets a
  // sound review result if it is passed back through the planner later.
  let enter = 0
  let leave = 1
  for (let axis = 0; axis < 3; axis++) {
    const delta = to[axis]! - from[axis]!
    const low = obstacle.min[axis]!
    const high = obstacle.max[axis]!
    if (Math.abs(delta) < POINT_EPSILON) {
      if (from[axis]! < low || from[axis]! > high) return false
      continue
    }
    const a = (low - from[axis]!) / delta
    const b = (high - from[axis]!) / delta
    enter = Math.max(enter, Math.min(a, b))
    leave = Math.min(leave, Math.max(a, b))
    if (enter > leave) return false
  }
  return leave >= 0 && enter <= 1
}

function collides(path: readonly GlnRoutePoint[], obstacles: readonly GlnRouteObstacle[]) {
  return path.some((point, index) => {
    if (index === path.length - 1) return false
    return obstacles.some((obstacle) => blockedByBox(point, path[index + 1]!, obstacle))
  })
}

function reviewed(
  path: GlnRoutePoint[],
  reason: GlnHydronicRouteReviewReason,
): GlnHydronicRoutePlan {
  return {
    path: compactPath(path),
    routing: { strategy: 'manual', state: 'needs-review', reviewReason: reason },
  }
}

/**
 * Plans one independently editable run. It never invents a penetration through
 * a slab: a cross-level path is valid only when the caller supplies a reviewed
 * shaft/equipment-wall riser. Callers persist `path`, not an opaque route blob.
 */
export function planGlnConcealedRoute(input: RouteInput): GlnHydronicRoutePlan {
  const obstacles = (input.obstacles ?? []).filter(
    (obstacle) => obstacle.id !== input.startNodeId && obstacle.id !== input.endNodeId,
  )
  // Each level owns its own service layer. Do not lift the entire lower-level
  // run to the upper terminal height: that would erase the explicit vertical
  // riser and make a cross-level route look falsely same-level.
  const serviceY = Math.max(input.serviceHeight ?? 2.3, input.start[1])
  const sameLevel =
    !input.startLevelId || !input.endLevelId || input.startLevelId === input.endLevelId

  if (!sameLevel) {
    const riser = [...(input.risers ?? [])].sort((a, b) => {
      const rank = (candidate: GlnRiserCandidate) => (candidate.kind === 'shaft' ? 0 : 1)
      return rank(a) - rank(b)
    })[0]
    if (!riser) return reviewed([input.start, input.end], 'missing-riser')
    const endServiceY = Math.max(input.serviceHeight ?? 2.3, input.end[1])
    const path = compactPath([
      input.start,
      [input.start[0], serviceY, input.start[2]],
      [riser.point[0], serviceY, riser.point[2]],
      [riser.point[0], endServiceY, riser.point[2]],
      [input.end[0], endServiceY, input.end[2]],
      input.end,
    ])
    return collides(path, obstacles)
      ? reviewed([input.start, input.end], 'obstructed')
      : {
          path,
          routing: { strategy: 'ceiling-riser', state: 'routed', reviewReason: null },
        }
  }

  const startCeiling: GlnRoutePoint = [input.start[0], serviceY, input.start[2]]
  const endCeiling: GlnRoutePoint = [input.end[0], serviceY, input.end[2]]
  const candidates = [
    compactPath([
      input.start,
      startCeiling,
      [input.end[0], serviceY, input.start[2]],
      endCeiling,
      input.end,
    ]),
    compactPath([
      input.start,
      startCeiling,
      [input.start[0], serviceY, input.end[2]],
      endCeiling,
      input.end,
    ]),
  ]
  const path = candidates.find((candidate) => !collides(candidate, obstacles))
  return path
    ? { path, routing: { strategy: 'ceiling', state: 'routed', reviewReason: null } }
    : reviewed([input.start, input.end], 'obstructed')
}

function wallObstacleBounds(
  wall: { end: [number, number]; start: [number, number]; thickness?: number },
  child: { height: number; position: [number, number, number]; width: number },
) {
  const dx = wall.end[0] - wall.start[0]
  const dz = wall.end[1] - wall.start[1]
  const length = Math.hypot(dx, dz)
  if (length < POINT_EPSILON) return null
  const ux = dx / length
  const uz = dz / length
  const nx = -uz
  const nz = ux
  const centerX = wall.start[0] + ux * child.position[0] + nx * child.position[2]
  const centerZ = wall.start[1] + uz * child.position[0] + nz * child.position[2]
  const halfSpan = child.width / 2 + 0.1
  const halfDepth = (wall.thickness ?? 0.2) / 2 + 0.1
  const xExtent = Math.abs(ux) * halfSpan + Math.abs(nx) * halfDepth
  const zExtent = Math.abs(uz) * halfSpan + Math.abs(nz) * halfDepth
  return {
    min: [
      centerX - xExtent,
      Math.max(0, child.position[1] - child.height / 2 - 0.1),
      centerZ - zExtent,
    ] as GlnRoutePoint,
    max: [
      centerX + xExtent,
      child.position[1] + child.height / 2 + 0.1,
      centerZ + zExtent,
    ] as GlnRoutePoint,
  }
}

/** Collect only bounds that can be derived without guessing the building model. */
export function collectGlnRoutingObstacles(
  nodes: Readonly<Record<AnyNodeId, AnyNode>>,
): GlnRouteObstacle[] {
  const obstacles: GlnRouteObstacle[] = []
  for (const node of Object.values(nodes)) {
    // `AnyNode` intentionally describes only built-in kinds. The GLN plugin
    // owns additional kinds, so widen at this boundary instead of changing the
    // host union just to inspect their bounding dimensions.
    const candidate = node as unknown as {
      depth?: number
      height?: number
      id: string
      position?: [number, number, number]
      type: string
      width?: number
    }
    if (candidate.type === 'column' && candidate.position) {
      const radius = candidate.width ?? candidate.depth ?? 0.44
      obstacles.push({
        id: candidate.id,
        kind: 'column',
        min: [
          candidate.position[0] - radius / 2,
          candidate.position[1],
          candidate.position[2] - radius / 2,
        ],
        max: [
          candidate.position[0] + radius / 2,
          candidate.position[1] + (candidate.height ?? 2.5),
          candidate.position[2] + radius / 2,
        ],
      })
    }
    if (candidate.type === 'gln:outdoor-unit' || candidate.type === 'gln:buffer-tank') {
      const extent = candidate.width ?? 0.8
      const depth = candidate.depth ?? extent
      if (!candidate.position) continue
      obstacles.push({
        id: candidate.id,
        kind: 'equipment',
        min: [
          candidate.position[0] - extent / 2,
          candidate.position[1],
          candidate.position[2] - depth / 2,
        ],
        max: [
          candidate.position[0] + extent / 2,
          candidate.position[1] + (candidate.height ?? 2),
          candidate.position[2] + depth / 2,
        ],
      })
    }
  }
  for (const wall of Object.values(nodes)) {
    if (wall.type !== 'wall') continue
    const host = wall as AnyNode & {
      children?: string[]
      end: [number, number]
      start: [number, number]
      thickness?: number
    }
    for (const childId of host.children ?? []) {
      const child = nodes[childId as AnyNodeId] as
        | (AnyNode & { height?: number; position?: [number, number, number]; width?: number })
        | undefined
      if (!child || (child.type !== 'door' && child.type !== 'window')) continue
      if (!child.position || !child.width || !child.height) continue
      const bounds = wallObstacleBounds(host, {
        position: child.position,
        width: child.width,
        height: child.height,
      })
      if (bounds) obstacles.push({ id: child.id, kind: child.type, ...bounds })
    }
  }
  return obstacles
}

export function resolveGlnNodeLevelId(
  nodes: Readonly<Record<AnyNodeId, AnyNode>>,
  nodeId: string,
): string | null {
  let candidate = nodes[nodeId as AnyNodeId] as (AnyNode & { parentId?: string | null }) | undefined
  const visited = new Set<string>()
  while (candidate?.parentId && !visited.has(candidate.id)) {
    visited.add(candidate.id)
    if (candidate.type === 'level') return candidate.id
    candidate = nodes[candidate.parentId as AnyNodeId] as
      | (AnyNode & { parentId?: string | null })
      | undefined
  }
  return candidate?.type === 'level' ? candidate.id : null
}
