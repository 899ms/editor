import { randomUUID } from 'node:crypto'
import {
  type PreparedScenePlan,
  type ScenePlan,
  ScenePlanSchema,
} from '@pascal-app/core/scene-plan'
import type { SceneOperations } from '@pascal-app/mcp/operations'
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
const GLN_NODE_PREFIX = 'gln:'

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
    if (request.kind === 'reconstruct-home') return
    for (const operation of plan.operations) {
      const type =
        operation.op === 'create'
          ? operation.node.type
          : Object.values(current.graph.nodes).find((node) => node.id === operation.id)?.type
      if (!type?.startsWith(GLN_NODE_PREFIX)) {
        throw new TaskFailure('task_scope_violation', '光冷暖配置和修复任务不能修改住宅结构。')
      }
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
      validateTaskPolicy(task.request, parsed.data, current)
      update(task, { progress: 90 })
      const preview = await options.operations.prepareScenePlan(parsed.data)
      if (task.status !== 'running') return
      if (!preview.ok) {
        throw new TaskFailure('scene_plan_validation_failed', '场景计划未通过硬校验。')
      }
      finish(task, 'succeeded', {
        plan: parsed.data,
        preview,
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
