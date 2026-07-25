import useLiveNodeOverrides from '@pascal-app/core/live-node-overrides'
import type { FloorplanMoveTarget } from '@pascal-app/core/registry'
import type { AnyNode, AnyNodeId, WallNode } from '@pascal-app/core/schema'
import useScene from '@pascal-app/core/store'
import {
  collectLevelWallSegments,
  nearestWallSegment,
  WALL_SNAP_DISTANCE_M,
} from '@pascal-app/core/wall-distance'
import {
  buildWallPanelHostPatch,
  resolveWallPanelTarget,
  type WallPanelTarget,
} from './wall-panel-installation'
import type { GlnWallPanelNode, GlnWallPanelSide } from './wall-panel-schema'

function oppositeSide(side: GlnWallPanelSide): GlnWallPanelSide {
  return side === 'front' ? 'back' : 'front'
}

export function resolveWallPanelPlanTarget(args: {
  node: GlnWallPanelNode
  nodes: Readonly<Record<AnyNodeId, AnyNode>>
  planPoint: readonly [number, number]
  levelId?: AnyNodeId | null
  flipped?: boolean
}): WallPanelTarget | null {
  const { node, nodes, planPoint, levelId: explicitLevelId, flipped = false } = args
  const currentWall = nodes[node.wallId as AnyNodeId] as WallNode | undefined
  const levelId = (explicitLevelId ?? currentWall?.parentId ?? null) as AnyNodeId | null
  const closest = nearestWallSegment(
    collectLevelWallSegments(nodes, levelId),
    planPoint[0],
    planPoint[1],
    WALL_SNAP_DISTANCE_M,
  )
  if (!closest) return null
  const hitSide: GlnWallPanelSide = closest.perp >= 0 ? 'front' : 'back'
  return resolveWallPanelTarget({
    wall: closest.segment.wall,
    nodes,
    localX: closest.along,
    side: flipped ? oppositeSide(hitSide) : hitSide,
    width: node.width,
    height: node.height,
    depth: node.depth,
    ignoreId: node.id,
  })
}

export const wallPanelFloorplanMoveTarget: FloorplanMoveTarget<GlnWallPanelNode> = ({ node }) => {
  const nodeId = node.id as AnyNodeId
  let flipped = false
  let lastTarget: WallPanelTarget | null = null
  let lastApply:
    | {
        planPoint: readonly [number, number]
        modifiers: {
          shiftKey: boolean
          altKey: boolean
          ctrlKey: boolean
          metaKey: boolean
        }
      }
    | undefined

  return {
    affectedIds: [nodeId],
    apply(args) {
      lastApply = args
      const nodes = useScene.getState().nodes
      lastTarget = resolveWallPanelPlanTarget({
        node,
        nodes,
        planPoint: args.planPoint,
        flipped,
      })
      if (!lastTarget) {
        useLiveNodeOverrides.getState().set(nodeId, { visible: false })
        return
      }
      useLiveNodeOverrides.getState().set(nodeId, {
        ...buildWallPanelHostPatch(lastTarget, nodes),
        visible: true,
      })
    },
    canCommit() {
      return lastTarget?.valid === true
    },
    commit() {
      if (!lastTarget?.valid) return
      useScene
        .getState()
        .updateNode(nodeId, buildWallPanelHostPatch(lastTarget, useScene.getState().nodes))
    },
    flipSide() {
      flipped = !flipped
      if (lastApply) this.apply(lastApply)
    },
  }
}
