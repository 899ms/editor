import { expect, test } from 'bun:test'
import type { ScenePlan } from '@pascal-app/core/scene-plan'
import { BuildingNode, LevelNode, SiteNode, WallNode, ZoneNode } from '@pascal-app/core/schema'
import type { SceneGraph } from '@pascal-app/editor'
import {
  analyzeResidentialScenePlan,
  normalizeResidentialScenePlan,
  validateResidentialPlanScope,
} from './residential-scene-plan'

function residentialGraph(): SceneGraph {
  const site = SiteNode.parse({
    id: 'site_residential_ai',
    children: ['building_residential_ai'],
  })
  const building = BuildingNode.parse({
    id: 'building_residential_ai',
    parentId: site.id,
    children: ['level_residential_ai'],
  })
  const level = LevelNode.parse({
    id: 'level_residential_ai',
    parentId: building.id,
    children: [
      'wall_residential_ai_north',
      'wall_residential_ai_east',
      'wall_residential_ai_south',
      'wall_residential_ai_west',
      'zone_residential_ai_living',
    ],
  })
  const wallSpecs = [
    ['wall_residential_ai_north', [0, 0], [4, 0]],
    ['wall_residential_ai_east', [4, 0], [4, 3]],
    ['wall_residential_ai_south', [4, 3], [0, 3]],
    ['wall_residential_ai_west', [0, 3], [0, 0]],
  ] as const
  const walls = wallSpecs.map(([id, start, end]) =>
    WallNode.parse({
      id,
      parentId: level.id,
      start,
      end,
      height: 2.8,
      thickness: 0.2,
      frontSide: 'interior',
      backSide: 'exterior',
      metadata: { source: 'codex-residential', confidence: 'high' },
    }),
  )
  const zone = ZoneNode.parse({
    id: 'zone_residential_ai_living',
    name: '客厅',
    parentId: level.id,
    polygon: [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ],
    autoFromWalls: true,
    boundaryWallIds: walls.map((wall) => wall.id),
    metadata: { source: 'codex-residential', confidence: 'high' },
  })

  return {
    nodes: Object.fromEntries(
      [site, building, level, ...walls, zone].map((node) => [node.id, node]),
    ),
    rootNodeIds: [site.id],
  }
}

function plan(operations: ScenePlan['operations']): ScenePlan {
  return {
    id: 'plan-residential-ai',
    sceneId: 'scene-residential-ai',
    baseVersion: 1,
    operations,
  }
}

test('accepts only normal editable building nodes for residential reconstruction', () => {
  const graph = residentialGraph()

  expect(
    validateResidentialPlanScope(
      plan([
        {
          op: 'update',
          id: 'wall_residential_ai_north',
          data: { height: 3 },
        },
      ]),
      graph,
    ),
  ).toEqual({ ok: true })

  expect(
    validateResidentialPlanScope(
      plan([
        {
          op: 'create',
          parentId: 'level_residential_ai',
          node: {
            id: 'gln_panel_forbidden',
            type: 'gln:wall-panel',
          },
        },
      ]),
      graph,
    ),
  ).toEqual({
    ok: false,
    code: 'residential_node_type_not_allowed',
    message: '住宅重建只能生成既有的可编辑建筑节点。',
    nodeIds: ['gln_panel_forbidden'],
  })

  expect(
    validateResidentialPlanScope(
      plan([
        {
          op: 'update',
          id: 'wall_residential_ai_north',
          data: { type: 'gln:wall-panel' },
        },
      ]),
      graph,
    ),
  ).toEqual({
    ok: false,
    code: 'residential_node_type_not_allowed',
    message: '住宅重建只能生成既有的可编辑建筑节点。',
    nodeIds: ['wall_residential_ai_north'],
  })
})

test('normalizes AI-created nodes through the existing Pascal schemas before preview', () => {
  const normalized = normalizeResidentialScenePlan(
    plan([
      {
        op: 'create',
        parentId: 'level_residential_ai',
        node: {
          id: 'wall_residential_ai_normalized',
          type: 'wall',
          start: [0, 0],
          end: [3, 0],
        },
      },
    ]),
  )
  const operation = normalized.operations[0]
  if (operation?.op !== 'create') throw new Error('expected create operation')

  expect(operation.node).toMatchObject({
    object: 'node',
    id: 'wall_residential_ai_normalized',
    type: 'wall',
    children: [],
    parentId: 'level_residential_ai',
    visible: true,
    frontSide: 'unknown',
    backSide: 'unknown',
  })
})

test('reports a draft only when level, walls, zone, and indoor-outdoor relation exist', () => {
  const graph = residentialGraph()
  const result = analyzeResidentialScenePlan({
    graph,
    touchedNodeIds: [
      'wall_residential_ai_north',
      'wall_residential_ai_east',
      'wall_residential_ai_south',
      'wall_residential_ai_west',
      'zone_residential_ai_living',
    ],
  })

  expect(result.status).toBe('draft-ready')
  expect(result.minimumStructure).toEqual({
    satisfied: true,
    missing: [],
  })
  expect(result.reviewItems).toEqual([])

  const withoutRelation = structuredClone(graph)
  for (const node of Object.values(withoutRelation.nodes)) {
    if (node.type === 'wall') {
      node.frontSide = 'unknown'
      node.backSide = 'unknown'
    }
  }
  const missing = analyzeResidentialScenePlan({
    graph: withoutRelation,
    touchedNodeIds: [],
  })

  expect(missing.status).toBe('report-only')
  expect(missing.minimumStructure.missing).toContain('indoor-outdoor-relation')
})

test('puts medium, low, and missing AI confidence into an explicit review queue', () => {
  const graph = residentialGraph()
  const medium = graph.nodes.wall_residential_ai_north
  const low = graph.nodes.wall_residential_ai_east
  const missing = graph.nodes.wall_residential_ai_south
  if (!(medium?.type === 'wall' && low?.type === 'wall' && missing?.type === 'wall')) {
    throw new Error('expected residential walls')
  }
  medium.metadata = { source: 'codex-residential', confidence: 'medium' }
  low.metadata = {
    source: 'codex-residential',
    confidence: 'low',
    reviewReason: '平面资料未标注墙厚',
  }
  missing.metadata = { source: 'codex-residential' }

  const result = analyzeResidentialScenePlan({
    graph,
    touchedNodeIds: [medium.id, low.id, missing.id],
  })

  expect(result.status).toBe('draft-ready')
  expect(result.reviewItems.map((item) => [item.nodeId, item.reason])).toEqual([
    [medium.id, 'medium-confidence'],
    [low.id, 'low-confidence'],
    [missing.id, 'missing-confidence'],
  ])
  expect(result.nodeCounts.review).toBe(3)
  expect(result.reviewItems[1]?.message).toContain('平面资料未标注墙厚')
})
