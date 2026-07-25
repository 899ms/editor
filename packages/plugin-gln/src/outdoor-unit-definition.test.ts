import { describe, expect, test } from 'bun:test'
import { nodeRegistry, registerNode, summarizeSystemFor } from '@pascal-app/core'
import { Box3, type Mesh, type MeshStandardMaterial, type Object3D, Vector3 } from 'three'
import { glnOutdoorUnitDefinition, glnOutdoorUnitNodeDefinition } from './outdoor-unit-definition'
import { buildGlnOutdoorUnitFloorplan } from './outdoor-unit-floorplan'
import { buildGlnOutdoorUnitGeometry } from './outdoor-unit-geometry'
import { getGlnOutdoorUnitPorts } from './outdoor-unit-ports'
import { GlnOutdoorUnitNode } from './outdoor-unit-schema'

const makeUnit = (patch: Partial<ReturnType<typeof GlnOutdoorUnitNode.parse>> = {}) =>
  GlnOutdoorUnitNode.parse({
    systemId: 'gln-system_test',
    ...patch,
  })

describe('GLN outdoor-unit domain definition', () => {
  test('exposes typed hydronic supply and return ports in level-local coordinates', () => {
    const unit = makeUnit({
      position: [2, 0.1, 3],
      width: 1,
      depth: 0.5,
      height: 0.8,
      connectionDiameterIn: 1.25,
    })

    expect(getGlnOutdoorUnitPorts(unit)).toEqual([
      {
        id: 'supply',
        position: [2.5, 0.564, 3.09],
        direction: [1, 0, 0],
        diameter: 1.25,
        system: 'gln:source-supply',
        shape: 'round',
      },
      {
        id: 'return',
        position: [2.5, 0.356, 2.91],
        direction: [1, 0, 0],
        diameter: 1.25,
        system: 'gln:source-return',
        shape: 'round',
      },
    ])
  })

  test('rotates both connection positions and directions with the unit', () => {
    const unit = makeUnit({
      rotation: [0, Math.PI / 2, 0],
      width: 1,
      depth: 0.5,
      height: 0.8,
    })
    const [supply, returnPort] = getGlnOutdoorUnitPorts(unit)

    expect(supply?.position[0]).toBeCloseTo(0.09)
    expect(supply?.position[2]).toBeCloseTo(-0.5)
    expect(supply?.direction[0]).toBeCloseTo(0)
    expect(supply?.direction[2]).toBeCloseTo(-1)
    expect(returnPort?.position[0]).toBeCloseTo(-0.09)
    expect(returnPort?.position[2]).toBeCloseTo(-0.5)
  })

  test('builds editable equipment geometry without embedding a pipe run', () => {
    const unit = makeUnit({ width: 1.1, depth: 0.5, height: 0.9 })
    const geometry = buildGlnOutdoorUnitGeometry(unit)
    const names: string[] = []
    geometry.traverse((child: Object3D) => names.push(child.name))

    expect(names).toContain('gln-outdoor-body')
    expect(names).toContain('gln-outdoor-fan-grille')
    expect(names).toContain('gln-outdoor-port-supply')
    expect(names).toContain('gln-outdoor-port-return')
    expect(names.some((name) => name.includes('pipe-run'))).toBe(false)

    const body = geometry.getObjectByName('gln-outdoor-body')
    expect(body).toBeDefined()
    const size = new Box3().setFromObject(body as Object3D).getSize(new Vector3())
    expect(size.x).toBeCloseTo(1.1)
    expect(size.y).toBeCloseTo(0.9)
    expect(size.z).toBeCloseTo(0.5)
  })

  test('keeps body color editable after selecting a finish preset', () => {
    const graphite = makeUnit({ bodyColor: '#123456', finish: 'graphite' })
    const geometry = buildGlnOutdoorUnitGeometry(graphite)
    const body = geometry.getObjectByName('gln-outdoor-body') as Mesh
    const bodyMaterial = body.material as MeshStandardMaterial

    expect(`#${bodyMaterial.color.getHexString()}`).toBe('#123456')
    expect(glnOutdoorUnitDefinition.parametrics.derive?.(graphite, { finish: 'graphite' })).toEqual(
      {
        bodyColor: '#50575d',
        grilleColor: '#23282c',
      },
    )
  })

  test('uses the same footprint, position, and yaw in the floor plan', () => {
    const unit = makeUnit({
      position: [4, 0, 6],
      rotation: [0, Math.PI / 4, 0],
      width: 1.2,
      depth: 0.55,
    })
    const floorplan = buildGlnOutdoorUnitFloorplan(unit, {
      viewState: { selected: false, highlighted: false, hovered: false },
    })

    expect(floorplan).toMatchObject({
      kind: 'group',
      transform: {
        translate: [4, 6],
        rotate: -Math.PI / 4,
      },
    })
    expect(floorplan.kind === 'group' ? floorplan.children[0] : null).toMatchObject({
      kind: 'rect',
      x: -0.6,
      y: -0.275,
      width: 1.2,
      height: 0.55,
    })
  })

  test('opts into the host selection, movement, rotation, duplication, and deletion paths', () => {
    expect(glnOutdoorUnitDefinition.kind).toBe('gln:outdoor-unit')
    expect(glnOutdoorUnitDefinition.capabilities).toMatchObject({
      hostable: { align: 'bottom', parents: ['level'] },
      selectable: { hitVolume: 'bbox' },
      movable: { axes: ['x', 'z'], gridSnap: true },
      rotatable: { axes: ['y'] },
      duplicable: true,
      deletable: true,
    })
    expect(glnOutdoorUnitDefinition.geometry).toBe(buildGlnOutdoorUnitGeometry)
    expect(glnOutdoorUnitDefinition.ports).toBe(getGlnOutdoorUnitPorts)
    expect(glnOutdoorUnitDefinition.floorplan).toBe(buildGlnOutdoorUnitFloorplan)
    expect(glnOutdoorUnitDefinition.relations).toEqual({
      references: { systemId: ['gln:system'] },
    })
    expect(GlnOutdoorUnitNode.safeParse(glnOutdoorUnitDefinition.defaults()).success).toBe(true)
  })

  test('ships readable Chinese labels for plugin-owned inspector fields', () => {
    const fields = glnOutdoorUnitDefinition.parametrics.groups.flatMap((group) => group.fields)
    const finish = fields.find((field) => field.key === 'finish')
    const grille = fields.find((field) => field.key === 'grilleColor')
    const connection = fields.find((field) => field.key === 'connectionDiameterIn')

    expect(finish).toMatchObject({
      label: '机身款式',
      optionLabels: { graphite: '石墨灰', light: '浅色' },
    })
    expect(grille).toMatchObject({ label: '风扇格栅颜色' })
    expect(connection).toMatchObject({ label: '接口管径', unit: '英寸' })
  })

  test('identifies itself as equipment in the shared system graph', () => {
    const unit = makeUnit()
    if (!nodeRegistry.has(glnOutdoorUnitDefinition.kind)) {
      registerNode(glnOutdoorUnitNodeDefinition)
    }
    const summary = summarizeSystemFor(unit.id, { [unit.id]: unit })

    expect(glnOutdoorUnitDefinition.distributionRole).toBe('equipment')
    expect(summary).toMatchObject({
      connectedToEquipment: true,
      equipmentCount: 1,
      nodeIds: [unit.id],
    })
  })
})
