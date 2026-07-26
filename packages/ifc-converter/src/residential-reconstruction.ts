import {
  type AnyNode,
  type AnyNodeId,
  CeilingNode,
  detectSpacesForLevel,
  type WallNode,
  ZoneNode,
} from '@pascal-app/core'
import { customAlphabet } from 'nanoid'

export type IfcSourceIdentity = {
  path: string
  sha256: string
  sizeBytes: number
}

export type IfcResidentialReviewReason = 'invalid-geometry' | 'missing-parent' | 'unsupported-kind'

export type IfcResidentialReviewItem = {
  ifcType: string | null
  name: string
  nodeId: string
  reason: IfcResidentialReviewReason
}

export type IfcResidentialConversionReport = {
  generated: {
    ceilings: number
    zones: number
  }
  minimumStructure: {
    missing: Array<'building' | 'level' | 'wall' | 'zone'>
    satisfied: boolean
  }
  nodeCounts: {
    draft: number
    highConfidence: number
    review: number
    source: number
  }
  reviewItems: IfcResidentialReviewItem[]
  source: IfcSourceIdentity
  status: 'draft-ready' | 'report-only'
  version: 1
}

export type IfcResidentialSourceGraph = {
  nodes: Record<string, AnyNode>
  rootNodeIds: AnyNodeId[]
}

export type IfcResidentialReconstruction = {
  draft: IfcResidentialSourceGraph | null
  referenceGraph: IfcResidentialSourceGraph
  report: IfcResidentialConversionReport
}

const SUPPORTED_KINDS = new Set([
  'site',
  'building',
  'level',
  'wall',
  'slab',
  'ceiling',
  'roof',
  'door',
  'window',
  'zone',
])
const makeId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12)

type IfcMetadata = {
  expressID?: unknown
  globalId?: unknown
  ifcType?: unknown
  polygon?: unknown
}

function metadataRecord(node: AnyNode): IfcMetadata {
  if (typeof node.metadata !== 'object' || node.metadata === null || Array.isArray(node.metadata)) {
    return {}
  }
  return node.metadata as IfcMetadata
}

function ifcType(node: AnyNode): string | null {
  const value = metadataRecord(node).ifcType
  return typeof value === 'string' ? value : null
}

function sanitizedMetadata(node: AnyNode) {
  const source = metadataRecord(node)
  const ifcSource: Record<string, string | number> = {}
  if (typeof source.expressID === 'number') ifcSource.expressID = source.expressID
  if (typeof source.globalId === 'string') ifcSource.globalId = source.globalId
  if (typeof source.ifcType === 'string') ifcSource.ifcType = source.ifcType
  return Object.keys(ifcSource).length > 0 ? { ifcSource } : {}
}

function finiteTuple(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  )
}

function polygonArea(value: unknown): number {
  if (!Array.isArray(value) || value.length < 3) return 0
  const points = value.filter((point) => finiteTuple(point, 2))
  if (points.length !== value.length) return 0
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!
    const next = points[(index + 1) % points.length]!
    area += point[0]! * next[1]! - next[0]! * point[1]!
  }
  return Math.abs(area) / 2
}

function hasParentOfType(node: AnyNode, nodes: Readonly<Record<string, AnyNode>>, type: string) {
  return !!node.parentId && nodes[node.parentId]?.type === type
}

function hasValidGeometry(node: AnyNode, nodes: Readonly<Record<string, AnyNode>>): boolean {
  if (node.type === 'wall') {
    if (!(finiteTuple(node.start, 2) && finiteTuple(node.end, 2))) return false
    if (Math.hypot(node.end[0]! - node.start[0]!, node.end[1]! - node.start[1]!) < 0.1) {
      return false
    }
    return (
      (node.height ?? 0) > 0.2 &&
      (node.thickness ?? 0) > 0.01 &&
      hasParentOfType(node, nodes, 'level')
    )
  }
  if (node.type === 'slab' || node.type === 'ceiling' || node.type === 'zone') {
    return polygonArea(node.polygon) >= 0.1 && hasParentOfType(node, nodes, 'level')
  }
  if (node.type === 'roof') {
    return (
      hasParentOfType(node, nodes, 'level') &&
      (node.children.length > 0 || polygonArea(metadataRecord(node).polygon) >= 0.1)
    )
  }
  if (node.type === 'door' || node.type === 'window') {
    return (
      hasParentOfType(node, nodes, 'wall') &&
      finiteTuple(node.position, 3) &&
      node.width > 0.1 &&
      node.height > 0.1
    )
  }
  if (node.type === 'building') return hasParentOfType(node, nodes, 'site')
  if (node.type === 'level') return hasParentOfType(node, nodes, 'building')
  if (node.type === 'site') return node.parentId === null
  return false
}

function reviewItem(node: AnyNode, reason: IfcResidentialReviewReason): IfcResidentialReviewItem {
  return {
    ifcType: ifcType(node),
    name: node.name?.trim() || node.type,
    nodeId: node.id,
    reason,
  }
}

function sanitizeNode(node: AnyNode): AnyNode {
  return {
    ...structuredClone(node),
    metadata: sanitizedMetadata(node),
  } as AnyNode
}

function addGeneratedSurfaces(nodes: Record<string, AnyNode>) {
  let ceilings = 0
  let zones = 0
  for (const level of Object.values(nodes)) {
    if (level.type !== 'level') continue
    const walls = Object.values(nodes).filter(
      (node): node is WallNode => node.type === 'wall' && node.parentId === level.id,
    )
    const { spaces } = detectSpacesForLevel(level.id, walls)
    const levelChildren = new Set(level.children)
    const existingZones = Object.values(nodes).filter(
      (node): node is Extract<AnyNode, { type: 'zone' }> =>
        node.type === 'zone' && node.parentId === level.id,
    )
    const existingCeilings = Object.values(nodes).filter(
      (node): node is Extract<AnyNode, { type: 'ceiling' }> =>
        node.type === 'ceiling' && node.parentId === level.id,
    )

    for (let index = 0; index < spaces.length; index += 1) {
      const space = spaces[index]!
      if (!existingZones.some((zone) => polygonArea(zone.polygon) === polygonArea(space.polygon))) {
        const zone = ZoneNode.parse({
          id: `zone_ifc_${makeId()}`,
          type: 'zone',
          name: `IFC 空间 ${index + 1}`,
          parentId: level.id,
          polygon: space.polygon,
          autoFromWalls: true,
          boundaryWallIds: space.wallIds,
          metadata: { source: 'ifc-reconstruction', confidence: 'high' },
        })
        nodes[zone.id] = zone
        levelChildren.add(zone.id)
        zones += 1
      }
      if (
        !existingCeilings.some(
          (ceiling) => polygonArea(ceiling.polygon) === polygonArea(space.polygon),
        )
      ) {
        const wallHeight = Math.max(
          2.5,
          ...space.wallIds.map((id) => {
            const wall = nodes[id]
            return wall?.type === 'wall' ? (wall.height ?? 2.5) : 2.5
          }),
        )
        const ceiling = CeilingNode.parse({
          id: `ceiling_ifc_${makeId()}`,
          type: 'ceiling',
          parentId: level.id,
          polygon: space.polygon,
          height: wallHeight,
          autoFromWalls: true,
          metadata: { source: 'ifc-reconstruction', confidence: 'high' },
        })
        nodes[ceiling.id] = ceiling
        levelChildren.add(ceiling.id)
        ceilings += 1
      }
    }
    level.children = [...levelChildren] as typeof level.children
  }
  return { ceilings, zones }
}

export function reconstructIfcResidential(
  sourceGraph: IfcResidentialSourceGraph,
  source: IfcSourceIdentity,
): IfcResidentialReconstruction {
  const nodes: Record<string, AnyNode> = {}
  const reviewItems: IfcResidentialReviewItem[] = []

  for (const node of Object.values(sourceGraph.nodes)) {
    if (!SUPPORTED_KINDS.has(node.type)) {
      reviewItems.push(reviewItem(node, 'unsupported-kind'))
      continue
    }
    if (!hasValidGeometry(node, sourceGraph.nodes)) {
      reviewItems.push(reviewItem(node, 'invalid-geometry'))
      continue
    }
    nodes[node.id] = sanitizeNode(node)
  }

  let removedOrphan = true
  while (removedOrphan) {
    removedOrphan = false
    for (const node of Object.values(nodes)) {
      if (!node.parentId || nodes[node.parentId]) continue
      reviewItems.push(reviewItem(node, 'missing-parent'))
      delete nodes[node.id]
      removedOrphan = true
    }
  }

  for (const node of Object.values(nodes)) {
    if ('children' in node && Array.isArray(node.children)) {
      node.children = node.children.filter((id) => !!nodes[id]) as typeof node.children
    }
  }

  const generated = addGeneratedSurfaces(nodes)
  const missing: IfcResidentialConversionReport['minimumStructure']['missing'] = []
  for (const kind of ['building', 'level', 'wall', 'zone'] as const) {
    if (!Object.values(nodes).some((node) => node.type === kind)) missing.push(kind)
  }
  const minimumStructure = { missing, satisfied: missing.length === 0 }
  const rootNodeIds = sourceGraph.rootNodeIds.filter((id) => !!nodes[id])
  for (const node of Object.values(nodes)) {
    if (node.parentId === null && !rootNodeIds.includes(node.id)) rootNodeIds.push(node.id)
  }

  const report: IfcResidentialConversionReport = {
    generated,
    minimumStructure,
    nodeCounts: {
      draft: minimumStructure.satisfied ? Object.keys(nodes).length : 0,
      highConfidence: Object.keys(nodes).length,
      review: reviewItems.length,
      source: Object.keys(sourceGraph.nodes).length,
    },
    reviewItems,
    source,
    status: minimumStructure.satisfied ? 'draft-ready' : 'report-only',
    version: 1,
  }

  return {
    draft: minimumStructure.satisfied ? { nodes, rootNodeIds: rootNodeIds as AnyNodeId[] } : null,
    referenceGraph: structuredClone(sourceGraph),
    report,
  }
}

export async function hashIfcSource(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
