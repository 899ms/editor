import { afterEach, expect, test } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { SiteNode } from '@pascal-app/core/schema'
import { createSceneOperations } from '@pascal-app/mcp/operations'
import { SqliteSceneStore } from '@pascal-app/mcp/storage'
import type { NextRequest } from 'next/server'
import {
  DELETE as cancelTask,
  GET as getTask,
} from '../../app/api/scenes/[id]/codex-tasks/[taskId]/route'
import { POST as postTask } from '../../app/api/scenes/[id]/codex-tasks/route'
import { createCodexTaskManager } from './codex-task-manager'
import { __setCodexTaskManagerForTests } from './codex-task-server'
import { createDeterministicCodexAdapter } from './deterministic-adapter'

const roots: string[] = []
const stores: SqliteSceneStore[] = []
const sceneId = 'scene-codex-route'

afterEach(async () => {
  __setCodexTaskManagerForTests(null)
  for (const store of stores.splice(0)) store.close()
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

test('the HTTP seam accepts only structured tasks and exposes safe progress payloads', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gln-codex-route-'))
  roots.push(root)
  const store = new SqliteSceneStore({ databasePath: path.join(root, 'tasks.db') })
  stores.push(store)
  const site = SiteNode.parse({ id: 'site_codex_route', children: [] })
  await store.save({
    id: sceneId,
    name: '住宅',
    graph: { nodes: { [site.id]: site }, rootNodeIds: [site.id] },
  })
  const manager = createCodexTaskManager({
    operations: createSceneOperations({ store }),
    adapter: createDeterministicCodexAdapter({
      id: 'route-plan',
      sceneId,
      baseVersion: 1,
      operations: [{ op: 'update', id: site.id, data: { name: '路线住宅' } }],
    }),
    createId: () => 'task-route',
  })
  __setCodexTaskManagerForTests(manager)

  const rejected = await postTask(
    request('/api/scenes/scene-codex-route/codex-tasks', 'POST', {
      kind: 'reconstruct-home',
      brief: '重建住宅',
      command: 'cmd /c whoami',
    }),
    { params: Promise.resolve({ id: sceneId }) },
  )
  expect(rejected.status).toBe(400)

  const accepted = await postTask(
    request('/api/scenes/scene-codex-route/codex-tasks', 'POST', {
      kind: 'reconstruct-home',
      brief: '重建住宅',
    }),
    { params: Promise.resolve({ id: sceneId }) },
  )
  expect(accepted.status).toBe(202)
  const submitted = (await accepted.json()) as Record<string, unknown>
  expect(submitted.id).toBe('task-route')
  expect(submitted.brief).toBeUndefined()
  expect(submitted.source).toBeUndefined()

  await manager.waitForTerminal('task-route')
  const status = await getTask(request('/api/scenes/scene-codex-route/codex-tasks/task-route'), {
    params: Promise.resolve({ id: sceneId, taskId: 'task-route' }),
  })
  const payload = (await status.json()) as {
    status: string
    plan: unknown
    preview: { diffs: Array<Record<string, unknown>> } & Record<string, unknown>
  }
  expect(payload.status).toBe('succeeded')
  expect(payload.plan).toBeTruthy()
  expect(payload.preview.before).toBeUndefined()
  expect(payload.preview.after).toBeUndefined()
  expect(payload.preview.diffs[0]?.before).toBeUndefined()
  expect(payload.preview.diffs[0]?.after).toBeUndefined()

  const cancelled = await cancelTask(
    request('/api/scenes/scene-codex-route/codex-tasks/task-route', 'DELETE'),
    { params: Promise.resolve({ id: sceneId, taskId: 'task-route' }) },
  )
  expect(cancelled.status).toBe(200)
})

function request(pathname: string, method = 'GET', body?: unknown): NextRequest {
  return new Request(`http://127.0.0.1:3003${pathname}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as NextRequest
}
