import { describe, expect, test } from 'bun:test'
import type { AnyNodeId } from '@pascal-app/core'
import { GlnBufferTankNode } from './buffer-tank-schema'
import { getGlnInstallationIssues } from './equipment-installation'
import { buildGlnOutdoorUnitGeometry } from './outdoor-unit-geometry'
import { glnOutdoorUnitParametrics } from './outdoor-unit-parametrics'
import { GlnOutdoorUnitNode } from './outdoor-unit-schema'

const outdoor = GlnOutdoorUnitNode.parse({
  id: 'gln-outdoor-unit_test',
  parentId: 'level_test',
  systemId: 'gln-system_test',
  position: [2, 0, 2],
})

const tank = GlnBufferTankNode.parse({
  id: 'gln-buffer-tank_test',
  parentId: 'level_test',
  systemId: 'gln-system_test',
  position: [4, 0, 2],
})

const scene = (...nodes: Array<typeof outdoor | typeof tank>) =>
  Object.fromEntries(nodes.map((node) => [node.id, node])) as never as Record<AnyNodeId, never>

describe('GLN equipment installation', () => {
  test('keeps generic product placeholders explicit and applies only editable envelope presets', () => {
    expect(outdoor.specificationSource).toBe('generic-placeholder')
    expect(outdoor.presetId).toBe('generic-standard')
    expect(
      glnOutdoorUnitParametrics.derive?.(
        { ...outdoor, presetId: 'generic-wide' },
        { presetId: 'generic-wide' },
      ),
    ).toMatchObject({
      width: 1.2,
      depth: 0.55,
      height: 0.9,
    })
  })

  test('renders a transparent clearance envelope only after the user enters a clearance', () => {
    expect(
      buildGlnOutdoorUnitGeometry(outdoor).getObjectByName('gln-equipment-clearance'),
    ).toBeUndefined()
    const legacyWithoutClearanceFields = {
      ...outdoor,
      clearanceBack: undefined,
      clearanceFront: undefined,
      clearanceLeft: undefined,
      clearanceRight: undefined,
      clearanceTop: undefined,
    } as unknown as typeof outdoor
    expect(
      buildGlnOutdoorUnitGeometry(legacyWithoutClearanceFields).getObjectByName(
        'gln-equipment-clearance',
      ),
    ).toBeUndefined()
    const withClearance = GlnOutdoorUnitNode.parse({ ...outdoor, clearanceFront: 0.6 })
    expect(
      buildGlnOutdoorUnitGeometry(withClearance).getObjectByName('gln-equipment-clearance'),
    ).toBeDefined()
  })

  test('allows floor equipment without dedicated installation areas', () => {
    const unassignedOutdoor = GlnOutdoorUnitNode.parse({
      ...outdoor,
      installationAreaZoneId: null,
      installationAreaKind: 'unassigned',
    })
    const unassignedTank = GlnBufferTankNode.parse({
      ...tank,
      installationAreaZoneId: null,
      installationAreaKind: 'unassigned',
    })
    expect(getGlnInstallationIssues(scene(unassignedOutdoor, unassignedTank))).toEqual([])
  })

  test('reports equipment and explicit clearance conflicts with selectable node ids', () => {
    const overlapping = GlnBufferTankNode.parse({ ...tank, position: [2.1, 0, 2] })
    expect(getGlnInstallationIssues(scene(outdoor, overlapping))).toMatchObject([
      { code: 'clearance-overlap', nodeIds: [outdoor.id, overlapping.id] },
    ])
  })
})
