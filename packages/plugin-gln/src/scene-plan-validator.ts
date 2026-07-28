import type {
  ScenePlanIssue,
  ScenePlanValidationContext,
  ScenePlanValidatorDefinition,
} from '@pascal-app/core/scene-plan'
import type { AnyNode, AnyNodeId, WallNode } from '@pascal-app/core/schema'
import { getGlnBufferTankPorts } from './buffer-tank-ports'
import { getGlnInstallationIssues } from './equipment-installation'
import {
  type GlnHydronicPipeNode,
  GlnHydronicPipeNode as GlnHydronicPipeSchema,
} from './hydronic-pipe-schema'
import {
  collectGlnRoutingObstacles,
  type GlnRoutePoint,
  planGlnConcealedRoute,
  resolveGlnNodeLevelId,
} from './hydronic-routing'
import { getGlnHydronicTopologyIssues } from './hydronic-topology'
import { getGlnOutdoorUnitPorts } from './outdoor-unit-ports'
import { resolveWallPanelTarget } from './wall-panel-installation'
import { getGlnWallPanelPorts } from './wall-panel-ports'
import type { GlnWallPanelNode } from './wall-panel-schema'

type PlanNode = Record<string, unknown> & {
  id: string
  type: string
  systemId?: string
  zoneId?: string | null
  zoneSettings?: Record<string, unknown>
}

const PHYSICAL_TYPES = new Set([
  'gln:outdoor-unit',
  'gln:buffer-tank',
  'gln:hydronic-pipe',
  'gln:wall-panel',
])

function error(code: string, message: string, nodeIds: string[] = []): ScenePlanIssue {
  return { severity: 'error', code, message, ...(nodeIds.length > 0 ? { nodeIds } : {}) }
}

function affectedSystemIds(
  context: ScenePlanValidationContext,
  beforeNodes: Record<string, PlanNode>,
  afterNodes: Record<string, PlanNode>,
): Set<string> {
  const ids = new Set<string>()
  for (const diff of context.diffs) {
    for (const node of [beforeNodes[diff.nodeId], afterNodes[diff.nodeId]]) {
      if (node?.type === 'gln:system') ids.add(node.id)
      if (typeof node?.systemId === 'string') ids.add(node.systemId)
    }
  }
  return ids
}

function validateSystemsAndZones(
  context: ScenePlanValidationContext,
  nodes: Record<string, PlanNode>,
  affected: ReadonlySet<string>,
): ScenePlanIssue[] {
  const issues: ScenePlanIssue[] = []
  for (const node of Object.values(nodes)) {
    if (!(PHYSICAL_TYPES.has(node.type) && affected.has(node.systemId ?? ''))) continue
    const system = node.systemId ? nodes[node.systemId] : undefined
    if (system?.type !== 'gln:system') {
      issues.push(
        error('gln-system-missing', '每个光冷暖物理资产必须属于一个存在的光冷暖系统。', [
          node.id,
          ...(node.systemId ? [node.systemId] : []),
        ]),
      )
    }
  }

  for (const systemId of affected) {
    const system = nodes[systemId]
    if (system?.type !== 'gln:system') continue
    for (const zoneId of Object.keys(system.zoneSettings ?? {})) {
      if (nodes[zoneId]?.type !== 'zone') {
        issues.push(
          error('gln-zone-missing', '系统目标设置只能引用存在的 Zone。', [systemId, zoneId]),
        )
        continue
      }
      const hasPanel = Object.values(nodes).some(
        (node) =>
          node.type === 'gln:wall-panel' && node.systemId === systemId && node.zoneId === zoneId,
      )
      if (!hasPanel) {
        issues.push(
          error('gln-zone-without-panel', '只有安装了室内面板的 Zone 才能启用目标温湿度设置。', [
            systemId,
            zoneId,
          ]),
        )
      }
    }
  }

  for (const diff of context.diffs) {
    const panel = nodes[diff.nodeId]
    if (panel?.type !== 'gln:wall-panel') continue
    if (!panel.zoneId || nodes[panel.zoneId]?.type !== 'zone') {
      issues.push(
        error('gln-panel-zone-unresolved', '墙面板必须明确归属于一个存在的 Zone。', [
          panel.id,
          ...(panel.zoneId ? [panel.zoneId] : []),
        ]),
      )
    }
  }
  return issues
}

function validatePanelHosts(
  context: ScenePlanValidationContext,
  nodes: Record<string, PlanNode>,
): ScenePlanIssue[] {
  const issues: ScenePlanIssue[] = []
  for (const diff of context.diffs) {
    const panel = nodes[diff.nodeId]
    if (panel?.type !== 'gln:wall-panel') continue
    const typedPanel = panel as unknown as GlnWallPanelNode
    const wall = nodes[typedPanel.wallId] as WallNode | undefined
    if (wall?.type !== 'wall') {
      issues.push(
        error('gln-panel-wall-missing', '墙面板必须安装在存在的墙体节点上。', [
          panel.id,
          typedPanel.wallId,
        ]),
      )
      continue
    }
    if (typedPanel.parentId !== wall.id) {
      issues.push(
        error('gln-panel-parent-mismatch', '墙面板的父节点必须是其安装墙体。', [panel.id, wall.id]),
      )
    }
    const target = resolveWallPanelTarget({
      wall,
      nodes: nodes as unknown as Readonly<Record<AnyNodeId, AnyNode>>,
      localX: typedPanel.position[0],
      side: typedPanel.side,
      width: typedPanel.width,
      height: typedPanel.height,
      depth: typedPanel.depth,
      ignoreId: typedPanel.id,
    })
    if (!target.valid) {
      const messages = {
        'curved-wall': '墙面板第一版不能安装在曲面墙上。',
        'too-small': '墙面尺寸不足以安装该墙面板。',
        'opening-overlap': '墙面板与门窗或其他面板重叠。',
        ok: '',
      } as const
      issues.push(error(`gln-panel-${target.reason}`, messages[target.reason], [panel.id, wall.id]))
    }
  }
  return issues
}

function validateDuplicateEquipment(
  nodes: Record<string, PlanNode>,
  affected: ReadonlySet<string>,
): ScenePlanIssue[] {
  const issues: ScenePlanIssue[] = []
  for (const systemId of affected) {
    for (const type of ['gln:outdoor-unit', 'gln:buffer-tank'] as const) {
      const matches = Object.values(nodes).filter(
        (node) => node.type === type && node.systemId === systemId,
      )
      if (matches.length > 1) {
        issues.push(
          error(
            'gln-duplicate-equipment',
            type === 'gln:outdoor-unit'
              ? '同一系统不能自动重复创建外机。'
              : '同一系统不能自动重复创建缓冲水箱。',
            matches.map((node) => node.id),
          ),
        )
      }
    }
  }
  return issues
}

function validateInstallation(
  context: ScenePlanValidationContext,
  nodes: Record<string, PlanNode>,
): ScenePlanIssue[] {
  const touched = new Set(context.diffs.map((diff) => diff.nodeId))
  return getGlnInstallationIssues(nodes as unknown as Readonly<Record<AnyNodeId, AnyNode>>)
    .filter((issue) => issue.nodeIds.some((nodeId) => touched.has(nodeId)))
    .map((issue) => error(`gln-installation-${issue.code}`, issue.message, issue.nodeIds))
}

function endpointPosition(
  endpoint: NonNullable<GlnHydronicPipeNode['start']>,
  nodes: Record<string, PlanNode>,
): GlnRoutePoint | null {
  const owner = nodes[endpoint.nodeId]
  if (!owner) return null
  const ports =
    owner.type === 'gln:outdoor-unit'
      ? getGlnOutdoorUnitPorts(owner as never)
      : owner.type === 'gln:buffer-tank'
        ? getGlnBufferTankPorts(owner as never)
        : owner.type === 'gln:wall-panel'
          ? getGlnWallPanelPorts(owner as never)
          : []
  const port = ports.find((candidate) => candidate.id === endpoint.portId)
  return port ? ([...port.position] as GlnRoutePoint) : null
}

function pathsEqual(left: readonly GlnRoutePoint[], right: readonly GlnRoutePoint[]) {
  const epsilon = 1e-5
  return (
    left.length === right.length &&
    left.every((point, index) =>
      point.every((value, axis) => Math.abs(value - right[index]![axis]!) < epsilon),
    )
  )
}

function validateTouchedPipeRouting(
  context: ScenePlanValidationContext,
  nodes: Record<string, PlanNode>,
): ScenePlanIssue[] {
  const sceneNodes = nodes as unknown as Readonly<Record<AnyNodeId, AnyNode>>
  const obstacles = collectGlnRoutingObstacles(sceneNodes)
  const touched = new Set(context.diffs.map((diff) => diff.nodeId))
  const issues: ScenePlanIssue[] = []
  for (const candidate of Object.values(nodes)) {
    if (candidate.type !== 'gln:hydronic-pipe') continue
    const parsed = GlnHydronicPipeSchema.safeParse(candidate)
    if (!parsed.success) continue
    const pipe = parsed.data
    if (
      !touched.has(pipe.id) &&
      !touched.has(pipe.start?.nodeId ?? '') &&
      !touched.has(pipe.end?.nodeId ?? '')
    ) {
      continue
    }
    if (!(pipe.start && pipe.end)) continue
    const start = endpointPosition(pipe.start, nodes)
    const end = endpointPosition(pipe.end, nodes)
    if (!(start && end)) continue
    const startLevelId = resolveGlnNodeLevelId(sceneNodes, pipe.start.nodeId)
    const endLevelId = resolveGlnNodeLevelId(sceneNodes, pipe.end.nodeId)
    const parent = pipe.parentId ? nodes[pipe.parentId] : undefined
    if (parent?.type !== 'level' || !startLevelId || pipe.parentId !== startLevelId) {
      issues.push(
        error(
          'gln-routing-parent-mismatch',
          '水管必须挂在起点设备所属楼层，不能成为根节点或挂到其他楼层。',
          [pipe.id, ...(pipe.parentId ? [pipe.parentId] : []), pipe.start.nodeId],
        ),
      )
      continue
    }
    const relevantObstacles = obstacles.filter((obstacle) => {
      const levelId = resolveGlnNodeLevelId(sceneNodes, obstacle.id)
      return !levelId || levelId === startLevelId || levelId === endLevelId
    })
    const planned = planGlnConcealedRoute({
      start,
      end,
      startNodeId: pipe.start.nodeId,
      endNodeId: pipe.end.nodeId,
      startLevelId,
      endLevelId,
      obstacles: relevantObstacles,
    })
    if (planned.routing.state === 'needs-review') {
      const reason =
        planned.routing.reviewReason === 'missing-riser'
          ? '跨层水路缺少已确认的竖向通道，需要人工选定路径。'
          : '自动水路与场景障碍冲突，需要人工调整路径。'
      issues.push(error('gln-routing-needs-review', reason, [pipe.id]))
      continue
    }
    if (
      !pathsEqual(pipe.path, planned.path) ||
      pipe.routing.state !== planned.routing.state ||
      pipe.routing.strategy !== planned.routing.strategy ||
      pipe.routing.reviewReason !== planned.routing.reviewReason
    ) {
      issues.push(
        error(
          'gln-routing-unvalidated',
          'AI 水路必须采用编辑器依据端口、楼层和障碍物计算的隐蔽路径；当前路径需要人工复核。',
          [pipe.id],
        ),
      )
    }
  }
  return issues
}

function validateTopology(
  nodes: Record<string, PlanNode>,
  affected: ReadonlySet<string>,
): ScenePlanIssue[] {
  const issues: ScenePlanIssue[] = []
  for (const systemId of affected) {
    const hasHydronicAssets = Object.values(nodes).some(
      (node) => PHYSICAL_TYPES.has(node.type) && node.systemId === systemId,
    )
    if (!hasHydronicAssets) continue
    for (const issue of getGlnHydronicTopologyIssues(nodes, systemId)) {
      issues.push(error(`gln-topology-${issue.code}`, issue.message, issue.nodeIds))
    }
  }
  return issues
}

export function validateGlnScenePlan(context: ScenePlanValidationContext): ScenePlanIssue[] {
  const beforeNodes = context.before.graph.nodes as unknown as Record<string, PlanNode>
  const nodes = context.after.graph.nodes as unknown as Record<string, PlanNode>
  const affected = affectedSystemIds(context, beforeNodes, nodes)
  if (affected.size === 0) return []
  return [
    ...validateSystemsAndZones(context, nodes, affected),
    ...validatePanelHosts(context, nodes),
    ...validateDuplicateEquipment(nodes, affected),
    ...validateInstallation(context, nodes),
    ...validateTouchedPipeRouting(context, nodes),
    ...validateTopology(nodes, affected),
  ]
}

export const glnScenePlanValidator: ScenePlanValidatorDefinition = {
  id: 'gln:hard-validation',
  validate: validateGlnScenePlan,
}
