import type { SceneGraph } from '../utils/clone-scene-graph'

export type ScenePlanCreateOperation = {
  op: 'create'
  node: { id: string; type: string } & Record<string, unknown>
  parentId?: string
}

export type ScenePlanUpdateOperation = {
  op: 'update'
  id: string
  data: Record<string, unknown>
}

export type ScenePlanDeleteOperation = {
  op: 'delete'
  id: string
  cascade?: boolean
}

export type ScenePlanOperation =
  | ScenePlanCreateOperation
  | ScenePlanUpdateOperation
  | ScenePlanDeleteOperation

export type ScenePlan = {
  id: string
  sceneId: string
  baseVersion: number
  operations: ScenePlanOperation[]
  warnings?: string[]
}

export type ScenePlanSnapshot = {
  sceneId: string
  version: number
  graph: SceneGraph
}

export type ScenePlanIssue = {
  severity: 'error' | 'warning'
  code: string
  message: string
  nodeIds?: string[]
  operationIndex?: number
  validatorId?: string
}

export type ScenePlanDiffKind = 'create' | 'move' | 'update' | 'delete'

export type ScenePlanDiff = {
  kind: ScenePlanDiffKind
  nodeId: string
  nodeType: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  changedFields: string[]
}

export type ScenePlanValidationContext = {
  plan: ScenePlan
  before: ScenePlanSnapshot
  after: ScenePlanSnapshot
  diffs: ScenePlanDiff[]
}

export type ScenePlanValidator = (
  context: ScenePlanValidationContext,
) => ScenePlanIssue[] | Promise<ScenePlanIssue[]>

export type ScenePlanValidatorDefinition = {
  id: string
  validate: ScenePlanValidator
}

export type PreparedScenePlan = {
  ok: boolean
  plan: ScenePlan
  before: ScenePlanSnapshot
  after: ScenePlanSnapshot | null
  diffs: ScenePlanDiff[]
  issues: ScenePlanIssue[]
}
