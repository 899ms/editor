import { afterEach, expect, test } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { ScenePlan } from '@pascal-app/core/scene-plan'
import { BuildingNode, LevelNode, SiteNode, WallNode, ZoneNode } from '@pascal-app/core/schema'
import { createSceneOperations } from '@pascal-app/mcp/operations'
import { SqliteSceneStore } from '@pascal-app/mcp/storage'
import { type CodexScenePlanAdapter, createCodexTaskManager } from './codex-task-manager'
import { createDeterministicCodexAdapter } from './deterministic-adapter'
import { createGlnConfigurationTestGraph } from './gln-configuration-test-fixtures'
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

async function seededResidentialOperations() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gln-codex-residential-task-'))
  roots.push(root)
  const store = new SqliteSceneStore({ databasePath: path.join(root, 'tasks.db') })
  stores.push(store)
  const site = SiteNode.parse({
    id: 'site_codex_residential',
    name: '住宅',
    children: ['building_codex_residential'],
  })
  const building = BuildingNode.parse({
    id: 'building_codex_residential',
    parentId: site.id,
    children: ['level_codex_residential'],
  })
  const level = LevelNode.parse({
    id: 'level_codex_residential',
    parentId: building.id,
    children: [],
  })
  await store.save({
    id: sceneId,
    name: '住宅',
    graph: {
      nodes: {
        [site.id]: site,
        [building.id]: building,
        [level.id]: level,
      },
      rootNodeIds: [site.id],
    },
  })
  return createSceneOperations({ store })
}

function completeResidentialPlan(confidence: 'high' | 'low' = 'high'): ScenePlan {
  const walls = [
    ['wall_codex_north', [0, 0], [4, 0]],
    ['wall_codex_east', [4, 0], [4, 3]],
    ['wall_codex_south', [4, 3], [0, 3]],
    ['wall_codex_west', [0, 3], [0, 0]],
  ] as const
  return {
    id: 'plan-residential',
    sceneId,
    baseVersion: 1,
    operations: [
      ...walls.map(([id, start, end]) => ({
        op: 'create' as const,
        parentId: 'level_codex_residential',
        node: WallNode.parse({
          id,
          parentId: 'level_codex_residential',
          start,
          end,
          height: 2.8,
          thickness: 0.2,
          frontSide: 'interior',
          backSide: 'exterior',
          metadata: { source: 'codex-residential', confidence },
        }),
      })),
      {
        op: 'create',
        parentId: 'level_codex_residential',
        node: ZoneNode.parse({
          id: 'zone_codex_living',
          name: '客厅',
          parentId: 'level_codex_residential',
          polygon: [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
          ],
          autoFromWalls: true,
          boundaryWallIds: walls.map(([id]) => id),
          metadata: { source: 'codex-residential', confidence },
        }),
      },
    ],
  }
}

afterEach(async () => {
  for (const store of stores.splice(0)) store.close()
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

test('runs a whitelisted task and returns a validated ScenePlan preview without committing it', async () => {
  const operations = await seededResidentialOperations()
  const plan = completeResidentialPlan()
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
  expect(completed.residentialReport?.status).toBe('draft-ready')
  expect(completed.residentialReport?.minimumStructure.satisfied).toBe(true)
  expect((await operations.loadStoredScene(sceneId))?.version).toBe(1)
})

test('keeps low-confidence residential nodes in a review queue', async () => {
  const operations = await seededResidentialOperations()
  const manager = createCodexTaskManager({
    operations,
    adapter: createDeterministicCodexAdapter(completeResidentialPlan('low')),
  })

  const task = manager.submit({
    kind: 'reconstruct-home',
    sceneId,
    brief: '按资料生成住宅并标出不确定构件。',
  })
  const completed = await manager.waitForTerminal(task.id)

  expect(completed.status).toBe('succeeded')
  expect(completed.residentialReport?.reviewItems).toHaveLength(5)
  expect(
    completed.residentialReport?.reviewItems.every((item) => item.reason === 'low-confidence'),
  ).toBe(true)
})

test('rejects a residential draft that lacks the minimum editable structure', async () => {
  const operations = await seededResidentialOperations()
  const manager = createCodexTaskManager({
    operations,
    adapter: createDeterministicCodexAdapter({
      id: 'incomplete-residential',
      sceneId,
      baseVersion: 1,
      operations: [
        {
          op: 'update',
          id: 'level_codex_residential',
          data: {
            name: '只有楼层',
            metadata: { source: 'codex-residential', confidence: 'high' },
          },
        },
      ],
    }),
  })

  const task = manager.submit({
    kind: 'reconstruct-home',
    sceneId,
    brief: '生成住宅',
  })
  const completed = await manager.waitForTerminal(task.id)

  expect(completed.status).toBe('failed')
  expect(completed.error?.code).toBe('residential_minimum_not_met')
  expect(completed.plan).toBeNull()
  expect(completed.preview).toBeNull()
  expect(completed.residentialReport?.minimumStructure.missing).toEqual([
    'wall',
    'zone',
    'indoor-outdoor-relation',
  ])
})

test('generates one complete GLN system by default and returns a validated configuration report', async () => {
  const fixture = createGlnConfigurationTestGraph('manager')
  let preparedPlan: ScenePlan | null = null
  const operations = {
    async loadStoredScene(id: string) {
      return {
        id,
        name: '住宅',
        version: 1,
        graph: fixture.residentialGraph,
      }
    },
    async prepareScenePlan(scenePlan: ScenePlan) {
      preparedPlan = scenePlan
      return {
        ok: true,
        plan: scenePlan,
        before: { sceneId, version: 1, graph: fixture.residentialGraph },
        after: { sceneId, version: 2, graph: fixture.graph },
        diffs: fixture.glnNodes.map((node) => ({
          kind: 'create' as const,
          nodeId: node.id,
          nodeType: node.type,
          after: node,
          changedFields: Object.keys(node),
        })),
        issues: [],
      }
    },
  }
  const rawPlan: ScenePlan = {
    id: 'plan-configure-gln',
    sceneId,
    baseVersion: 1,
    operations: fixture.glnNodes.map((node) => ({
      op: 'create',
      ...(node.parentId ? { parentId: node.parentId } : {}),
      node,
    })),
  }
  const manager = createCodexTaskManager({
    operations: operations as never,
    adapter: createDeterministicCodexAdapter(rawPlan),
  })

  const task = manager.submit({
    kind: 'configure-gln',
    sceneId,
    brief: '为现有住宅配置一套光冷暖系统',
  })
  const completed = await manager.waitForTerminal(task.id)

  expect(completed.status).toBe('succeeded')
  expect(completed.glnConfigurationReport).toMatchObject({
    status: 'ready',
    systems: { before: 0, requested: 1, expected: 1, after: 1 },
    completenessIssues: [],
    reviewItems: [],
  })
  expect(preparedPlan?.operations).toHaveLength(8)
  expect(
    preparedPlan?.operations.find(
      (operation) => operation.op === 'create' && operation.node.type === 'gln:outdoor-unit',
    ),
  ).toMatchObject({
    node: { presetId: 'generic-standard', specificationSource: 'generic-placeholder' },
  })
})

test('requires a valid residence and protects locked GLN nodes before preview', async () => {
  const invalidOperations = await seededOperations()
  let generated = false
  const invalidManager = createCodexTaskManager({
    operations: invalidOperations,
    adapter: {
      async generate() {
        generated = true
        return {}
      },
    },
  })
  const invalid = invalidManager.submit({
    kind: 'configure-gln',
    sceneId,
    brief: '配置系统',
  })
  expect((await invalidManager.waitForTerminal(invalid.id)).error?.code).toBe(
    'gln_configuration_requires_residence',
  )
  expect(generated).toBe(false)

  const fixture = createGlnConfigurationTestGraph('locked')
  const panel = fixture.graph.nodes[fixture.ids.panel] as unknown as {
    metadata: Record<string, unknown>
  }
  panel.metadata = { ...panel.metadata, glnLocked: true }
  let prepared = false
  const lockedManager = createCodexTaskManager({
    operations: {
      async loadStoredScene(id: string) {
        return { id, name: '住宅', version: 1, graph: fixture.graph }
      },
      async prepareScenePlan() {
        prepared = true
        throw new Error('should not prepare')
      },
    } as never,
    adapter: createDeterministicCodexAdapter({
      id: 'plan-locked-gln',
      sceneId,
      baseVersion: 1,
      operations: [{ op: 'update', id: fixture.ids.panel, data: { position: [8, 1.25, 0.16] } }],
    }),
  })
  const locked = lockedManager.submit({
    kind: 'configure-gln',
    sceneId,
    brief: '调整面板',
  })
  expect((await lockedManager.waitForTerminal(locked.id)).error?.code).toBe(
    'gln_configuration_locked_node',
  )
  expect(prepared).toBe(false)
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
  expect(
    CodexTaskRequestSchema.safeParse({
      kind: 'configure-gln',
      sceneId,
      brief: '配置系统',
      glnConfiguration: { targetSystemCount: 9 },
    }).success,
  ).toBe(false)
  expect(
    CodexTaskRequestSchema.safeParse({
      kind: 'repair-gln',
      sceneId,
      brief: '修复系统',
      glnConfiguration: { targetSystemCount: 2 },
    }).success,
  ).toBe(false)
})

test('uses a deterministic adapter without calling an online model', async () => {
  const operations = await seededResidentialOperations()
  const plan = completeResidentialPlan()
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
    kind: 'repair-gln',
    sceneId,
    brief: '修复系统',
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
