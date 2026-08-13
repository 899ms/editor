import { describe, expect, test } from 'bun:test'
import type { ScenePlanValidationContext } from '@pascal-app/core/scene-plan'
import { getGlnBufferTankPorts } from './buffer-tank-ports'
import { GlnBufferTankNode } from './buffer-tank-schema'
import { GlnHydronicPipeNode } from './hydronic-pipe-schema'
import { planGlnConcealedRoute } from './hydronic-routing'
import { getGlnOutdoorUnitPorts } from './outdoor-unit-ports'
import { GlnOutdoorUnitNode } from './outdoor-unit-schema'
import { validateGlnScenePlan } from './scene-plan-validator'

function context(nodes: Record<string, Record<string, unknown>>, touchedIds: string[]) {
  const beforeNodes = Object.fromEntries(
    Object.entries(nodes).filter(([id]) => !touchedIds.includes(id)),
  )
  return {
    plan: {
      id: 'plan_gln',
      sceneId: 'home',
      baseVersion: 1,
      operations: [],
    },
    before: {
      sceneId: 'home',
      version: 1,
      graph: { nodes: beforeNodes, rootNodeIds: [] },
    },
    after: {
      sceneId: 'home',
      version: 2,
      graph: { nodes, rootNodeIds: [] },
    },
    diffs: touchedIds.map((nodeId) => ({
      kind: 'create' as const,
      nodeId,
      nodeType: String(nodes[nodeId]?.type),
      after: nodes[nodeId],
      changedFields: Object.keys(nodes[nodeId] ?? {}),
    })),
  } as ScenePlanValidationContext
}

describe('GLN ScenePlan hard validation', () => {
  test('rejects duplicate source equipment, missing zones, and incomplete ports', () => {
    const nodes = {
      'gln-system_one': {
        id: 'gln-system_one',
        type: 'gln:system',
        zoneSettings: { zone_missing: {}, zone_without_panel: {} },
      },
      zone_without_panel: { id: 'zone_without_panel', type: 'zone' },
      'gln-outdoor-unit_a': GlnOutdoorUnitNode.parse({
        id: 'gln-outdoor-unit_a',
        systemId: 'gln-system_one',
      }),
      'gln-outdoor-unit_b': GlnOutdoorUnitNode.parse({
        id: 'gln-outdoor-unit_b',
        systemId: 'gln-system_one',
      }),
    }
    const issues = validateGlnScenePlan(
      context(nodes, ['gln-outdoor-unit_a', 'gln-outdoor-unit_b']),
    )
    const codes = issues.map((issue) => issue.code)
    expect(codes).toContain('gln-zone-missing')
    expect(codes).toContain('gln-zone-without-panel')
    expect(codes).toContain('gln-duplicate-equipment')
    expect(codes).not.toContain('gln-installation-area-unassigned')
    expect(codes).toContain('gln-topology-missing-link')
  })

  test('does not make unrelated existing GLN problems block a building-only plan', () => {
    const nodes = {
      'gln-system_one': { id: 'gln-system_one', type: 'gln:system', zoneSettings: {} },
      'gln-outdoor-unit_a': {
        id: 'gln-outdoor-unit_a',
        type: 'gln:outdoor-unit',
        systemId: 'gln-system_one',
      },
      level_a: { id: 'level_a', type: 'level', name: '楼层' },
    }
    expect(validateGlnScenePlan(context(nodes, ['level_a']))).toEqual([])
  })

  test('recomputes touched pipe routing instead of trusting an AI routed flag', () => {
    const systemId = 'gln-system_route'
    const outdoor = GlnOutdoorUnitNode.parse({
      id: 'gln-outdoor-unit_route',
      parentId: 'level_a',
      systemId,
      position: [0, 0, 0],
    })
    const tank = GlnBufferTankNode.parse({
      id: 'gln-buffer-tank_route',
      parentId: 'level_a',
      systemId,
      position: [4, 0, 0],
    })
    const start = getGlnOutdoorUnitPorts(outdoor).find((port) => port.id === 'supply')!.position
    const end = getGlnBufferTankPorts(tank).find((port) => port.id === 'source-supply')!.position
    const canonical = planGlnConcealedRoute({
      start: [...start],
      end: [...end],
      startLevelId: 'level_a',
      endLevelId: 'level_a',
      startNodeId: outdoor.id,
      endNodeId: tank.id,
    })
    const pipe = GlnHydronicPipeNode.parse({
      id: 'gln-hydronic-pipe_route',
      parentId: 'level_a',
      systemId,
      circuit: 'supply',
      start: { nodeId: outdoor.id, portId: 'supply' },
      end: { nodeId: tank.id, portId: 'source-supply' },
      path: canonical.path,
      routing: canonical.routing,
    })
    const baseNodes = {
      [systemId]: { id: systemId, type: 'gln:system', zoneSettings: {} },
      level_a: { id: 'level_a', type: 'level', parentId: null, children: [] },
      [outdoor.id]: outdoor,
      [tank.id]: tank,
    }
    const canonicalIssues = validateGlnScenePlan(
      context({ ...baseNodes, [pipe.id]: pipe }, [pipe.id]),
    )
    expect(canonicalIssues.map((issue) => issue.code)).not.toContain('gln-routing-unvalidated')

    const arbitrary = {
      ...pipe,
      path: [[...start], [999, 999, -999], [...end]],
      routing: { strategy: 'ceiling', state: 'routed', reviewReason: null },
    }
    const arbitraryIssues = validateGlnScenePlan(
      context({ ...baseNodes, [pipe.id]: arbitrary }, [pipe.id]),
    )
    expect(arbitraryIssues.map((issue) => issue.code)).toContain('gln-routing-unvalidated')
  })

  test('sends a cross-level touched pipe without a reviewed riser to manual review', () => {
    const systemId = 'gln-system_cross_level'
    const outdoor = GlnOutdoorUnitNode.parse({
      id: 'gln-outdoor-unit_cross_level',
      parentId: 'level_a',
      systemId,
      position: [0, 0, 0],
    })
    const tank = GlnBufferTankNode.parse({
      id: 'gln-buffer-tank_cross_level',
      parentId: 'level_b',
      systemId,
      position: [4, 0, 0],
    })
    const start = getGlnOutdoorUnitPorts(outdoor).find((port) => port.id === 'supply')!.position
    const end = getGlnBufferTankPorts(tank).find((port) => port.id === 'source-supply')!.position
    const pipe = GlnHydronicPipeNode.parse({
      id: 'gln-hydronic-pipe_cross_level',
      parentId: 'level_a',
      systemId,
      circuit: 'supply',
      start: { nodeId: outdoor.id, portId: 'supply' },
      end: { nodeId: tank.id, portId: 'source-supply' },
      path: [[...start], [...end]],
      routing: { strategy: 'ceiling-riser', state: 'routed', reviewReason: null },
    })
    const issues = validateGlnScenePlan(
      context(
        {
          [systemId]: { id: systemId, type: 'gln:system', zoneSettings: {} },
          level_a: { id: 'level_a', type: 'level', parentId: null, children: [] },
          level_b: { id: 'level_b', type: 'level', parentId: null, children: [] },
          [outdoor.id]: outdoor,
          [tank.id]: tank,
          [pipe.id]: pipe,
        },
        [pipe.id],
      ),
    )
    expect(issues.map((issue) => issue.code)).toContain('gln-routing-needs-review')
  })

  test('revalidates connected pipes when AI moves endpoint equipment', () => {
    const systemId = 'gln-system_moved_endpoint'
    const outdoor = GlnOutdoorUnitNode.parse({
      id: 'gln-outdoor-unit_moved_endpoint',
      parentId: 'level_a',
      systemId,
      position: [0, 0, 0],
    })
    const tank = GlnBufferTankNode.parse({
      id: 'gln-buffer-tank_moved_endpoint',
      parentId: 'level_a',
      systemId,
      position: [4, 0, 0],
    })
    const start = getGlnOutdoorUnitPorts(outdoor).find((port) => port.id === 'supply')!.position
    const end = getGlnBufferTankPorts(tank).find((port) => port.id === 'source-supply')!.position
    const canonical = planGlnConcealedRoute({
      start: [...start],
      end: [...end],
      startLevelId: 'level_a',
      endLevelId: 'level_a',
      startNodeId: outdoor.id,
      endNodeId: tank.id,
    })
    const pipe = GlnHydronicPipeNode.parse({
      id: 'gln-hydronic-pipe_moved_endpoint',
      parentId: 'level_a',
      systemId,
      circuit: 'supply',
      start: { nodeId: outdoor.id, portId: 'supply' },
      end: { nodeId: tank.id, portId: 'source-supply' },
      path: canonical.path,
      routing: canonical.routing,
    })
    const movedOutdoor = { ...outdoor, position: [0.25, 0, 0] }
    const issues = validateGlnScenePlan(
      context(
        {
          [systemId]: { id: systemId, type: 'gln:system', zoneSettings: {} },
          level_a: { id: 'level_a', type: 'level', parentId: null, children: [] },
          [outdoor.id]: movedOutdoor,
          [tank.id]: tank,
          [pipe.id]: pipe,
        },
        [outdoor.id],
      ),
    )
    expect(issues.map((issue) => issue.code)).toContain('gln-routing-unvalidated')
  })

  test('requires the pipe to be hosted by its start endpoint level', () => {
    const systemId = 'gln-system_wrong_pipe_level'
    const outdoor = GlnOutdoorUnitNode.parse({
      id: 'gln-outdoor-unit_wrong_pipe_level',
      parentId: 'level_a',
      systemId,
      position: [0, 0, 0],
    })
    const tank = GlnBufferTankNode.parse({
      id: 'gln-buffer-tank_wrong_pipe_level',
      parentId: 'level_a',
      systemId,
      position: [4, 0, 0],
    })
    const start = getGlnOutdoorUnitPorts(outdoor).find((port) => port.id === 'supply')!.position
    const end = getGlnBufferTankPorts(tank).find((port) => port.id === 'source-supply')!.position
    const route = planGlnConcealedRoute({
      start: [...start],
      end: [...end],
      startLevelId: 'level_a',
      endLevelId: 'level_a',
      startNodeId: outdoor.id,
      endNodeId: tank.id,
    })
    const pipe = GlnHydronicPipeNode.parse({
      id: 'gln-hydronic-pipe_wrong_pipe_level',
      parentId: 'level_b',
      systemId,
      circuit: 'supply',
      start: { nodeId: outdoor.id, portId: 'supply' },
      end: { nodeId: tank.id, portId: 'source-supply' },
      path: route.path,
      routing: route.routing,
    })
    const issues = validateGlnScenePlan(
      context(
        {
          [systemId]: { id: systemId, type: 'gln:system', zoneSettings: {} },
          level_a: { id: 'level_a', type: 'level', parentId: null, children: [] },
          level_b: { id: 'level_b', type: 'level', parentId: null, children: [] },
          [outdoor.id]: outdoor,
          [tank.id]: tank,
          [pipe.id]: pipe,
        },
        [pipe.id],
      ),
    )
    expect(issues.map((issue) => issue.code)).toContain('gln-routing-parent-mismatch')
  })

  test('ignores obstacles hosted by another level when validating a local route', () => {
    const systemId = 'gln-system_other_level_obstacle'
    const outdoor = GlnOutdoorUnitNode.parse({
      id: 'gln-outdoor-unit_other_level_obstacle',
      parentId: 'level_a',
      systemId,
      position: [0, 0, 0],
    })
    const tank = GlnBufferTankNode.parse({
      id: 'gln-buffer-tank_other_level_obstacle',
      parentId: 'level_a',
      systemId,
      position: [4, 0, 0],
    })
    const start = getGlnOutdoorUnitPorts(outdoor).find((port) => port.id === 'supply')!.position
    const end = getGlnBufferTankPorts(tank).find((port) => port.id === 'source-supply')!.position
    const route = planGlnConcealedRoute({
      start: [...start],
      end: [...end],
      startLevelId: 'level_a',
      endLevelId: 'level_a',
      startNodeId: outdoor.id,
      endNodeId: tank.id,
    })
    const pipe = GlnHydronicPipeNode.parse({
      id: 'gln-hydronic-pipe_other_level_obstacle',
      parentId: 'level_a',
      systemId,
      circuit: 'supply',
      start: { nodeId: outdoor.id, portId: 'supply' },
      end: { nodeId: tank.id, portId: 'source-supply' },
      path: route.path,
      routing: route.routing,
    })
    const issues = validateGlnScenePlan(
      context(
        {
          [systemId]: { id: systemId, type: 'gln:system', zoneSettings: {} },
          level_a: { id: 'level_a', type: 'level', parentId: null, children: [] },
          level_b: { id: 'level_b', type: 'level', parentId: null, children: ['column_other'] },
          column_other: {
            id: 'column_other',
            type: 'column',
            parentId: 'level_b',
            position: [2, 0, 0],
            width: 3,
            depth: 3,
            height: 3,
          },
          [outdoor.id]: outdoor,
          [tank.id]: tank,
          [pipe.id]: pipe,
        },
        [pipe.id],
      ),
    )
    expect(issues.map((issue) => issue.code)).not.toContain('gln-routing-needs-review')
    expect(issues.map((issue) => issue.code)).not.toContain('gln-routing-unvalidated')
  })
})
