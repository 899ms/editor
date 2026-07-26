import { describe, expect, test } from 'bun:test'
import { nodeRegistry, registerNode, summarizeSystemFor } from '@pascal-app/core'
import { Box3, type Object3D, Vector3 } from 'three'
import { glnBufferTankDefinition, glnBufferTankNodeDefinition } from './buffer-tank-definition'
import { buildGlnBufferTankFloorplan } from './buffer-tank-floorplan'
import { buildGlnBufferTankGeometry } from './buffer-tank-geometry'
import { getGlnBufferTankPorts } from './buffer-tank-ports'
import { GlnBufferTankNode } from './buffer-tank-schema'

const makeTank = (patch: Partial<ReturnType<typeof GlnBufferTankNode.parse>> = {}) =>
  GlnBufferTankNode.parse({
    systemId: 'gln-system_test',
    ...patch,
  })

describe('GLN buffer-tank domain definition', () => {
  test('exposes four typed plant-side and load-side ports', () => {
    const tank = makeTank({
      position: [2, 0.1, 3],
      diameter: 0.8,
      height: 2,
      connectionDiameterIn: 1.25,
    })

    expect(getGlnBufferTankPorts(tank)).toEqual([
      {
        id: 'source-supply',
        position: [1.6, 1.54, 3],
        direction: [-1, 0, 0],
        diameter: 1.25,
        system: 'gln:source-supply',
        shape: 'round',
      },
      {
        id: 'source-return',
        position: [1.6, 0.66, 3],
        direction: [-1, 0, 0],
        diameter: 1.25,
        system: 'gln:source-return',
        shape: 'round',
      },
      {
        id: 'load-supply',
        position: [2.4, 1.54, 3],
        direction: [1, 0, 0],
        diameter: 1.25,
        system: 'gln:load-supply',
        shape: 'round',
      },
      {
        id: 'load-return',
        position: [2.4, 0.66, 3],
        direction: [1, 0, 0],
        diameter: 1.25,
        system: 'gln:load-return',
        shape: 'round',
      },
    ])
  })

  test('rotates port positions and directions with the tank', () => {
    const tank = makeTank({
      rotation: [0, Math.PI / 2, 0],
      diameter: 0.8,
      height: 2,
    })
    const ports = getGlnBufferTankPorts(tank)

    expect(ports[0]?.position[0]).toBeCloseTo(0)
    expect(ports[0]?.position[2]).toBeCloseTo(0.4)
    expect(ports[0]?.direction[0]).toBeCloseTo(0)
    expect(ports[0]?.direction[2]).toBeCloseTo(1)
    expect(ports[2]?.position[2]).toBeCloseTo(-0.4)
    expect(ports[2]?.direction[2]).toBeCloseTo(-1)
  })

  test('builds a tank with explanatory stratification and no embedded pipe run', () => {
    const tank = makeTank({ diameter: 0.8, height: 2, stratificationView: true })
    const geometry = buildGlnBufferTankGeometry(tank)
    const names: string[] = []
    geometry.traverse((child: Object3D) => names.push(child.name))

    expect(names).toContain('gln-buffer-tank-jacket')
    expect(names).toContain('gln-buffer-tank-stratification-warm')
    expect(names).toContain('gln-buffer-tank-stratification-cool')
    expect(names).toContain('gln-buffer-tank-port-source-supply')
    expect(names).toContain('gln-buffer-tank-port-load-return')
    expect(names.some((name) => name.includes('pipe-run'))).toBe(false)

    const size = new Box3().setFromObject(geometry).getSize(new Vector3())
    expect(size.x).toBeGreaterThanOrEqual(0.8)
    expect(size.y).toBeCloseTo(2)
    expect(size.z).toBeGreaterThanOrEqual(0.8)
  })

  test('uses the same circular footprint, position, and yaw in the floor plan', () => {
    const tank = makeTank({
      position: [4, 0, 6],
      rotation: [0, Math.PI / 4, 0],
      diameter: 0.8,
    })
    const floorplan = buildGlnBufferTankFloorplan(tank, {
      viewState: { selected: false, highlighted: false, hovered: false },
    })

    expect(floorplan).toMatchObject({
      kind: 'group',
      transform: { translate: [4, 6], rotate: -Math.PI / 4 },
    })
    expect(floorplan.kind === 'group' ? floorplan.children[0] : null).toMatchObject({
      kind: 'circle',
      cx: 0,
      cy: 0,
      r: 0.4,
    })
  })

  test('opts into shared edit behavior and references exactly one system', () => {
    expect(glnBufferTankDefinition.kind).toBe('gln:buffer-tank')
    expect(glnBufferTankDefinition.capabilities).toMatchObject({
      hostable: { align: 'bottom', parents: ['level'] },
      selectable: { hitVolume: 'bbox' },
      movable: { axes: ['x', 'z'], gridSnap: true },
      rotatable: { axes: ['y'] },
      deletable: true,
    })
    expect(glnBufferTankDefinition.geometry).toBe(buildGlnBufferTankGeometry)
    expect(glnBufferTankDefinition.ports).toBe(getGlnBufferTankPorts)
    expect(glnBufferTankDefinition.floorplan).toBe(buildGlnBufferTankFloorplan)
    expect(glnBufferTankDefinition.relations).toEqual({
      references: { systemId: ['gln:system'], installationAreaZoneId: ['zone'] },
    })
    expect(GlnBufferTankNode.safeParse(glnBufferTankDefinition.defaults()).success).toBe(true)
  })

  test('ships readable Chinese inspector labels', () => {
    const fields = glnBufferTankDefinition.parametrics.groups.flatMap((group) => group.fields)

    expect(fields.find((field) => field.key === 'diameter')).toMatchObject({
      label: '水箱直径',
      unit: 'm',
    })
    expect(fields.find((field) => field.key === 'stratificationView')).toMatchObject({
      label: '显示冷热分层',
    })
    expect(fields.find((field) => field.key === 'connectionDiameterIn')).toMatchObject({
      label: '接口管径',
      unit: '英寸',
    })
  })

  test('identifies itself as equipment in the shared system graph', () => {
    const tank = makeTank()
    if (!nodeRegistry.has(glnBufferTankDefinition.kind)) {
      registerNode(glnBufferTankNodeDefinition)
    }
    const summary = summarizeSystemFor(tank.id, { [tank.id]: tank })

    expect(glnBufferTankDefinition.distributionRole).toBe('equipment')
    expect(summary).toMatchObject({
      connectedToEquipment: true,
      equipmentCount: 1,
      nodeIds: [tank.id],
    })
  })
})
