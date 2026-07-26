import { describe, expect, test } from 'bun:test'
import { type AnyNodeId, ZoneNode } from '@pascal-app/core'
import { GlnBufferTankNode } from './buffer-tank-schema'
import { getGlnInstallationIssues } from './equipment-installation'
import { buildGlnOutdoorUnitGeometry } from './outdoor-unit-geometry'
import { glnOutdoorUnitParametrics } from './outdoor-unit-parametrics'
import { GlnOutdoorUnitNode } from './outdoor-unit-schema'

const outdoorZone = ZoneNode.parse({
  id: 'zone_outdoor',
  parentId: 'level_test',
  name: '设备阳台',
  polygon: [
    [0, 0],
    [6, 0],
    [6, 6],
    [0, 6],
  ],
})

const outdoor = GlnOutdoorUnitNode.parse({
  id: 'gln-outdoor-unit_test',
  parentId: 'level_test',
  systemId: 'gln-system_test',
  position: [2, 0, 2],
  installationAreaZoneId: outdoorZone.id,
  installationAreaKind: 'outdoor-equipment-area',
})

const tank = GlnBufferTankNode.parse({
  id: 'gln-buffer-tank_test',
  parentId: 'level_test',
  systemId: 'gln-system_test',
  position: [4, 0, 2],
  installationAreaZoneId: outdoorZone.id,
  installationAreaKind: 'equipment-area',
})

const scene = (...nodes: Array<typeof outdoor | typeof tank | typeof outdoorZone>) =>
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
    const withClearance = GlnOutdoorUnitNode.parse({ ...outdoor, clearanceFront: 0.6 })
    expect(
      buildGlnOutdoorUnitGeometry(withClearance).getObjectByName('gln-equipment-clearance'),
    ).toBeDefined()
  })

  test('requires valid confirmed areas and reports out-of-area placement', () => {
    expect(getGlnInstallationIssues(scene(outdoor, tank, outdoorZone))).toEqual([])

    const invalidKind = GlnOutdoorUnitNode.parse({
      ...outdoor,
      installationAreaKind: 'equipment-area',
    })
    expect(getGlnInstallationIssues(scene(invalidKind, outdoorZone))).toMatchObject([
      { code: 'area-kind-invalid', nodeIds: [invalidKind.id, outdoorZone.id] },
    ])

    const outside = GlnOutdoorUnitNode.parse({ ...outdoor, position: [5.8, 0, 2] })
    expect(getGlnInstallationIssues(scene(outside, outdoorZone))).toMatchObject([
      { code: 'outside-confirmed-area', nodeIds: [outside.id, outdoorZone.id] },
    ])
  })

  test('reports equipment and explicit clearance conflicts with selectable node ids', () => {
    const overlapping = GlnBufferTankNode.parse({ ...tank, position: [2.1, 0, 2] })
    expect(getGlnInstallationIssues(scene(outdoor, overlapping, outdoorZone))).toMatchObject([
      { code: 'clearance-overlap', nodeIds: [outdoor.id, overlapping.id] },
    ])
  })
})
