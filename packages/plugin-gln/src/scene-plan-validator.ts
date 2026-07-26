import type {
  ScenePlanIssue,
  ScenePlanValidationContext,
  ScenePlanValidatorDefinition,
} from '@pascal-app/core/scene-plan'
import type { AnyNode, AnyNodeId, WallNode } from '@pascal-app/core/schema'
import { getGlnInstallationIssues } from './equipment-installation'
import { getGlnHydronicTopologyIssues } from './hydronic-topology'
import { resolveWallPanelTarget } from './wall-panel-installation'
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
    ...validateTopology(nodes, affected),
  ]
}

export const glnScenePlanValidator: ScenePlanValidatorDefinition = {
  id: 'gln:hard-validation',
  validate: validateGlnScenePlan,
}
