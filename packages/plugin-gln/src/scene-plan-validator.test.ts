import { describe, expect, test } from 'bun:test'
import type { ScenePlanValidationContext } from '@pascal-app/core/scene-plan'
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
  test('rejects duplicate source equipment, missing zones, invalid areas, and incomplete ports', () => {
    const nodes = {
      'gln-system_one': {
        id: 'gln-system_one',
        type: 'gln:system',
        zoneSettings: { zone_missing: {} },
      },
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
    expect(codes).toContain('gln-duplicate-equipment')
    expect(codes).toContain('gln-installation-area-unassigned')
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
})
