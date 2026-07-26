import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { BuildingNode, LevelNode, SiteNode } from '@pascal-app/core/schema'
import { SceneBridge } from '../bridge/scene-bridge'
import { SqliteSceneStore } from '../storage/sqlite-scene-store'
import { createSceneOperations } from './scene-operations'

describe('SceneOperations ScenePlan path', () => {
  let rootDir: string
  let store: SqliteSceneStore

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pascal-scene-plan-'))
    store = new SqliteSceneStore({ databasePath: path.join(rootDir, 'scene-plan.db') })
  })

  afterEach(async () => {
    store.close()
    await fs.rm(rootDir, { recursive: true, force: true })
  })

  test('validates, checkpoints, commits once, and keeps both revisions recoverable', async () => {
    const site = SiteNode.parse({ id: 'site_plan', children: ['building_plan'] })
    const building = BuildingNode.parse({
      id: 'building_plan',
      parentId: site.id,
      children: ['level_plan'],
    })
    const level = LevelNode.parse({
      id: 'level_plan',
      parentId: building.id,
      children: [],
      name: '提交前',
    })
    const initial = await store.save({
      id: 'scene-plan-home',
      name: '计划住宅',
      graph: {
        nodes: { [site.id]: site, [building.id]: building, [level.id]: level },
        rootNodeIds: [site.id],
      },
    })
    const bridge = new SceneBridge()
    bridge.setScene({ [site.id]: site, [building.id]: building, [level.id]: level }, [site.id])
    bridge.setActiveScene(initial)
    bridge.clearHistory()
    const operations = createSceneOperations({ bridge, store })
    const plan = {
      id: 'rename-level',
      sceneId: initial.id,
      baseVersion: initial.version,
      operations: [{ op: 'update' as const, id: level.id, data: { name: '提交后' } }],
    }

    const result = await operations.commitScenePlan(plan)

    expect(result.committed).toBe(true)
    expect(result.preCheckpointVersion).toBe(1)
    expect(result.postCheckpointVersion).toBe(2)
    expect(result.eventPublished).toBe(true)
    expect(operations.getHistory()).toEqual({ pastCount: 1, futureCount: 0 })
    expect(operations.getNode(level.id)?.name).toBe('提交后')
    expect((await operations.loadSceneRevision(initial.id, 1))?.graph.nodes[level.id]?.name).toBe(
      '提交前',
    )
    expect((await operations.loadSceneRevision(initial.id, 2))?.graph.nodes[level.id]?.name).toBe(
      '提交后',
    )
  })

  test('does not save or mutate when hard validation fails', async () => {
    const site = SiteNode.parse({ id: 'site_invalid_plan', children: [] })
    const initial = await store.save({
      id: 'scene-plan-invalid',
      name: '无效计划住宅',
      graph: { nodes: { [site.id]: site }, rootNodeIds: [site.id] },
    })
    const bridge = new SceneBridge()
    bridge.setScene({ [site.id]: site }, [site.id])
    bridge.setActiveScene(initial)
    bridge.clearHistory()
    const operations = createSceneOperations({ bridge, store })

    const result = await operations.commitScenePlan({
      id: 'missing-target',
      sceneId: initial.id,
      baseVersion: initial.version,
      operations: [{ op: 'update', id: 'level_missing', data: { name: '不存在' } }],
    })

    expect(result.committed).toBe(false)
    expect(result.prepared.issues.map((issue) => issue.code)).toContain('missing-node')
    expect((await store.load(initial.id))?.version).toBe(1)
    expect(operations.getHistory()).toEqual({ pastCount: 0, futureCount: 0 })
  })
})
