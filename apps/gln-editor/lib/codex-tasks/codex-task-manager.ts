import { randomUUID } from 'node:crypto'
import {
  type PreparedScenePlan,
  type ScenePlan,
  ScenePlanSchema,
} from '@pascal-app/core/scene-plan'
import type { SceneOperations } from '@pascal-app/mcp/operations'
import {
  analyzeGlnConfiguration,
  type GlnConfigurationReport,
  normalizeGlnConfigurationScenePlan,
  onlyReviewableGlnPlacementErrors,
  validateGlnConfigurationScope,
} from './gln-configuration-scene-plan'
import {
  analyzeResidentialScenePlan,
  normalizeResidentialScenePlan,
  type ResidentialDraftReport,
  validateResidentialPlanScope,
} from './residential-scene-plan'
import { type CodexTaskKind, type CodexTaskRequest, CodexTaskRequestSchema } from './schema'

export type CodexTaskStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'timed_out'

export type CodexTaskError = {
  code: string
  message: string
}

export type CodexTaskRecord = {
  id: string
  sceneId: string
  kind: CodexTaskKind
  status: CodexTaskStatus
  progress: number
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  plan: ScenePlan | null
  preview: PreparedScenePlan | null
  residentialReport: ResidentialDraftReport | null
  glnConfigurationReport: GlnConfigurationReport | null
  error: CodexTaskError | null
}

export type CodexScenePlanAdapterInput = {
  taskId: string
  request: CodexTaskRequest
  snapshot: NonNullable<Awaited<ReturnType<SceneOperations['loadStoredScene']>>>
  signal: AbortSignal
  reportProgress(progress: number): void
}

export interface CodexScenePlanAdapter {
  generate(input: CodexScenePlanAdapterInput): Promise<unknown>
}

export type CreateCodexTaskManagerOptions = {
  operations: SceneOperations
  adapter: CodexScenePlanAdapter
  timeoutMs?: number
  now?: () => Date
  createId?: () => string
}

export interface CodexTaskManager {
  submit(input: unknown): CodexTaskRecord
  get(taskId: string): CodexTaskRecord | null
  list(sceneId?: string): CodexTaskRecord[]
  cancel(taskId: string): CodexTaskRecord | null
  waitForTerminal(taskId: string, timeoutMs?: number): Promise<CodexTaskRecord>
}

type InternalTask = CodexTaskRecord & {
  request: CodexTaskRequest
  controller: AbortController | null
  timeoutHandle: ReturnType<typeof setTimeout> | null
}

const TERMINAL_STATUSES = new Set<CodexTaskStatus>([
  'succeeded',
  'failed',
  'cancelled',
  'timed_out',
])
class TaskFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function createCodexTaskManager(options: CreateCodexTaskManagerOptions): CodexTaskManager {
  const tasks = new Map<string, InternalTask>()
  const queue: string[] = []
  const timeoutMs = options.timeoutMs ?? 120_000
  const now = options.now ?? (() => new Date())
  const createId = options.createId ?? randomUUID
  let draining = false

  const timestamp = () => now().toISOString()

  const snapshot = (task: InternalTask): CodexTaskRecord => ({
    id: task.id,
    sceneId: task.sceneId,
    kind: task.kind,
    status: task.status,
    progress: task.progress,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    plan: task.plan,
    preview: task.preview,
    residentialReport: task.residentialReport,
    glnConfigurationReport: task.glnConfigurationReport,
    error: task.error,
  })

  const update = (task: InternalTask, patch: Partial<InternalTask>) => {
    Object.assign(task, patch, { updatedAt: timestamp() })
  }

  const finish = (
    task: InternalTask,
    status: Extract<CodexTaskStatus, 'succeeded' | 'failed' | 'cancelled' | 'timed_out'>,
    patch: Partial<InternalTask> = {},
  ) => {
    if (task.timeoutHandle) clearTimeout(task.timeoutHandle)
    update(task, {
      ...patch,
      status,
      progress: status === 'succeeded' ? 100 : task.progress,
      completedAt: timestamp(),
      controller: null,
      timeoutHandle: null,
    })
  }

  const validateTaskPolicy = (
    request: CodexTaskRequest,
    plan: ScenePlan,
    current: NonNullable<Awaited<ReturnType<SceneOperations['loadStoredScene']>>>,
  ) => {
    if (plan.sceneId !== current.id || plan.baseVersion !== current.version) {
      throw new TaskFailure('scene_version_mismatch', '场景计划与当前场景版本不一致。')
    }
    if (request.kind === 'reconstruct-home') {
      const scope = validateResidentialPlanScope(plan, current.graph)
      if (!scope.ok) throw new TaskFailure(scope.code, scope.message)
      return
    }
    const scope = validateGlnConfigurationScope(plan, current.graph, {
      protectExistingIds: request.kind === 'configure-gln',
    })
    if (!scope.ok) {
      if (request.kind === 'repair-gln' && scope.code === 'gln_configuration_scope_violation') {
        throw new TaskFailure('task_scope_violation', '光冷暖配置和修复任务不能修改住宅结构。')
      }
      throw new TaskFailure(scope.code, scope.message)
    }
  }

  const run = async (task: InternalTask) => {
    if (task.status === 'cancelled') return
    const controller = new AbortController()
    update(task, {
      status: 'running',
      progress: 5,
      startedAt: timestamp(),
      controller,
    })
    task.timeoutHandle = setTimeout(() => {
      if (task.status !== 'running') return
      controller.abort()
      finish(task, 'timed_out', {
        error: { code: 'task_timed_out', message: '本地 Codex 任务超时。' },
      })
    }, timeoutMs)

    try {
      const current = await options.operations.loadStoredScene(task.sceneId)
      if (!current) throw new TaskFailure('scene_not_found', '找不到目标场景。')
      if (task.request.kind === 'configure-gln') {
        const residential = analyzeResidentialScenePlan({
          graph: current.graph,
          touchedNodeIds: [],
        })
        if (!residential.minimumStructure.satisfied) {
          throw new TaskFailure(
            'gln_configuration_requires_residence',
            '请先创建满足楼层、围护墙、空间和室内外关系门槛的住宅。',
          )
        }
      }
      if (task.status !== 'running') return
      update(task, { progress: 15 })
      const rawPlan = await options.adapter.generate({
        taskId: task.id,
        request: task.request,
        snapshot: current,
        signal: controller.signal,
        reportProgress(progress) {
          if (task.status !== 'running') return
          update(task, { progress: Math.min(85, Math.max(15, Math.round(progress))) })
        },
      })
      if (task.status !== 'running') return
      const parsed = ScenePlanSchema.safeParse(rawPlan)
      if (!parsed.success) {
        throw new TaskFailure('invalid_scene_plan', 'Codex 返回的场景计划格式无效。')
      }
      let scenePlan = parsed.data
      if (task.request.kind === 'reconstruct-home') {
        try {
          scenePlan = normalizeResidentialScenePlan(parsed.data)
        } catch {
          throw new TaskFailure(
            'invalid_residential_node',
            '住宅草案包含不符合 Pascal 建筑节点 schema 的数据。',
          )
        }
      } else if (task.request.kind === 'configure-gln') {
        try {
          scenePlan = normalizeGlnConfigurationScenePlan(parsed.data)
        } catch {
          throw new TaskFailure(
            'invalid_gln_configuration_node',
            '光冷暖配置包含不符合现有 GLN 节点 schema 的数据。',
          )
        }
      }
      validateTaskPolicy(task.request, scenePlan, current)
      update(task, { progress: 90 })
      const preview = await options.operations.prepareScenePlan(scenePlan)
      if (task.status !== 'running') return
      const glnConfigurationReport =
        task.request.kind === 'configure-gln' && preview.after
          ? analyzeGlnConfiguration({
              beforeGraph: current.graph,
              afterGraph: preview.after.graph,
              request: {
                targetSystemCount: task.request.glnConfiguration?.targetSystemCount ?? 1,
              },
              touchedNodeIds: scenePlan.operations.map((operation) =>
                operation.op === 'create' ? operation.node.id : operation.id,
              ),
              previewIssues: preview.issues,
            })
          : null
      if (!preview.ok) {
        if (
          glnConfigurationReport?.status === 'needs-review' &&
          onlyReviewableGlnPlacementErrors(preview.issues)
        ) {
          finish(task, 'succeeded', {
            plan: scenePlan,
            preview,
            glnConfigurationReport,
            error: null,
          })
          return
        }
        throw new TaskFailure('scene_plan_validation_failed', '场景计划未通过硬校验。')
      }
      const residentialReport =
        task.request.kind === 'reconstruct-home' && preview.after
          ? analyzeResidentialScenePlan({
              graph: preview.after.graph,
              touchedNodeIds: scenePlan.operations.map((operation) =>
                operation.op === 'create' ? operation.node.id : operation.id,
              ),
            })
          : null
      if (residentialReport?.status === 'report-only') {
        finish(task, 'failed', {
          plan: null,
          preview: null,
          residentialReport,
          error: {
            code: 'residential_minimum_not_met',
            message: '住宅草案缺少楼层、围护墙、空间或明确的室内外关系。',
          },
        })
        return
      }
      if (glnConfigurationReport?.status === 'report-only') {
        finish(task, 'failed', {
          plan: null,
          preview: null,
          glnConfigurationReport,
          error: {
            code: 'gln_configuration_incomplete',
            message: '光冷暖配置未满足目标系统数量、设备唯一性或完整闭环要求。',
          },
        })
        return
      }
      finish(task, 'succeeded', {
        plan: scenePlan,
        preview,
        residentialReport,
        glnConfigurationReport,
        error: null,
      })
    } catch (error) {
      if (task.status !== 'running') return
      if (controller.signal.aborted) {
        finish(task, 'cancelled', {
          error: { code: 'task_cancelled', message: '任务已取消。' },
        })
        return
      }
      const failure =
        error instanceof TaskFailure
          ? { code: error.code, message: error.message }
          : { code: 'codex_task_failed', message: '本地 Codex 任务失败。' }
      finish(task, 'failed', { error: failure })
    }
  }

  const drain = async () => {
    if (draining) return
    draining = true
    try {
      while (queue.length > 0) {
        const id = queue.shift()
        const task = id ? tasks.get(id) : null
        if (task && task.status === 'queued') await run(task)
      }
    } finally {
      draining = false
      if (queue.length > 0) queueMicrotask(() => void drain())
    }
  }

  return {
    submit(input) {
      const request = CodexTaskRequestSchema.parse(input)
      const createdAt = timestamp()
      const task: InternalTask = {
        id: createId(),
        sceneId: request.sceneId,
        kind: request.kind,
        status: 'queued',
        progress: 0,
        createdAt,
        updatedAt: createdAt,
        startedAt: null,
        completedAt: null,
        plan: null,
        preview: null,
        residentialReport: null,
        glnConfigurationReport: null,
        error: null,
        request,
        controller: null,
        timeoutHandle: null,
      }
      tasks.set(task.id, task)
      queue.push(task.id)
      queueMicrotask(() => void drain())
      return snapshot(task)
    },
    get(taskId) {
      const task = tasks.get(taskId)
      return task ? snapshot(task) : null
    },
    list(sceneId) {
      return [...tasks.values()]
        .filter((task) => !sceneId || task.sceneId === sceneId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(snapshot)
    },
    cancel(taskId) {
      const task = tasks.get(taskId)
      if (!task) return null
      if (TERMINAL_STATUSES.has(task.status)) return snapshot(task)
      task.controller?.abort()
      finish(task, 'cancelled', {
        error: { code: 'task_cancelled', message: '任务已取消。' },
      })
      return snapshot(task)
    },
    async waitForTerminal(taskId, waitTimeoutMs = 5_000) {
      const started = Date.now()
      while (Date.now() - started < waitTimeoutMs) {
        const task = tasks.get(taskId)
        if (!task) throw new Error(`codex_task_not_found: ${taskId}`)
        if (TERMINAL_STATUSES.has(task.status)) return snapshot(task)
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
      throw new Error(`codex_task_wait_timed_out: ${taskId}`)
    },
  }
}
