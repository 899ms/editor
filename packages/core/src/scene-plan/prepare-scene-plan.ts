import { safeParseRegisteredNode } from '../registry/registry'
import type { SceneGraph } from '../utils/clone-scene-graph'
import { ScenePlanSchema } from './schema'
import type {
  PreparedScenePlan,
  ScenePlan,
  ScenePlanDiff,
  ScenePlanIssue,
  ScenePlanOperation,
  ScenePlanSnapshot,
} from './types'
import { getScenePlanValidators } from './validator-registry'

type MutableNode = Record<string, unknown> & { id: string; type: string }

function cloneGraph(graph: SceneGraph): SceneGraph {
  return structuredClone(graph)
}

function asMutableNodes(graph: SceneGraph): Record<string, MutableNode> {
  return graph.nodes as unknown as Record<string, MutableNode>
}

function childIds(node: MutableNode | undefined): string[] {
  if (!Array.isArray(node?.children)) return []
  return node.children.flatMap((child) => {
    if (typeof child === 'string') return [child]
    if (
      child &&
      typeof child === 'object' &&
      typeof (child as Record<string, unknown>).id === 'string'
    ) {
      return [(child as { id: string }).id]
    }
    return []
  })
}

function collectDescendants(nodes: Record<string, MutableNode>, rootId: string): string[] {
  const collected: string[] = []
  const pending = [rootId]
  const seen = new Set<string>()
  while (pending.length > 0) {
    const id = pending.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    if (!nodes[id]) continue
    collected.push(id)
    for (const childId of childIds(nodes[id])) pending.push(childId)
    for (const node of Object.values(nodes)) {
      if (node.parentId === id) pending.push(node.id)
    }
  }
  return collected
}

function removeChildReference(node: MutableNode, removed: ReadonlySet<string>): MutableNode {
  if (!Array.isArray(node.children)) return node
  const nextChildren = node.children.filter((child) => {
    const id =
      typeof child === 'string'
        ? child
        : child && typeof child === 'object'
          ? (child as Record<string, unknown>).id
          : null
    return typeof id !== 'string' || !removed.has(id)
  })
  return nextChildren.length === node.children.length ? node : { ...node, children: nextChildren }
}

function isLocked(node: MutableNode | undefined): boolean {
  if (!node) return false
  if (node.locked === true) return true
  const metadata = node.metadata
  return (
    !!metadata &&
    typeof metadata === 'object' &&
    ((metadata as Record<string, unknown>).locked === true ||
      (metadata as Record<string, unknown>).glnLocked === true)
  )
}

function parentIdOf(node: MutableNode | undefined): string | null {
  return typeof node?.parentId === 'string' ? node.parentId : null
}

function addChildReference(node: MutableNode, childId: string): MutableNode {
  if (childIds(node).includes(childId)) return node
  const children = Array.isArray(node.children) ? node.children : []
  return { ...node, children: [...children, childId] }
}

function applyOperation(
  graph: SceneGraph,
  operation: ScenePlanOperation,
  operationIndex: number,
  issues: ScenePlanIssue[],
): void {
  const nodes = asMutableNodes(graph)
  if (operation.op === 'create') {
    const id = operation.node.id
    if (nodes[id]) {
      issues.push({
        severity: 'error',
        code: 'duplicate-node',
        message: `节点 "${id}" 已存在，不能重复创建。`,
        nodeIds: [id],
        operationIndex,
      })
      return
    }
    if (operation.parentId && !nodes[operation.parentId]) {
      issues.push({
        severity: 'error',
        code: 'missing-parent',
        message: `父节点 "${operation.parentId}" 不存在。`,
        nodeIds: [id, operation.parentId],
        operationIndex,
      })
      return
    }
    if (operation.parentId && isLocked(nodes[operation.parentId])) {
      issues.push({
        severity: 'error',
        code: 'locked-parent',
        message: `父节点 "${operation.parentId}" 已锁定，不能在其中创建节点 "${id}"。`,
        nodeIds: [operation.parentId, id],
        operationIndex,
      })
      return
    }
    const node = {
      ...operation.node,
      ...(operation.parentId ? { parentId: operation.parentId } : {}),
    } as MutableNode
    nodes[id] = node
    if (operation.parentId) {
      const parent = nodes[operation.parentId]!
      nodes[operation.parentId] = addChildReference(parent, id)
    } else if (!graph.rootNodeIds.includes(id as never)) {
      graph.rootNodeIds.push(id as never)
    }
    return
  }

  const existing = nodes[operation.id]
  if (!existing) {
    issues.push({
      severity: 'error',
      code: 'missing-node',
      message: `节点 "${operation.id}" 不存在。`,
      nodeIds: [operation.id],
      operationIndex,
    })
    return
  }
  if (isLocked(existing)) {
    issues.push({
      severity: 'error',
      code: 'locked-node',
      message: `节点 "${operation.id}" 已锁定，计划不能修改或删除它。`,
      nodeIds: [operation.id],
      operationIndex,
    })
    return
  }

  if (operation.op === 'update') {
    if ('id' in operation.data && operation.data.id !== operation.id) {
      issues.push({
        severity: 'error',
        code: 'immutable-node-id',
        message: `计划不能修改节点 "${operation.id}" 的 ID。`,
        nodeIds: [operation.id],
        operationIndex,
      })
      return
    }
    const oldParentId = parentIdOf(existing)
    const updatesParent = Object.hasOwn(operation.data, 'parentId')
    const nextParentId = updatesParent
      ? typeof operation.data.parentId === 'string'
        ? operation.data.parentId
        : null
      : oldParentId
    if (updatesParent && nextParentId !== oldParentId) {
      if (nextParentId && !nodes[nextParentId]) {
        issues.push({
          severity: 'error',
          code: 'missing-parent',
          message: `父节点 "${nextParentId}" 不存在。`,
          nodeIds: [operation.id, nextParentId],
          operationIndex,
        })
        return
      }
      const affectedParentIds = [oldParentId, nextParentId].filter(
        (id): id is string => typeof id === 'string',
      )
      const lockedParentId = affectedParentIds.find((id) => isLocked(nodes[id]))
      if (lockedParentId) {
        issues.push({
          severity: 'error',
          code: 'locked-parent',
          message: `父节点 "${lockedParentId}" 已锁定，不能移动节点 "${operation.id}"。`,
          nodeIds: [lockedParentId, operation.id],
          operationIndex,
        })
        return
      }
      if (nextParentId && collectDescendants(nodes, operation.id).includes(nextParentId)) {
        issues.push({
          severity: 'error',
          code: 'cyclic-parent',
          message: `节点 "${operation.id}" 不能移动到自身后代 "${nextParentId}" 下。`,
          nodeIds: [operation.id, nextParentId],
          operationIndex,
        })
        return
      }
      if (oldParentId) {
        nodes[oldParentId] = removeChildReference(nodes[oldParentId]!, new Set([operation.id]))
      } else {
        graph.rootNodeIds = graph.rootNodeIds.filter((id) => id !== operation.id)
      }
      if (nextParentId) {
        nodes[nextParentId] = addChildReference(nodes[nextParentId]!, operation.id)
      } else if (!graph.rootNodeIds.includes(operation.id as never)) {
        graph.rootNodeIds.push(operation.id as never)
      }
    }
    nodes[operation.id] = {
      ...existing,
      ...operation.data,
      id: operation.id,
      parentId: nextParentId,
    } as MutableNode
    return
  }

  const descendants = collectDescendants(nodes, operation.id)
  if (descendants.length > 1 && operation.cascade !== true) {
    issues.push({
      severity: 'error',
      code: 'delete-requires-cascade',
      message: `节点 "${operation.id}" 包含子节点，删除计划必须明确使用级联删除。`,
      nodeIds: descendants,
      operationIndex,
    })
    return
  }
  const lockedDescendantIds = descendants.filter((id) => isLocked(nodes[id]))
  if (lockedDescendantIds.length > 0) {
    issues.push({
      severity: 'error',
      code: 'locked-node',
      message: `删除范围包含已锁定节点：${lockedDescendantIds.join('、')}。`,
      nodeIds: lockedDescendantIds,
      operationIndex,
    })
    return
  }
  const removed = new Set(descendants)
  const lockedParentIds = Object.values(nodes)
    .filter(
      (node) =>
        !removed.has(node.id) &&
        isLocked(node) &&
        childIds(node).some((childId) => removed.has(childId)),
    )
    .map((node) => node.id)
  if (lockedParentIds.length > 0) {
    issues.push({
      severity: 'error',
      code: 'locked-parent',
      message: `删除操作会修改已锁定父节点：${lockedParentIds.join('、')}。`,
      nodeIds: [...lockedParentIds, operation.id],
      operationIndex,
    })
    return
  }
  for (const id of removed) delete nodes[id]
  for (const [id, node] of Object.entries(nodes)) {
    nodes[id] = removeChildReference(node, removed)
  }
  graph.rootNodeIds = graph.rootNodeIds.filter((id) => !removed.has(id))
}

function changedFields(before: MutableNode, after: MutableNode): string[] {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...fields].filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  )
}

function buildDiffs(before: SceneGraph, after: SceneGraph): ScenePlanDiff[] {
  const beforeNodes = asMutableNodes(before)
  const afterNodes = asMutableNodes(after)
  const ids = new Set([...Object.keys(beforeNodes), ...Object.keys(afterNodes)])
  const diffs: ScenePlanDiff[] = []
  for (const id of ids) {
    const previous = beforeNodes[id]
    const next = afterNodes[id]
    if (!previous && next) {
      diffs.push({
        kind: 'create',
        nodeId: id,
        nodeType: next.type,
        after: structuredClone(next),
        changedFields: Object.keys(next),
      })
      continue
    }
    if (previous && !next) {
      diffs.push({
        kind: 'delete',
        nodeId: id,
        nodeType: previous.type,
        before: structuredClone(previous),
        changedFields: Object.keys(previous),
      })
      continue
    }
    if (!(previous && next)) continue
    const fields = changedFields(previous, next)
    if (fields.length === 0) continue
    const moved = fields.some((field) =>
      ['position', 'rotation', 'parentId', 'wallId', 'wallT', 'side'].includes(field),
    )
    diffs.push({
      kind: moved ? 'move' : 'update',
      nodeId: id,
      nodeType: next.type,
      before: structuredClone(previous),
      after: structuredClone(next),
      changedFields: fields,
    })
  }
  return diffs
}

function validateGraph(graph: SceneGraph): ScenePlanIssue[] {
  const issues: ScenePlanIssue[] = []
  const nodes = asMutableNodes(graph)
  for (const [id, node] of Object.entries(nodes)) {
    const parsed = safeParseRegisteredNode(node, { nodes })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          severity: 'error',
          code: 'schema',
          message: issue.message,
          nodeIds: [id],
        })
      }
    }
    const parentId = typeof node.parentId === 'string' ? node.parentId : null
    if (parentId && !nodes[parentId]) {
      issues.push({
        severity: 'error',
        code: 'missing-parent',
        message: `节点 "${id}" 引用了不存在的父节点 "${parentId}"。`,
        nodeIds: [id, parentId],
      })
    }
  }
  for (const rootId of graph.rootNodeIds) {
    if (!nodes[rootId]) {
      issues.push({
        severity: 'error',
        code: 'missing-root',
        message: `根节点 "${rootId}" 不存在。`,
        nodeIds: [rootId],
      })
    }
  }
  return issues
}

function parseFailurePlan(input: unknown): ScenePlan {
  const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  return {
    id: typeof value.id === 'string' ? value.id : 'invalid-plan',
    sceneId: typeof value.sceneId === 'string' ? value.sceneId : '',
    baseVersion:
      typeof value.baseVersion === 'number' && Number.isInteger(value.baseVersion)
        ? value.baseVersion
        : -1,
    operations: [],
  }
}

export async function prepareScenePlan(
  input: unknown,
  before: ScenePlanSnapshot,
): Promise<PreparedScenePlan> {
  const parsed = ScenePlanSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      plan: parseFailurePlan(input),
      before,
      after: null,
      diffs: [],
      issues: parsed.error.issues.map((issue) => ({
        severity: 'error',
        code: 'invalid-plan-schema',
        message: issue.message,
      })),
    }
  }

  const plan = parsed.data as ScenePlan
  const issues: ScenePlanIssue[] = []
  if (plan.sceneId !== before.sceneId) {
    issues.push({
      severity: 'error',
      code: 'scene-mismatch',
      message: `计划绑定场景 "${plan.sceneId}"，当前场景为 "${before.sceneId}"。`,
    })
  }
  if (plan.baseVersion !== before.version) {
    issues.push({
      severity: 'error',
      code: 'version-conflict',
      message: `计划基准版本为 ${plan.baseVersion}，当前场景版本为 ${before.version}。`,
    })
  }
  if (issues.length > 0) {
    return { ok: false, plan, before, after: null, diffs: [], issues }
  }

  const afterGraph = cloneGraph(before.graph)
  plan.operations.forEach((operation, index) => {
    applyOperation(afterGraph, operation, index, issues)
  })
  issues.push(...validateGraph(afterGraph))
  const after: ScenePlanSnapshot = {
    sceneId: before.sceneId,
    version: before.version + 1,
    graph: afterGraph,
  }
  const diffs = buildDiffs(before.graph, afterGraph)
  const context = { plan, before, after, diffs }
  for (const validator of getScenePlanValidators()) {
    const validatorIssues = await validator.validate(context)
    issues.push(...validatorIssues.map((issue) => ({ ...issue, validatorId: validator.id })))
  }
  for (const warning of plan.warnings ?? []) {
    issues.push({ severity: 'warning', code: 'plan-warning', message: warning })
  }
  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    plan,
    before,
    after,
    diffs,
    issues,
  }
}
