import type { AnyNode, AnyNodeId, WallNode } from '@pascal-app/core'
import type { GlnWallPanelNode, GlnWallPanelSide } from './wall-panel-schema'
import { resolveWallPanelZone } from './wall-panel-zone'

export type WallPanelTarget = {
  wall: WallNode
  side: GlnWallPanelSide
  position: [number, number, number]
  rotation: [number, number, number]
  valid: boolean
  reason: 'ok' | 'curved-wall' | 'too-small' | 'opening-overlap'
}

export type WallPanelHostPatch = Pick<
  GlnWallPanelNode,
  | 'parentId'
  | 'wallId'
  | 'wallStart'
  | 'wallEnd'
  | 'position'
  | 'rotation'
  | 'side'
  | 'zoneId'
  | 'zoneCandidateIds'
  | 'zoneAssignment'
>

export function buildWallPanelHostPatch(
  target: WallPanelTarget,
  nodes: Readonly<Record<AnyNodeId, AnyNode>>,
): WallPanelHostPatch {
  const zone = resolveWallPanelZone({
    wall: target.wall,
    side: target.side,
    localX: target.position[0],
    nodes,
  })
  return {
    parentId: target.wall.id,
    wallId: target.wall.id,
    wallStart: target.wall.start,
    wallEnd: target.wall.end,
    position: target.position,
    rotation: target.rotation,
    side: target.side,
    zoneId: zone.zoneId,
    zoneCandidateIds: zone.candidateIds,
    zoneAssignment: 'auto',
  }
}

function childFaceRect(node: AnyNode) {
  if (node.type === 'door' || node.type === 'window') {
    const child = node as AnyNode & {
      position: [number, number, number]
      width: number
      height: number
    }
    return {
      left: child.position[0] - child.width / 2,
      right: child.position[0] + child.width / 2,
      bottom: child.position[1] - child.height / 2,
      top: child.position[1] + child.height / 2,
    }
  }
  if ((node as { type: string }).type === 'gln:wall-panel') {
    const child = node as unknown as GlnWallPanelNode
    return {
      left: child.position[0] - child.width / 2,
      right: child.position[0] + child.width / 2,
      bottom: child.position[1] - child.height / 2,
      top: child.position[1] + child.height / 2,
    }
  }
  return null
}

export function resolveWallPanelTarget(args: {
  wall: WallNode
  nodes: Readonly<Record<AnyNodeId, AnyNode>>
  localX: number
  side: GlnWallPanelSide
  width: number
  height: number
  depth: number
  ignoreId?: string
}): WallPanelTarget {
  const { wall, nodes, side, width, height, depth, ignoreId } = args
  if (Math.abs(wall.curveOffset ?? 0) > 1e-6) {
    return {
      wall,
      side,
      position: [0, height / 2, 0],
      rotation: [0, side === 'front' ? 0 : Math.PI, 0],
      valid: false,
      reason: 'curved-wall',
    }
  }

  const wallLength = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1])
  const wallHeight = wall.height ?? 2.5
  const fits = width <= wallLength && height <= wallHeight
  const localX = Math.max(width / 2, Math.min(wallLength - width / 2, args.localX))
  const localY = height / 2
  const localZ = (side === 'front' ? 1 : -1) * ((wall.thickness ?? 0.2) / 2 + depth / 2)
  const position: [number, number, number] = [localX, localY, localZ]
  const rotation: [number, number, number] = [0, side === 'front' ? 0 : Math.PI, 0]

  if (!fits) {
    return { wall, side, position, rotation, valid: false, reason: 'too-small' }
  }

  const candidate = {
    left: localX - width / 2,
    right: localX + width / 2,
    bottom: 0,
    top: height,
  }
  const collides = (wall.children ?? []).some((childId) => {
    if (childId === ignoreId) return false
    const child = nodes[childId as AnyNodeId]
    if (!child) return false
    const rect = childFaceRect(child)
    return (
      rect !== null &&
      candidate.left < rect.right &&
      candidate.right > rect.left &&
      candidate.bottom < rect.top &&
      candidate.top > rect.bottom
    )
  })

  return {
    wall,
    side,
    position,
    rotation,
    valid: !collides,
    reason: collides ? 'opening-overlap' : 'ok',
  }
}
