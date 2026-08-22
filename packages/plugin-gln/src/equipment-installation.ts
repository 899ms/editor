import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import type { GlnBufferTankNode } from './buffer-tank-schema'
import type { GlnOutdoorUnitNode } from './outdoor-unit-schema'

type GlnFloorEquipmentNode = GlnOutdoorUnitNode | GlnBufferTankNode
type GlnSceneNode = AnyNode | GlnFloorEquipmentNode

export type GlnInstallationIssue = {
  code: 'clearance-overlap'
  message: string
  nodeIds: string[]
}

type Point = readonly [number, number]
type Rect = {
  center: Point
  halfDepth: number
  halfWidth: number
  yaw: number
}

function toClearanceRect(node: GlnFloorEquipmentNode): Rect {
  const width = node.type === 'gln:outdoor-unit' ? node.width : node.diameter
  const depth = node.type === 'gln:outdoor-unit' ? node.depth : node.diameter
  const localX = (node.clearanceRight - node.clearanceLeft) / 2
  const localZ = (node.clearanceFront - node.clearanceBack) / 2
  const yaw = node.rotation[1]
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return {
    center: [
      node.position[0] + localX * cos + localZ * sin,
      node.position[2] - localX * sin + localZ * cos,
    ],
    halfWidth: (width + node.clearanceLeft + node.clearanceRight) / 2,
    halfDepth: (depth + node.clearanceFront + node.clearanceBack) / 2,
    yaw,
  }
}

function rectCorners(rect: Rect): Point[] {
  const cos = Math.cos(rect.yaw)
  const sin = Math.sin(rect.yaw)
  const offsets: Point[] = [
    [-rect.halfWidth, -rect.halfDepth],
    [rect.halfWidth, -rect.halfDepth],
    [rect.halfWidth, rect.halfDepth],
    [-rect.halfWidth, rect.halfDepth],
  ]
  return offsets.map(([x, z]) => [
    rect.center[0] + x * cos + z * sin,
    rect.center[1] - x * sin + z * cos,
  ])
}

function overlaps(left: Rect, right: Rect) {
  const axes = [left.yaw, left.yaw + Math.PI / 2, right.yaw, right.yaw + Math.PI / 2]
  const leftCorners = rectCorners(left)
  const rightCorners = rectCorners(right)
  return axes.every((angle) => {
    const axis: Point = [Math.cos(angle), Math.sin(angle)]
    const project = (point: Point) => point[0] * axis[0] + point[1] * axis[1]
    const [leftMin, leftMax] = [
      Math.min(...leftCorners.map(project)),
      Math.max(...leftCorners.map(project)),
    ]
    const [rightMin, rightMax] = [
      Math.min(...rightCorners.map(project)),
      Math.max(...rightCorners.map(project)),
    ]
    return leftMin < rightMax && rightMin < leftMax
  })
}

function isFloorEquipment(node: GlnSceneNode): node is GlnFloorEquipmentNode {
  return node.type === 'gln:outdoor-unit' || node.type === 'gln:buffer-tank'
}

function nodeName(node: GlnSceneNode) {
  return node.name?.trim() || (node.type === 'gln:outdoor-unit' ? '外机' : '缓冲水箱')
}

/**
 * Scene-level validation for explicitly entered service clearances. Installation
 * area fields remain optional metadata and never block equipment placement.
 */
export function getGlnInstallationIssues(nodes: Readonly<Record<AnyNodeId, GlnSceneNode>>) {
  const equipment = Object.values(nodes).filter(isFloorEquipment)
  const issues: GlnInstallationIssue[] = []

  for (let index = 0; index < equipment.length; index++) {
    const left = equipment[index]!
    for (let otherIndex = index + 1; otherIndex < equipment.length; otherIndex++) {
      const right = equipment[otherIndex]!
      if (
        left.parentId !== right.parentId ||
        !overlaps(toClearanceRect(left), toClearanceRect(right))
      ) {
        continue
      }
      issues.push({
        code: 'clearance-overlap',
        message: `${nodeName(left)}与${nodeName(right)}的设备或已填写净空相互重叠。`,
        nodeIds: [left.id, right.id],
      })
    }
  }
  return issues
}

export function getGlnNodeInstallationIssues(
  nodes: Readonly<Record<AnyNodeId, GlnSceneNode>>,
  nodeId: string,
) {
  return getGlnInstallationIssues(nodes).filter((issue) => issue.nodeIds.includes(nodeId))
}
