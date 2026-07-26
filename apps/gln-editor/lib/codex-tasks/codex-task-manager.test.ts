import { afterEach, expect, test } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { ScenePlan } from '@pascal-app/core/scene-plan'
import { SiteNode } from '@pascal-app/core/schema'
import { createSceneOperations } from '@pascal-app/mcp/operations'
import { SqliteSceneStore } from '@pascal-app/mcp/storage'
import { type CodexScenePlanAdapter, createCodexTaskManager } from './codex-task-manager'
import { createDeterministicCodexAdapter } from './deterministic-adapter'
import { CodexTaskRequestSchema } from './schema'

const sceneId = 'scene-codex-task'
const roots: string[] = []
const stores: SqliteSceneStore[] = []

async function seededOperations() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gln-codex-task-'))
  roots.push(root)
  const store = new SqliteSceneStore({ databasePath: path.join(root, 'tasks.db') })
  stores.push(store)
  const site = SiteNode.parse({ id: 'site_codex_task', name: '住宅', children: [] })
  await store.save({
    id: sceneId,
    name: '住宅',
    graph: {
      nodes: { [site.id]: site },
      rootNodeIds: [site.id],
    },
  })
  return createSceneOperations({ store })
}

afterEach(async () => {
  for (const store of stores.splice(0)) store.close()
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

test('runs a whitelisted task and returns a validated ScenePlan preview without committing it', async () => {
  const operations = await seededOperations()
  const plan: ScenePlan = {
    id: 'plan-1',
    sceneId,
    baseVersion: 1,
    operations: [
      {
        op: 'update',
        id: 'site_codex_task',
        data: { name: '重建住宅' },
      },
    ],
  }
  const adapter: CodexScenePlanAdapter = {
    async generate() {
      return plan
    },
  }
  const manager = createCodexTaskManager({ operations, adapter })

  const task = manager.submit({
    kind: 'reconstruct-home',
    sceneId,
    brief: '按现有住宅结构生成可编辑节点。',
  })
  const completed = await manager.waitForTerminal(task.id)

  expect(completed.status).toBe('succeeded')
  expect(completed.progress).toBe(100)
  expect(completed.plan).toEqual(plan)
  expect(completed.preview?.ok).toBe(true)
  expect((await operations.loadStoredScene(sceneId))?.version).toBe(1)
})

test('rejects browser-supplied commands, API keys, and unauthorized original uploads', () => {
  expect(
    CodexTaskRequestSchema.safeParse({
      kind: 'configure-gln',
      sceneId,
      brief: '配置系统',
      command: 'powershell -Command whoami',
    }).success,
  ).toBe(false)
  expect(
    CodexTaskRequestSchema.safeParse({
      kind: 'configure-gln',
      sceneId,
      brief: '配置系统',
      apiKey: 'sk-browser-secret',
    }).success,
  ).toBe(false)
  expect(
    CodexTaskRequestSchema.safeParse({
      kind: 'reconstruct-home',
      sceneId,
      brief: '重建住宅',
      source: {
        kind: 'ifc',
        summary: '本地解析摘要',
        uploadOriginal: true,
      },
    }).success,
  ).toBe(false)
})

test('uses a deterministic adapter without calling an online model', async () => {
  const operations = await seededOperations()
  const plan: ScenePlan = {
    id: 'deterministic-plan',
    sceneId,
    baseVersion: 1,
    operations: [
      {
        op: 'update',
        id: 'site_codex_task',
        data: { name: '确定性住宅' },
      },
    ],
  }
  const manager = createCodexTaskManager({
    operations,
    adapter: createDeterministicCodexAdapter(plan),
    createId: () => 'task-deterministic',
  })

  const task = manager.submit({
    kind: 'reconstruct-home',
    sceneId,
    brief: '确定性测试',
  })

  expect(task.id).toBe('task-deterministic')
  expect((await manager.waitForTerminal(task.id)).plan).toEqual(plan)
})

test('exposes cancellation and timeout as terminal states', async () => {
  const operations = await seededOperations()
  const waitingAdapter: CodexScenePlanAdapter = {
    generate({ signal }) {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      })
    },
  }
  const cancelledManager = createCodexTaskManager({
    operations,
    adapter: waitingAdapter,
  })
  const cancellable = cancelledManager.submit({
    kind: 'repair-gln',
    sceneId,
    brief: '修复系统',
  })
  await waitForStatus(cancelledManager, cancellable.id, 'running')

  expect(cancelledManager.cancel(cancellable.id)?.status).toBe('cancelled')
  expect(cancelledManager.get(cancellable.id)?.error).toEqual({
    code: 'task_cancelled',
    message: '任务已取消。',
  })

  const timeoutManager = createCodexTaskManager({
    operations,
    adapter: waitingAdapter,
    timeoutMs: 10,
  })
  const timed = timeoutManager.submit({
    kind: 'repair-gln',
    sceneId,
    brief: '超时测试',
  })
  const timedOut = await timeoutManager.waitForTerminal(timed.id)

  expect(timedOut.status).toBe('timed_out')
  expect(timedOut.error?.code).toBe('task_timed_out')
})

test('fails safely when Codex returns invalid JSON or a GLN task edits residential structure', async () => {
  const operations = await seededOperations()
  const invalidManager = createCodexTaskManager({
    operations,
    adapter: createDeterministicCodexAdapter({ arbitrary: 'not-a-plan' }),
  })
  const invalid = invalidManager.submit({
    kind: 'configure-gln',
    sceneId,
    brief: '配置系统',
  })

  expect((await invalidManager.waitForTerminal(invalid.id)).error).toEqual({
    code: 'invalid_scene_plan',
    message: 'Codex 返回的场景计划格式无效。',
  })

  const structuralManager = createCodexTaskManager({
    operations,
    adapter: createDeterministicCodexAdapter({
      id: 'structural-plan',
      sceneId,
      baseVersion: 1,
      operations: [
        {
          op: 'update',
          id: 'site_codex_task',
          data: { name: '越权修改' },
        },
      ],
    }),
  })
  const structural = structuralManager.submit({
    kind: 'repair-gln',
    sceneId,
    brief: '仅修复光冷暖系统',
  })

  expect((await structuralManager.waitForTerminal(structural.id)).error).toEqual({
    code: 'task_scope_violation',
    message: '光冷暖配置和修复任务不能修改住宅结构。',
  })
})

async function waitForStatus(
  manager: ReturnType<typeof createCodexTaskManager>,
  taskId: string,
  status: string,
) {
  const started = Date.now()
  while (Date.now() - started < 1_000) {
    if (manager.get(taskId)?.status === status) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`task did not reach ${status}`)
}
