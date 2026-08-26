import type { Intersection, Object3D } from 'three'

export const ORBIT_TARGET_DRAG_THRESHOLD_PX = 4

const EXCLUDED_ORBIT_TARGET_TYPES = new Set(['guide', 'measurement', 'site'])

type PointerPosition = {
  x: number
  y: number
}

type OrbitTargetNode = {
  type: string
  visible: boolean
}

export function isOrbitTargetNodeEligible(node: OrbitTargetNode | undefined) {
  return Boolean(node?.visible && !EXCLUDED_ORBIT_TARGET_TYPES.has(node.type))
}

export function hasOrbitTargetDragStarted(start: PointerPosition, current: PointerPosition) {
  return Math.hypot(current.x - start.x, current.y - start.y) >= ORBIT_TARGET_DRAG_THRESHOLD_PX
}

function isVisibleInHierarchy(object: Object3D) {
  let current: Object3D | null = object
  while (current) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
}

function isEligibleRegisteredHit(
  object: Object3D,
  registeredNodeIds: ReadonlyMap<Object3D, string>,
  nodes: Readonly<Record<string, OrbitTargetNode | undefined>>,
) {
  if (!isVisibleInHierarchy(object)) return false

  let current: Object3D | null = object
  while (current) {
    const nodeId = registeredNodeIds.get(current)
    if (nodeId) {
      return isOrbitTargetNodeEligible(nodes[nodeId])
    }
    current = current.parent
  }

  return false
}

export function resolveOrbitTargetIntersection(
  intersections: readonly Intersection<Object3D>[],
  registeredNodeIds: ReadonlyMap<Object3D, string>,
  nodes: Readonly<Record<string, OrbitTargetNode | undefined>>,
) {
  for (const intersection of intersections) {
    if (isEligibleRegisteredHit(intersection.object, registeredNodeIds, nodes)) {
      return intersection
    }
  }
  return null
}
