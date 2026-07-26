import { beforeEach, describe, expect, test } from 'bun:test'
import { BuildingNode, LevelNode, SiteNode } from '../schema'
import type { SceneGraph } from '../utils/clone-scene-graph'
import { prepareScenePlan } from './prepare-scene-plan'
import { registerScenePlanValidator, resetScenePlanValidatorsForTests } from './validator-registry'

function fixture(): { graph: SceneGraph; levelId: string } {
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
    name: '原楼层',
  })
  return {
    graph: {
      nodes: { [site.id]: site, [building.id]: building, [level.id]: level },
      rootNodeIds: [site.id],
    },
    levelId: level.id,
  }
}

beforeEach(() => resetScenePlanValidatorsForTests())

describe('prepareScenePlan', () => {
  test('prepares diffs without mutating the source scene', async () => {
    const { graph, levelId } = fixture()
    const source = structuredClone(graph)
    const result = await prepareScenePlan(
      {
        id: 'plan_diff',
        sceneId: 'home',
        baseVersion: 4,
        operations: [
          {
            op: 'create',
            parentId: levelId,
            node: LevelNode.parse({ id: 'level_new', children: [], name: '新增楼层' }),
          },
          { op: 'update', id: levelId, data: { name: '改名楼层', position: [1, 0, 0] } },
          { op: 'delete', id: 'level_new' },
        ],
      },
      { sceneId: 'home', version: 4, graph },
    )

    expect(result.ok).toBe(true)
    expect(result.diffs.map((diff) => [diff.kind, diff.nodeId])).toEqual([['move', levelId]])
    expect((result.after?.graph.nodes as Record<string, any>)[levelId]).toMatchObject({
      name: '改名楼层',
      position: [1, 0, 0],
    })
    expect(graph).toEqual(source)
  })

  test('classifies create, move, update, and delete diffs independently', async () => {
    const { graph, levelId } = fixture()
    const nodes = graph.nodes as Record<string, any>
    const movingLevel = LevelNode.parse({
      id: 'level_moving',
      parentId: 'building_plan',
      children: [],
      name: '待移动楼层',
    })
    const deletedLevel = LevelNode.parse({
      id: 'level_deleted',
      parentId: 'building_plan',
      children: [],
      name: '待删除楼层',
    })
    nodes[movingLevel.id] = movingLevel
    nodes[deletedLevel.id] = deletedLevel
    nodes.building_plan = {
      ...nodes.building_plan,
      children: [levelId, movingLevel.id, deletedLevel.id],
    }

    const result = await prepareScenePlan(
      {
        id: 'plan_all_diff_kinds',
        sceneId: 'home',
        baseVersion: 1,
        operations: [
          {
            op: 'create',
            parentId: 'building_plan',
            node: LevelNode.parse({ id: 'level_created', children: [], name: '新增楼层' }),
          },
          { op: 'update', id: levelId, data: { name: '只改名称' } },
          { op: 'update', id: movingLevel.id, data: { position: [1, 0, 0] } },
          { op: 'delete', id: deletedLevel.id },
        ],
      },
      { sceneId: 'home', version: 1, graph },
    )

    expect(result.ok).toBe(true)
    expect(result.diffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'create', nodeId: 'level_created' }),
        expect.objectContaining({ kind: 'move', nodeId: movingLevel.id }),
        expect.objectContaining({ kind: 'update', nodeId: levelId }),
        expect.objectContaining({ kind: 'delete', nodeId: deletedLevel.id }),
      ]),
    )
  })

  test('rejects operations that would indirectly mutate a locked parent', async () => {
    const { graph } = fixture()
    const nodes = graph.nodes as Record<string, any>
    nodes.building_plan = {
      ...nodes.building_plan,
      metadata: { glnLocked: true },
    }
    const source = structuredClone(graph)

    const result = await prepareScenePlan(
      {
        id: 'plan_locked_parent',
        sceneId: 'home',
        baseVersion: 1,
        operations: [
          {
            op: 'create',
            parentId: 'building_plan',
            node: LevelNode.parse({ id: 'level_blocked', children: [], name: '不能新增' }),
          },
        ],
      },
      { sceneId: 'home', version: 1, graph },
    )

    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'locked-parent',
        nodeIds: ['building_plan', 'level_blocked'],
      }),
    )
    expect(result.diffs).toEqual([])
    expect(graph).toEqual(source)
  })

  test('keeps old and new parent child lists consistent when moving a node', async () => {
    const { graph, levelId } = fixture()
    const nodes = graph.nodes as Record<string, any>
    const secondBuilding = BuildingNode.parse({
      id: 'building_second',
      parentId: 'site_plan',
      children: [],
    })
    nodes.building_second = secondBuilding
    nodes.site_plan = {
      ...nodes.site_plan,
      children: ['building_plan', secondBuilding.id],
    }

    const result = await prepareScenePlan(
      {
        id: 'plan_reparent',
        sceneId: 'home',
        baseVersion: 1,
        operations: [
          {
            op: 'update',
            id: levelId,
            data: { parentId: secondBuilding.id },
          },
        ],
      },
      { sceneId: 'home', version: 1, graph },
    )

    expect(result.ok).toBe(true)
    const afterNodes = result.after?.graph.nodes as Record<string, any>
    expect(afterNodes[levelId]?.parentId).toBe(secondBuilding.id)
    expect(afterNodes.building_plan?.children).not.toContain(levelId)
    expect(afterNodes[secondBuilding.id]?.children).toContain(levelId)
    expect(result.diffs).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'move', nodeId: levelId })]),
    )
  })

  test('stops on a version conflict before running plugin validators', async () => {
    let validatorCalls = 0
    registerScenePlanValidator({
      id: 'test:validator',
      validate: () => {
        validatorCalls += 1
        return []
      },
    })
    const { graph, levelId } = fixture()
    const result = await prepareScenePlan(
      {
        id: 'plan_stale',
        sceneId: 'home',
        baseVersion: 2,
        operations: [{ op: 'update', id: levelId, data: { name: '不应应用' } }],
      },
      { sceneId: 'home', version: 3, graph },
    )

    expect(result.ok).toBe(false)
    expect(result.after).toBeNull()
    expect(result.issues.map((issue) => issue.code)).toEqual(['version-conflict'])
    expect(validatorCalls).toBe(0)
    expect((graph.nodes as Record<string, any>)[levelId]?.name).toBe('原楼层')
  })

  test('rejects locked nodes and invalid later operations without partial mutation', async () => {
    const { graph, levelId } = fixture()
    const graphNodes = graph.nodes as Record<string, any>
    graphNodes[levelId] = {
      ...graphNodes[levelId],
      metadata: { glnLocked: true },
    }
    const result = await prepareScenePlan(
      {
        id: 'plan_locked',
        sceneId: 'home',
        baseVersion: 1,
        operations: [
          { op: 'update', id: levelId, data: { name: '不能修改' } },
          { op: 'delete', id: 'missing_node' },
        ],
      },
      { sceneId: 'home', version: 1, graph },
    )

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain('locked-node')
    expect(result.issues.map((issue) => issue.code)).toContain('missing-node')
    expect(graphNodes[levelId]?.name).toBe('原楼层')
  })

  test('runs registered hard validators against the synthesized graph', async () => {
    registerScenePlanValidator({
      id: 'test:forbid-name',
      validate: ({ after }) =>
        Object.values(after.graph.nodes).some((node) => node.name === '禁止')
          ? [{ severity: 'error', code: 'forbidden-name', message: '名称不允许。' }]
          : [],
    })
    const { graph, levelId } = fixture()
    const result = await prepareScenePlan(
      {
        id: 'plan_plugin_error',
        sceneId: 'home',
        baseVersion: 1,
        operations: [{ op: 'update', id: levelId, data: { name: '禁止' } }],
      },
      { sceneId: 'home', version: 1, graph },
    )

    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'forbidden-name',
        validatorId: 'test:forbid-name',
      }),
    )
  })
})
