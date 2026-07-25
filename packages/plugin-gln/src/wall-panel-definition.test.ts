import { describe, expect, test } from 'bun:test'
import { WallNode } from '@pascal-app/core'
import { Box3, type Object3D, Vector3 } from 'three'
import { glnWallPanelDefinition } from './wall-panel-definition'
import { buildGlnWallPanelFloorplan } from './wall-panel-floorplan'
import { buildGlnWallPanelGeometry } from './wall-panel-geometry'
import { glnWallPanelParametrics } from './wall-panel-parametrics'
import { GlnWallPanelNode } from './wall-panel-schema'

const wall = WallNode.parse({
  id: 'wall_definition',
  parentId: 'level_definition',
  start: [0, 0],
  end: [4, 0],
  height: 2.8,
  thickness: 0.2,
})

const panel = GlnWallPanelNode.parse({
  id: 'gln-wall-panel_definition',
  parentId: wall.id,
  wallId: wall.id,
  wallStart: wall.start,
  wallEnd: wall.end,
  systemId: 'gln-system_definition',
  position: [2, 1.25, 0.16],
})

describe('GLN wall-panel node definition', () => {
  test('is a normal editable wall-hosted terminal', () => {
    expect(glnWallPanelDefinition.kind).toBe('gln:wall-panel')
    expect(glnWallPanelDefinition.capabilities).toMatchObject({
      hostable: { parents: ['wall'], align: 'center' },
      selectable: { hitVolume: 'bbox' },
      movable: { axes: ['x'], gridSnap: true },
      deletable: true,
    })
    expect(glnWallPanelDefinition.distributionRole).toBe('terminal')
    expect(glnWallPanelDefinition.affordanceTools?.move).toBeFunction()
    expect(glnWallPanelDefinition.relations).toEqual({
      references: {
        systemId: ['gln:system'],
        wallId: ['wall'],
        zoneId: ['zone'],
      },
    })
    expect(GlnWallPanelNode.safeParse(glnWallPanelDefinition.defaults()).success).toBe(true)
  })

  test('builds only the panel body and its two local top connectors', () => {
    const geometry = buildGlnWallPanelGeometry(panel)
    const names: string[] = []
    geometry.traverse((child: Object3D) => names.push(child.name))

    expect(names).toContain('gln-wall-panel-body')
    expect(names).toContain('gln-wall-panel-supply')
    expect(names).toContain('gln-wall-panel-return')
    expect(names.some((name) => name.includes('pipe-run'))).toBe(false)

    const size = new Box3().setFromObject(geometry).getSize(new Vector3())
    expect(size.x).toBeCloseTo(0.9)
    expect(size.y).toBeGreaterThanOrEqual(2.5)
    expect(size.z).toBeGreaterThanOrEqual(0.12)
  })

  test('projects the wall-hosted panel into the floor plan', () => {
    const floorplan = buildGlnWallPanelFloorplan(panel, {
      resolve: (id: string) => (id === wall.id ? wall : undefined),
      viewState: { selected: true, highlighted: false, hovered: false },
    } as never)

    expect(floorplan).toMatchObject({
      kind: 'group',
      transform: { translate: [2, 0.16] },
    })
    expect(floorplan?.kind === 'group' ? floorplan.transform?.rotate : Number.NaN).toBeCloseTo(0)
    expect(floorplan?.kind === 'group' ? floorplan.children : []).toHaveLength(1)
  })

  test('resolves persisted ports without importing a live scene store', () => {
    const ports = glnWallPanelDefinition.ports?.(panel)
    expect(ports?.map((port) => port.id)).toEqual(['supply', 'return'])
    expect(ports?.[0]?.position[0]).toBeGreaterThan(
      ports?.[1]?.position[0] ?? Number.POSITIVE_INFINITY,
    )
  })

  test('ships mobile-readable Chinese inspector labels for editable dimensions', () => {
    const fields = glnWallPanelParametrics.groups.flatMap((group) => group.fields)
    expect(fields.find((field) => field.key === 'width')).toMatchObject({
      label: '面板宽度',
      unit: 'm',
    })
    expect(fields.find((field) => field.key === 'connectionDiameterIn')).toMatchObject({
      label: '接口管径',
      unit: '英寸',
    })
  })
})
