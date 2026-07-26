import type { AnyNode, AnyNodeId, ZoneNode } from '@pascal-app/core'
import type { GlnBufferTankNode } from './buffer-tank-schema'
import type { GlnEquipmentInstallationAreaKind } from './equipment-installation-schema'
import type { GlnOutdoorUnitNode } from './outdoor-unit-schema'

type GlnFloorEquipmentNode = GlnOutdoorUnitNode | GlnBufferTankNode
type GlnSceneNode = AnyNode | GlnFloorEquipmentNode

export type GlnInstallationIssue = {
  code: 'area-unassigned' | 'area-kind-invalid' | 'outside-confirmed-area' | 'clearance-overlap'
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

function pointInPolygon(point: Point, polygon: readonly Point[]) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index]!
    const previousPoint = polygon[previous]!
    const x = currentPoint[0]!
    const z = currentPoint[1]!
    const previousX = previousPoint[0]!
    const previousZ = previousPoint[1]!
    const intersects =
      z > point[1] !== previousZ > point[1] &&
      point[0] < ((previousX - x) * (point[1] - z)) / (previousZ - z) + x
    if (intersects) inside = !inside
  }
  return inside
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

function isAreaKindAllowed(node: GlnFloorEquipmentNode, kind: GlnEquipmentInstallationAreaKind) {
  return node.type === 'gln:outdoor-unit'
    ? kind === 'outdoor-equipment-area'
    : kind === 'equipment-room' || kind === 'mechanical-room' || kind === 'equipment-area'
}

function nodeName(node: GlnSceneNode) {
  return node.name?.trim() || (node.type === 'gln:outdoor-unit' ? '外机' : '缓冲水箱')
}

/**
 * Scene-level validation for confirmed installation areas and explicitly
 * entered service clearances. It does not manufacture product requirements;
 * only values the user has supplied become part of the clearance envelope.
 */
export function getGlnInstallationIssues(nodes: Readonly<Record<AnyNodeId, GlnSceneNode>>) {
  const equipment = Object.values(nodes).filter(isFloorEquipment)
  const issues: GlnInstallationIssue[] = []

  for (const node of equipment) {
    const zone = node.installationAreaZoneId
      ? (nodes[node.installationAreaZoneId as AnyNodeId] as ZoneNode | undefined)
      : undefined
    if (zone?.type !== 'zone') {
      issues.push({
        code: 'area-unassigned',
        message: `${nodeName(node)}未选择已确认的安装区域。`,
        nodeIds: [node.id],
      })
      continue
    }
    if (!isAreaKindAllowed(node, node.installationAreaKind)) {
      issues.push({
        code: 'area-kind-invalid',
        message:
          node.type === 'gln:outdoor-unit'
            ? '外机只能放在确认的室外设备区。'
            : '缓冲水箱只能放在设备间、机房或已确认设备区。',
        nodeIds: [node.id, zone.id],
      })
      continue
    }
    if (
      zone.parentId !== node.parentId ||
      !rectCorners(toClearanceRect(node)).every((corner) => pointInPolygon(corner, zone.polygon))
    ) {
      issues.push({
        code: 'outside-confirmed-area',
        message: `${nodeName(node)}或其已填写净空超出确认安装区域。`,
        nodeIds: [node.id, zone.id],
      })
    }
  }

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
