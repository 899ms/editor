import type { SceneGraph } from '@pascal-app/core/clone-scene-graph'
import type { ScenePlan } from '@pascal-app/core/scene-plan'
import {
  BuildingNode,
  CeilingNode,
  DoorNode,
  LevelNode,
  RoofNode,
  SiteNode,
  SlabNode,
  WallNode,
  WindowNode,
  ZoneNode,
} from '@pascal-app/core/schema'

export const RESIDENTIAL_NODE_TYPES = [
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
] as const

export type ResidentialNodeType = (typeof RESIDENTIAL_NODE_TYPES)[number]
export type ResidentialMinimumKind = 'level' | 'wall' | 'zone' | 'indoor-outdoor-relation'
export type ResidentialReviewReason = 'medium-confidence' | 'low-confidence' | 'missing-confidence'

export type ResidentialReviewItem = {
  nodeId: string
  nodeType: ResidentialNodeType
  confidence: 'medium' | 'low' | null
  reason: ResidentialReviewReason
  message: string
}

export type ResidentialDraftReport = {
  version: 1
  status: 'draft-ready' | 'report-only'
  minimumStructure: {
    satisfied: boolean
    missing: ResidentialMinimumKind[]
  }
  nodeCounts: {
    residential: number
    touched: number
    highConfidence: number
    review: number
  }
  reviewItems: ResidentialReviewItem[]
}

export type ResidentialScopeResult =
  | { ok: true }
  | {
      ok: false
      code: 'residential_node_type_not_allowed'
      message: string
      nodeIds: string[]
    }

const RESIDENTIAL_NODE_TYPE_SET = new Set<string>(RESIDENTIAL_NODE_TYPES)
const RESIDENTIAL_NODE_SCHEMAS: Record<
  ResidentialNodeType,
  { parse(input: unknown): Record<string, unknown> & { id: string; type: string } }
> = {
  site: SiteNode,
  building: BuildingNode,
  level: LevelNode,
  wall: WallNode,
  slab: SlabNode,
  ceiling: CeilingNode,
  roof: RoofNode,
  door: DoorNode,
  window: WindowNode,
  zone: ZoneNode,
}
type GraphNode = SceneGraph['nodes'][keyof SceneGraph['nodes']]

function nodeRecord(graph: SceneGraph): Record<string, GraphNode> {
  return graph.nodes as Record<string, GraphNode>
}

function isResidentialNodeType(type: string): type is ResidentialNodeType {
  return RESIDENTIAL_NODE_TYPE_SET.has(type)
}

export function validateResidentialPlanScope(
  plan: ScenePlan,
  beforeGraph: SceneGraph,
): ResidentialScopeResult {
  const knownTypes = new Map<string, string>(
    Object.values(beforeGraph.nodes).map((node) => [node.id, node.type] as const),
  )
  const rejected: string[] = []

  for (const operation of plan.operations) {
    if (operation.op === 'create') {
      if (!isResidentialNodeType(operation.node.type)) rejected.push(operation.node.id)
      knownTypes.set(operation.node.id, operation.node.type)
      continue
    }

    const type = knownTypes.get(operation.id)
    if (!type || !isResidentialNodeType(type)) rejected.push(operation.id)
    if (
      operation.op === 'update' &&
      typeof operation.data.type === 'string' &&
      operation.data.type !== type
    ) {
      rejected.push(operation.id)
    }
    if (operation.op === 'delete') knownTypes.delete(operation.id)
  }

  if (rejected.length > 0) {
    return {
      ok: false,
      code: 'residential_node_type_not_allowed',
      message: '住宅重建只能生成既有的可编辑建筑节点。',
      nodeIds: [...new Set(rejected)],
    }
  }
  return { ok: true }
}

export function normalizeResidentialScenePlan(plan: ScenePlan): ScenePlan {
  return {
    ...plan,
    operations: plan.operations.map((operation) => {
      if (operation.op !== 'create') return operation
      if (!isResidentialNodeType(operation.node.type)) return operation
      return {
        ...operation,
        node: RESIDENTIAL_NODE_SCHEMAS[operation.node.type].parse({
          ...operation.node,
          ...(operation.parentId ? { parentId: operation.parentId } : {}),
        }),
      }
    }),
  }
}

function metadataRecord(node: GraphNode): Record<string, unknown> {
  if (typeof node.metadata !== 'object' || node.metadata === null || Array.isArray(node.metadata)) {
    return {}
  }
  return node.metadata as Record<string, unknown>
}

function hasIndoorOutdoorRelation(graph: SceneGraph): boolean {
  const nodes = nodeRecord(graph)
  const zones = Object.values(nodes).filter(
    (node): node is Extract<GraphNode, { type: 'zone' }> =>
      node.type === 'zone' &&
      node.polygon.length >= 3 &&
      node.boundaryWallIds.length >= 3 &&
      typeof node.parentId === 'string' &&
      nodes[node.parentId]?.type === 'level',
  )

  return zones.some((zone) =>
    zone.boundaryWallIds.some((wallId) => {
      const wall = nodes[wallId]
      if (wall?.type !== 'wall') return false
      const sides = new Set([wall.frontSide, wall.backSide])
      return sides.has('interior') && sides.has('exterior')
    }),
  )
}

function reviewItem(
  node: GraphNode,
  reason: ResidentialReviewReason,
  confidence: 'medium' | 'low' | null,
): ResidentialReviewItem {
  const metadata = metadataRecord(node)
  const detail =
    typeof metadata.reviewReason === 'string' && metadata.reviewReason.trim()
      ? `：${metadata.reviewReason.trim()}`
      : ''
  const label =
    reason === 'missing-confidence'
      ? '未标注置信度'
      : reason === 'low-confidence'
        ? '低置信度'
        : '中等置信度'
  return {
    nodeId: node.id,
    nodeType: node.type as ResidentialNodeType,
    confidence,
    reason,
    message: `${node.name?.trim() || node.id}为${label}构件${detail}`,
  }
}

export function analyzeResidentialScenePlan(input: {
  graph: SceneGraph
  touchedNodeIds: readonly string[]
}): ResidentialDraftReport {
  const nodes = nodeRecord(input.graph)
  const residentialNodes = Object.values(nodes).filter((node) => isResidentialNodeType(node.type))
  const missing: ResidentialMinimumKind[] = []
  if (!residentialNodes.some((node) => node.type === 'level')) missing.push('level')
  if (residentialNodes.filter((node) => node.type === 'wall').length < 3) missing.push('wall')
  if (
    !residentialNodes.some(
      (node) =>
        node.type === 'zone' &&
        node.polygon.length >= 3 &&
        typeof node.parentId === 'string' &&
        nodes[node.parentId]?.type === 'level',
    )
  ) {
    missing.push('zone')
  }
  if (!hasIndoorOutdoorRelation(input.graph)) missing.push('indoor-outdoor-relation')

  const touchedNodes = [...new Set(input.touchedNodeIds)]
    .map((id) => nodes[id])
    .filter((node): node is NonNullable<typeof node> => !!node && isResidentialNodeType(node.type))
  const reviewItems: ResidentialReviewItem[] = []
  let highConfidence = 0

  for (const node of touchedNodes) {
    const confidence = metadataRecord(node).confidence
    if (confidence === 'high') {
      highConfidence += 1
    } else if (confidence === 'medium') {
      reviewItems.push(reviewItem(node, 'medium-confidence', 'medium'))
    } else if (confidence === 'low') {
      reviewItems.push(reviewItem(node, 'low-confidence', 'low'))
    } else {
      reviewItems.push(reviewItem(node, 'missing-confidence', null))
    }
  }

  return {
    version: 1,
    status: missing.length === 0 ? 'draft-ready' : 'report-only',
    minimumStructure: {
      satisfied: missing.length === 0,
      missing,
    },
    nodeCounts: {
      residential: residentialNodes.length,
      touched: touchedNodes.length,
      highConfidence,
      review: reviewItems.length,
    },
    reviewItems,
  }
}
