import { expect, test } from 'bun:test'
import type { ScenePlan } from '@pascal-app/core/scene-plan'
import type { SceneGraph } from '@pascal-app/editor'
import {
  GlnBufferTankNode,
  GlnHydronicPipeNode,
  GlnOutdoorUnitNode,
  GlnSystemNode,
  GlnWallPanelNode,
} from '@pascal-app/plugin-gln'
import {
  analyzeGlnConfiguration,
  normalizeGlnConfigurationScenePlan,
  onlyReviewableGlnPlacementErrors,
  validateGlnConfigurationScope,
} from './gln-configuration-scene-plan'

function plan(operations: ScenePlan['operations']): ScenePlan {
  return { id: 'plan_gln_config', sceneId: 'home', baseVersion: 1, operations }
}

function graphWithClosedLoop(): SceneGraph {
  const system = GlnSystemNode.parse({
    id: 'gln-system_primary',
    name: '主系统',
    zoneSettings: {
      zone_living: {
        targetTemperature: 24,
        targetTemperatureSource: 'template',
        targetHumidity: 50,
        targetHumiditySource: 'template',
        enabled: true,
      },
    },
  })
  const outdoor = GlnOutdoorUnitNode.parse({
    id: 'gln-outdoor-unit_primary',
    parentId: 'level_home',
    systemId: system.id,
    position: [0, 0, 0],
    installationAreaZoneId: 'zone_outdoor',
    installationAreaKind: 'outdoor-equipment-area',
  })
  const tank = GlnBufferTankNode.parse({
    id: 'gln-buffer-tank_primary',
    parentId: 'level_home',
    systemId: system.id,
    position: [4, 0, 0],
    installationAreaZoneId: 'zone_equipment',
    installationAreaKind: 'equipment-room',
  })
  const panel = GlnWallPanelNode.parse({
    id: 'gln-wall-panel_living',
    parentId: 'wall_living',
    systemId: system.id,
    wallId: 'wall_living',
    zoneId: 'zone_living',
  })
  const links = [
    ['gln-hydronic-pipe_source_supply', 'supply', outdoor.id, 'supply', tank.id, 'source-supply'],
    ['gln-hydronic-pipe_source_return', 'return', tank.id, 'source-return', outdoor.id, 'return'],
    ['gln-hydronic-pipe_load_supply', 'supply', tank.id, 'load-supply', panel.id, 'supply'],
    ['gln-hydronic-pipe_load_return', 'return', panel.id, 'return', tank.id, 'load-return'],
  ] as const
  const pipes = links.map(([id, circuit, startNodeId, startPortId, endNodeId, endPortId]) =>
    GlnHydronicPipeNode.parse({
      id,
      parentId: 'level_home',
      systemId: system.id,
      circuit,
      start: { nodeId: startNodeId, portId: startPortId },
      end: { nodeId: endNodeId, portId: endPortId },
    }),
  )
  const nodes = {
    level_home: { id: 'level_home', type: 'level', parentId: null, children: [] },
    wall_living: { id: 'wall_living', type: 'wall', parentId: 'level_home', children: [panel.id] },
    zone_living: {
      id: 'zone_living',
      type: 'zone',
      parentId: 'level_home',
      polygon: [
        [0, 0],
        [6, 0],
        [6, 4],
        [0, 4],
      ],
    },
    zone_outdoor: {
      id: 'zone_outdoor',
      type: 'zone',
      parentId: 'level_home',
      polygon: [
        [-2, -2],
        [2, -2],
        [2, 2],
        [-2, 2],
      ],
    },
    zone_equipment: {
      id: 'zone_equipment',
      type: 'zone',
      parentId: 'level_home',
      polygon: [
        [2.5, -2],
        [5.5, -2],
        [5.5, 2],
        [2.5, 2],
      ],
    },
    ...Object.fromEntries([system, outdoor, tank, panel, ...pipes].map((node) => [node.id, node])),
  }
  return { nodes, rootNodeIds: [system.id] } as unknown as SceneGraph
}

test('allows only GLN configuration nodes and rejects structure, imports, type swaps, and locks', () => {
  const before = graphWithClosedLoop()
  before.nodes['gln-wall-panel_locked'] = {
    ...(before.nodes['gln-wall-panel_living'] as object),
    id: 'gln-wall-panel_locked',
    metadata: { glnLocked: true },
  } as never

  expect(
    validateGlnConfigurationScope(
      plan([{ op: 'update', id: 'wall_living', data: { height: 3 } }]),
      before,
    ),
  ).toMatchObject({ ok: false, code: 'gln_configuration_scope_violation' })
  expect(
    validateGlnConfigurationScope(
      plan([
        {
          op: 'create',
          node: { id: 'gln-ifc-import_forbidden', type: 'gln:ifc-import' },
        },
      ]),
      before,
    ),
  ).toMatchObject({ ok: false, code: 'gln_configuration_scope_violation' })
  expect(
    validateGlnConfigurationScope(
      plan([
        {
          op: 'update',
          id: 'gln-outdoor-unit_primary',
          data: { type: 'gln:buffer-tank' },
        },
      ]),
      before,
    ),
  ).toMatchObject({ ok: false, code: 'gln_configuration_scope_violation' })
  expect(
    validateGlnConfigurationScope(plan([{ op: 'delete', id: 'gln-wall-panel_locked' }]), before),
  ).toMatchObject({
    ok: false,
    code: 'gln_configuration_locked_node',
    nodeIds: ['gln-wall-panel_locked'],
  })
  expect(
    validateGlnConfigurationScope(plan([{ op: 'delete', id: 'gln-wall-panel_living' }]), before),
  ).toMatchObject({
    ok: false,
    code: 'gln_configuration_stable_id_violation',
    nodeIds: ['gln-wall-panel_living'],
  })
  expect(
    validateGlnConfigurationScope(plan([{ op: 'delete', id: 'gln-wall-panel_living' }]), before, {
      protectExistingIds: false,
    }),
  ).toEqual({ ok: true })
})

test('normalizes generated GLN nodes through their existing editable schemas', () => {
  const normalized = normalizeGlnConfigurationScenePlan(
    plan([
      {
        op: 'create',
        node: {
          id: 'gln-system_generated',
          type: 'gln:system',
          name: '新系统',
        },
      },
      {
        op: 'create',
        parentId: 'level_home',
        node: {
          id: 'gln-outdoor-unit_generated',
          type: 'gln:outdoor-unit',
          systemId: 'gln-system_generated',
          installationAreaZoneId: 'zone_outdoor',
          installationAreaKind: 'outdoor-equipment-area',
        },
      },
    ]),
  )
  const system = normalized.operations[0]
  const outdoor = normalized.operations[1]
  if (system?.op !== 'create' || outdoor?.op !== 'create') throw new Error('expected creates')
  expect(system.node).toMatchObject({ visible: false, parentId: null, zoneSettings: {} })
  expect(outdoor.node).toMatchObject({
    parentId: 'level_home',
    position: [0, 0, 0],
    presetId: 'generic-standard',
    specificationSource: 'generic-placeholder',
  })
  expect(outdoor.parentId).toBe('level_home')
})

test('requires the requested system count and a complete non-duplicated closed loop', () => {
  const graph = graphWithClosedLoop()
  const ready = analyzeGlnConfiguration({
    beforeGraph: { nodes: {}, rootNodeIds: [] } as unknown as SceneGraph,
    afterGraph: graph,
    request: { targetSystemCount: 1 },
    touchedNodeIds: Object.keys(graph.nodes).filter((id) => id.startsWith('gln-')),
  })
  expect(ready.status).toBe('ready')
  expect(ready.completenessIssues).toEqual([])

  const mismatched = analyzeGlnConfiguration({
    beforeGraph: graph,
    afterGraph: graph,
    request: { targetSystemCount: 2 },
    touchedNodeIds: ['gln-system_primary'],
  })
  expect(mismatched.status).toBe('report-only')
  expect(mismatched.completenessIssues.map((issue) => issue.code)).toContain(
    'system-count-mismatch',
  )

  const duplicate = structuredClone(graph)
  duplicate.nodes['gln-hydronic-pipe_duplicate'] = {
    ...(duplicate.nodes['gln-hydronic-pipe_load_supply'] as object),
    id: 'gln-hydronic-pipe_duplicate',
  } as never
  const duplicateReport = analyzeGlnConfiguration({
    beforeGraph: { nodes: {}, rootNodeIds: [] } as unknown as SceneGraph,
    afterGraph: duplicate,
    request: { targetSystemCount: 1 },
    touchedNodeIds: ['gln-system_primary'],
  })
  expect(duplicateReport.completenessIssues.map((issue) => issue.code)).toContain(
    'duplicate-device',
  )

  const incompleteExisting = structuredClone(graph)
  incompleteExisting.nodes['gln-system_secondary'] = GlnSystemNode.parse({
    id: 'gln-system_secondary',
    name: '未完成系统',
  }) as never
  const incompleteReport = analyzeGlnConfiguration({
    beforeGraph: incompleteExisting,
    afterGraph: incompleteExisting,
    request: { targetSystemCount: 2 },
    touchedNodeIds: ['gln-system_primary'],
  })
  expect(incompleteReport.status).toBe('report-only')
  expect(incompleteReport.completenessIssues.map((issue) => issue.code)).toEqual(
    expect.arrayContaining(['missing-outdoor-unit', 'missing-buffer-tank', 'missing-wall-panel']),
  )

  const splitPanelLoop = structuredClone(graph)
  splitPanelLoop.nodes['gln-wall-panel_bedroom'] = GlnWallPanelNode.parse({
    ...(splitPanelLoop.nodes['gln-wall-panel_living'] as object),
    id: 'gln-wall-panel_bedroom',
    position: [3, 1.25, 0.16],
  }) as never
  const splitReturn = splitPanelLoop.nodes['gln-hydronic-pipe_load_return'] as unknown as {
    start: { nodeId: string; portId: string }
  }
  splitReturn.start = { nodeId: 'gln-wall-panel_bedroom', portId: 'return' }
  const splitReport = analyzeGlnConfiguration({
    beforeGraph: { nodes: {}, rootNodeIds: [] } as unknown as SceneGraph,
    afterGraph: splitPanelLoop,
    request: { targetSystemCount: 1 },
    touchedNodeIds: ['gln-system_primary'],
  })
  expect(splitReport.completenessIssues.map((issue) => issue.code)).toContain('missing-panel-loop')

  const invalidExistingPlacement = structuredClone(graph)
  const misplacedOutdoor = invalidExistingPlacement.nodes[
    'gln-outdoor-unit_primary'
  ] as unknown as {
    position: [number, number, number]
  }
  misplacedOutdoor.position = [50, 0, 50]
  const placementReport = analyzeGlnConfiguration({
    beforeGraph: invalidExistingPlacement,
    afterGraph: invalidExistingPlacement,
    request: { targetSystemCount: 1 },
    touchedNodeIds: ['gln-system_primary'],
  })
  expect(placementReport.status).toBe('needs-review')
  expect(placementReport.reviewItems.map((item) => item.code)).toContain('installation')
})

test('routes unresolved placement and concealed paths into an explicit review queue', () => {
  const graph = graphWithClosedLoop()
  const pipe = graph.nodes['gln-hydronic-pipe_load_supply'] as unknown as {
    routing: { state: string; reviewReason: string | null; strategy: string }
  }
  pipe.routing = { strategy: 'manual', state: 'needs-review', reviewReason: 'obstructed' }
  const report = analyzeGlnConfiguration({
    beforeGraph: { nodes: {}, rootNodeIds: [] } as unknown as SceneGraph,
    afterGraph: graph,
    request: { targetSystemCount: 1 },
    touchedNodeIds: ['gln-system_primary'],
    previewIssues: [
      {
        severity: 'error',
        code: 'gln-installation-outside-confirmed-area',
        message: '外机超出确认安装区域。',
        nodeIds: ['gln-outdoor-unit_primary'],
      },
    ],
  })
  expect(report.status).toBe('needs-review')
  expect(report.reviewItems.map((item) => item.code)).toEqual(['installation', 'routing'])
  expect(
    onlyReviewableGlnPlacementErrors([
      {
        severity: 'error',
        code: 'gln-installation-outside-confirmed-area',
        message: '待复核',
      },
    ]),
  ).toBe(true)
  expect(
    onlyReviewableGlnPlacementErrors([{ severity: 'error', code: 'locked-node', message: '锁定' }]),
  ).toBe(false)
  expect(
    onlyReviewableGlnPlacementErrors([
      {
        severity: 'error',
        code: 'gln-panel-opening-overlap',
        message: '面板与门窗重叠',
      },
    ]),
  ).toBe(true)
  expect(
    onlyReviewableGlnPlacementErrors([
      {
        severity: 'error',
        code: 'gln-panel-wall-missing',
        message: '墙体不存在',
      },
    ]),
  ).toBe(false)
})
