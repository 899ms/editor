import type { ScenePlan, ScenePlanIssue } from '@pascal-app/core/scene-plan'
import type { SceneGraph } from '@pascal-app/editor'
import {
  GlnBufferTankNode,
  GlnHydronicPipeNode,
  GlnOutdoorUnitNode,
  GlnSystemNode,
  GlnWallPanelNode,
  getGlnHydronicTopologyIssues,
  getGlnInstallationIssues,
} from '@pascal-app/plugin-gln'
import type { GlnConfigurationRequest } from './schema'

export const GLN_CONFIGURATION_NODE_TYPES = [
  'gln:system',
  'gln:outdoor-unit',
  'gln:buffer-tank',
  'gln:hydronic-pipe',
  'gln:wall-panel',
] as const

export type GlnConfigurationNodeType = (typeof GLN_CONFIGURATION_NODE_TYPES)[number]

type PlanNode = Record<string, unknown> & {
  id: string
  type: string
  metadata?: unknown
  systemId?: string
}

export type GlnConfigurationReviewItem = {
  code: 'installation' | 'panel-placement' | 'routing'
  message: string
  nodeIds: string[]
}

export type GlnConfigurationCompletenessIssue = {
  code:
    | 'duplicate-device'
    | 'missing-buffer-tank'
    | 'missing-closed-loop'
    | 'missing-outdoor-unit'
    | 'missing-panel-loop'
    | 'missing-wall-panel'
    | 'system-count-mismatch'
  message: string
  nodeIds: string[]
}

export type GlnConfigurationReport = {
  version: 1
  status: 'ready' | 'needs-review' | 'report-only'
  systems: {
    before: number
    requested: number
    expected: number
    after: number
    affectedIds: string[]
  }
  completenessIssues: GlnConfigurationCompletenessIssue[]
  reviewItems: GlnConfigurationReviewItem[]
}

export type GlnConfigurationScopeResult =
  | { ok: true }
  | {
      ok: false
      code:
        | 'gln_configuration_locked_node'
        | 'gln_configuration_scope_violation'
        | 'gln_configuration_stable_id_violation'
      message: string
      nodeIds: string[]
    }

const CONFIGURATION_TYPE_SET = new Set<string>(GLN_CONFIGURATION_NODE_TYPES)
const CONFIGURATION_SCHEMAS = {
  'gln:system': GlnSystemNode,
  'gln:outdoor-unit': GlnOutdoorUnitNode,
  'gln:buffer-tank': GlnBufferTankNode,
  'gln:hydronic-pipe': GlnHydronicPipeNode,
  'gln:wall-panel': GlnWallPanelNode,
} as const

function nodesOf(graph: SceneGraph): Record<string, PlanNode> {
  return graph.nodes as unknown as Record<string, PlanNode>
}

function isConfigurationType(type: string): type is GlnConfigurationNodeType {
  return CONFIGURATION_TYPE_SET.has(type)
}

function metadataRecord(node: PlanNode | undefined): Record<string, unknown> {
  return node?.metadata && typeof node.metadata === 'object' && !Array.isArray(node.metadata)
    ? (node.metadata as Record<string, unknown>)
    : {}
}

function isLocked(node: PlanNode | undefined): boolean {
  const metadata = metadataRecord(node)
  return (
    (node as (PlanNode & { locked?: boolean }) | undefined)?.locked === true ||
    metadata.locked === true ||
    metadata.glnLocked === true
  )
}

export function validateGlnConfigurationScope(
  plan: ScenePlan,
  beforeGraph: SceneGraph,
  options: { protectExistingIds?: boolean } = {},
): GlnConfigurationScopeResult {
  const beforeNodes = nodesOf(beforeGraph)
  const known = new Map<string, PlanNode>(Object.values(beforeNodes).map((node) => [node.id, node]))
  const rejected = new Set<string>()
  const locked = new Set<string>()
  const replaced = new Set<string>()

  for (const operation of plan.operations) {
    if (operation.op === 'create') {
      const node = operation.node as PlanNode
      if (!isConfigurationType(node.type)) rejected.add(node.id)
      known.set(node.id, node)
      continue
    }

    const existing = known.get(operation.id)
    if (!existing || !isConfigurationType(existing.type)) rejected.add(operation.id)
    if (isLocked(existing)) locked.add(operation.id)
    if (
      operation.op === 'delete' &&
      options.protectExistingIds !== false &&
      beforeNodes[operation.id]
    ) {
      replaced.add(operation.id)
    }
    if (
      operation.op === 'update' &&
      typeof operation.data.type === 'string' &&
      operation.data.type !== existing?.type
    ) {
      rejected.add(operation.id)
    }
    if (operation.op === 'delete') known.delete(operation.id)
  }

  if (locked.size > 0) {
    return {
      ok: false,
      code: 'gln_configuration_locked_node',
      message: 'AI 不能更新、移动或删除已锁定的光冷暖物理节点。',
      nodeIds: [...locked],
    }
  }
  if (replaced.size > 0) {
    return {
      ok: false,
      code: 'gln_configuration_stable_id_violation',
      message: '重复配置必须按 systemId 和稳定节点 ID 更新现有系统，不能删除后换用新 ID。',
      nodeIds: [...replaced],
    }
  }
  if (rejected.size > 0) {
    return {
      ok: false,
      code: 'gln_configuration_scope_violation',
      message: '光冷暖配置只能创建或调整系统、外机、水箱、水管、面板及系统内的 Zone 设置。',
      nodeIds: [...rejected],
    }
  }
  return { ok: true }
}

export function normalizeGlnConfigurationScenePlan(plan: ScenePlan): ScenePlan {
  return {
    ...plan,
    operations: plan.operations.map((operation) => {
      if (operation.op !== 'create') return operation
      if (!isConfigurationType(operation.node.type)) return operation
      const schema = CONFIGURATION_SCHEMAS[operation.node.type]
      const parentId =
        operation.parentId ??
        (typeof operation.node.parentId === 'string' ? operation.node.parentId : undefined)
      return {
        ...operation,
        ...(parentId ? { parentId } : {}),
        node: schema.parse({
          ...operation.node,
          ...(parentId ? { parentId } : {}),
        }),
      }
    }),
  }
}

function systemIds(graph: SceneGraph): string[] {
  return Object.values(nodesOf(graph))
    .filter((node) => node.type === 'gln:system')
    .map((node) => node.id)
    .sort()
}

function affectedSystemIds(input: {
  beforeGraph: SceneGraph
  afterGraph: SceneGraph
  touchedNodeIds: readonly string[]
}): string[] {
  const before = nodesOf(input.beforeGraph)
  const after = nodesOf(input.afterGraph)
  const ids = new Set<string>()
  for (const nodeId of input.touchedNodeIds) {
    for (const node of [before[nodeId], after[nodeId]]) {
      if (node?.type === 'gln:system') ids.add(node.id)
      if (typeof node?.systemId === 'string') ids.add(node.systemId)
    }
  }
  return [...ids].sort()
}

function endpointKey(endpoint: unknown): string {
  if (!endpoint || typeof endpoint !== 'object') return ''
  const value = endpoint as { nodeId?: unknown; portId?: unknown }
  return `${String(value.nodeId ?? '')}:${String(value.portId ?? '')}`
}

function exactDuplicateIssues(nodes: Record<string, PlanNode>, systemId: string) {
  const issues: GlnConfigurationCompletenessIssue[] = []
  const signatures = new Map<string, string[]>()
  for (const node of Object.values(nodes)) {
    if (node.systemId !== systemId) continue
    let signature: string | null = null
    if (node.type === 'gln:wall-panel') {
      signature = [
        node.type,
        String(node.wallId ?? ''),
        String(node.side ?? ''),
        JSON.stringify(node.position ?? null),
      ].join('|')
    } else if (node.type === 'gln:hydronic-pipe') {
      const endpoints = [endpointKey(node.start), endpointKey(node.end)].sort()
      signature = [node.type, String(node.circuit ?? ''), ...endpoints].join('|')
    }
    if (!signature) continue
    signatures.set(signature, [...(signatures.get(signature) ?? []), node.id])
  }
  for (const ids of signatures.values()) {
    if (ids.length < 2) continue
    issues.push({
      code: 'duplicate-device',
      message: '同一系统中出现了重复面板或重复水路，必须按稳定节点 ID 更新现有设备。',
      nodeIds: ids,
    })
  }
  return issues
}

function endpointMatches(endpoint: unknown, nodeId: string, portId: string): boolean {
  if (!endpoint || typeof endpoint !== 'object') return false
  const value = endpoint as { nodeId?: unknown; portId?: unknown }
  return value.nodeId === nodeId && value.portId === portId
}

function pipeConnects(
  pipe: PlanNode,
  firstNodeId: string,
  firstPortId: string,
  secondNodeId: string,
  secondPortId: string,
) {
  return (
    (endpointMatches(pipe.start, firstNodeId, firstPortId) &&
      endpointMatches(pipe.end, secondNodeId, secondPortId)) ||
    (endpointMatches(pipe.start, secondNodeId, secondPortId) &&
      endpointMatches(pipe.end, firstNodeId, firstPortId))
  )
}

function panelLoopIssues(
  owned: readonly PlanNode[],
  panels: readonly PlanNode[],
  tanks: readonly PlanNode[],
): GlnConfigurationCompletenessIssue[] {
  const pipes = owned.filter((node) => node.type === 'gln:hydronic-pipe')
  return panels.flatMap((panel) => {
    const supply = pipes.filter(
      (pipe) =>
        pipe.circuit === 'supply' &&
        tanks.some((tank) => pipeConnects(pipe, tank.id, 'load-supply', panel.id, 'supply')),
    )
    const returns = pipes.filter(
      (pipe) =>
        pipe.circuit === 'return' &&
        tanks.some((tank) => pipeConnects(pipe, panel.id, 'return', tank.id, 'load-return')),
    )
    if (supply.length === 1 && returns.length === 1) return []
    return [
      {
        code: 'missing-panel-loop' as const,
        message: '每块室内面板都必须分别连接同一系统的负载供水和负载回水。',
        nodeIds: [panel.id, ...supply.map((pipe) => pipe.id), ...returns.map((pipe) => pipe.id)],
      },
    ]
  })
}

const REVIEWABLE_PANEL_CODES = new Set([
  'gln-panel-curved-wall',
  'gln-panel-opening-overlap',
  'gln-panel-too-small',
  'gln-panel-zone-unresolved',
])

function reviewItemCode(issue: ScenePlanIssue): GlnConfigurationReviewItem['code'] | null {
  if (issue.severity !== 'error') return null
  if (issue.code.startsWith('gln-installation-')) return 'installation'
  if (issue.code.startsWith('gln-routing-')) return 'routing'
  if (REVIEWABLE_PANEL_CODES.has(issue.code)) return 'panel-placement'
  return null
}

function reviewablePlanIssues(issues: readonly ScenePlanIssue[]): GlnConfigurationReviewItem[] {
  return issues.flatMap((issue) => {
    const code = reviewItemCode(issue)
    return code
      ? [
          {
            code,
            message: issue.message,
            nodeIds: issue.nodeIds ?? [],
          },
        ]
      : []
  })
}

export function analyzeGlnConfiguration(input: {
  beforeGraph: SceneGraph
  afterGraph: SceneGraph
  request: GlnConfigurationRequest
  touchedNodeIds: readonly string[]
  previewIssues?: readonly ScenePlanIssue[]
}): GlnConfigurationReport {
  const beforeSystems = systemIds(input.beforeGraph)
  const afterSystems = systemIds(input.afterGraph)
  const expected = Math.max(beforeSystems.length, input.request.targetSystemCount)
  const affectedIds = affectedSystemIds(input)
  const nodes = nodesOf(input.afterGraph)
  const completenessIssues: GlnConfigurationCompletenessIssue[] = []
  const reviewItems: GlnConfigurationReviewItem[] = [
    ...reviewablePlanIssues(input.previewIssues ?? []),
    ...getGlnInstallationIssues(nodes as never).map((issue) => ({
      code: 'installation' as const,
      message: issue.message,
      nodeIds: issue.nodeIds,
    })),
  ]

  if (afterSystems.length !== expected) {
    completenessIssues.push({
      code: 'system-count-mismatch',
      message: `任务要求保留或配置 ${expected} 套系统，计划结果为 ${afterSystems.length} 套。`,
      nodeIds: afterSystems,
    })
  }

  for (const systemId of afterSystems) {
    const owned = Object.values(nodes).filter((node) => node.systemId === systemId)
    const outdoor = owned.filter((node) => node.type === 'gln:outdoor-unit')
    const tanks = owned.filter((node) => node.type === 'gln:buffer-tank')
    const panels = owned.filter((node) => node.type === 'gln:wall-panel')
    if (outdoor.length !== 1) {
      completenessIssues.push({
        code: outdoor.length === 0 ? 'missing-outdoor-unit' : 'duplicate-device',
        message: '每套光冷暖系统必须且只能有一台外机。',
        nodeIds: outdoor.map((node) => node.id),
      })
    }
    if (tanks.length !== 1) {
      completenessIssues.push({
        code: tanks.length === 0 ? 'missing-buffer-tank' : 'duplicate-device',
        message: '每套光冷暖系统必须且只能有一个缓冲水箱。',
        nodeIds: tanks.map((node) => node.id),
      })
    }
    if (panels.length === 0) {
      completenessIssues.push({
        code: 'missing-wall-panel',
        message: '每套光冷暖系统至少需要一块归属明确的室内面板。',
        nodeIds: [systemId],
      })
    }
    const topology = getGlnHydronicTopologyIssues(nodes, systemId)
    if (topology.length > 0) {
      completenessIssues.push({
        code: 'missing-closed-loop',
        message: '每套光冷暖系统必须形成完整且同系统的供回水闭环。',
        nodeIds: [...new Set(topology.flatMap((issue) => issue.nodeIds))],
      })
    }
    completenessIssues.push(...panelLoopIssues(owned, panels, tanks))
    completenessIssues.push(...exactDuplicateIssues(nodes, systemId))

    for (const pipe of owned) {
      if (pipe.type !== 'gln:hydronic-pipe') continue
      const routing = pipe.routing as { state?: unknown; reviewReason?: unknown } | null | undefined
      if (routing?.state !== 'needs-review') continue
      reviewItems.push({
        code: 'routing',
        message:
          routing.reviewReason === 'missing-riser'
            ? '跨层水路缺少已确认的竖向通道，需要人工选定路径。'
            : routing.reviewReason === 'obstructed'
              ? '自动水路与障碍冲突，需要人工调整路径。'
              : '水路端点不完整，需要人工复核。',
        nodeIds: [pipe.id],
      })
    }
  }

  const uniqueCompleteness = [
    ...new Map(
      completenessIssues.map((issue) => [
        `${issue.code}:${issue.nodeIds.join(',')}:${issue.message}`,
        issue,
      ]),
    ).values(),
  ]
  const uniqueReview = [
    ...new Map(
      reviewItems.map((item) => [`${item.code}:${item.nodeIds.join(',')}:${item.message}`, item]),
    ).values(),
  ]
  return {
    version: 1,
    status:
      uniqueCompleteness.length > 0
        ? 'report-only'
        : uniqueReview.length > 0
          ? 'needs-review'
          : 'ready',
    systems: {
      before: beforeSystems.length,
      requested: input.request.targetSystemCount,
      expected,
      after: afterSystems.length,
      affectedIds,
    },
    completenessIssues: uniqueCompleteness,
    reviewItems: uniqueReview,
  }
}

export function onlyReviewableGlnPlacementErrors(issues: readonly ScenePlanIssue[]): boolean {
  const errors = issues.filter((issue) => issue.severity === 'error')
  return errors.length > 0 && errors.every((issue) => reviewItemCode(issue) !== null)
}
