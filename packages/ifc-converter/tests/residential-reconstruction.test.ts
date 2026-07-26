import { describe, expect, test } from 'bun:test'
import {
  BuildingNode,
  DoorNode,
  LevelNode,
  RoofNode,
  SiteNode,
  SlabNode,
  WallNode,
  WindowNode,
} from '@pascal-app/core'
import { hashIfcSource, type PascalSceneGraph, reconstructIfcResidential } from '../src'

function residentialSource(): PascalSceneGraph {
  const site = SiteNode.parse({ id: 'site_ifc', type: 'site', children: ['building_ifc'] })
  const building = BuildingNode.parse({
    id: 'building_ifc',
    type: 'building',
    parentId: site.id,
    children: ['level_ifc'],
  })
  const level = LevelNode.parse({
    id: 'level_ifc',
    type: 'level',
    parentId: building.id,
    children: ['wall_north', 'wall_east', 'wall_south', 'wall_west', 'slab_ifc', 'roof_ifc'],
  })
  const wall = (
    id: `wall_${string}`,
    start: [number, number],
    end: [number, number],
    children: string[] = [],
  ) =>
    WallNode.parse({
      id,
      type: 'wall',
      parentId: level.id,
      start,
      end,
      height: 2.8,
      thickness: 0.18,
      children,
      metadata: {
        ifcType: 'IFCWALLSTANDARDCASE',
        expressID: 42,
        globalId: 'ifc-global-wall',
        properties: { Pset_WallCommon: { IsExternal: true } },
      },
    })

  const north = wall('wall_north', [0, 0], [6, 0], ['door_ifc', 'window_ifc'])
  const door = DoorNode.parse({
    id: 'door_ifc',
    type: 'door',
    parentId: north.id,
    width: 0.9,
    height: 2.1,
    position: [1.5, 1.05, 0],
  })
  const window = WindowNode.parse({
    id: 'window_ifc',
    type: 'window',
    parentId: north.id,
    width: 1.2,
    height: 1.2,
    position: [4, 1.5, 0],
  })
  const slab = SlabNode.parse({
    id: 'slab_ifc',
    type: 'slab',
    parentId: level.id,
    polygon: [
      [0, 0],
      [6, 0],
      [6, 4],
      [0, 4],
    ],
  })
  const roof = RoofNode.parse({
    id: 'roof_ifc',
    type: 'roof',
    parentId: level.id,
    metadata: {
      ifcType: 'IFCROOF',
      polygon: [
        [0, 0],
        [6, 0],
        [6, 4],
        [0, 4],
      ],
    },
  })

  return {
    nodes: {
      [site.id]: site,
      [building.id]: building,
      [level.id]: level,
      [north.id]: north,
      wall_east: wall('wall_east', [6, 0], [6, 4]),
      wall_south: wall('wall_south', [6, 4], [0, 4]),
      wall_west: wall('wall_west', [0, 4], [0, 0]),
      [door.id]: door,
      [window.id]: window,
      [slab.id]: slab,
      [roof.id]: roof,
    },
    rootNodeIds: [site.id],
  }
}

describe('IFC residential reconstruction', () => {
  test('builds a normal editable residential draft with inferred Zone and ceiling nodes', () => {
    const result = reconstructIfcResidential(residentialSource(), {
      path: 'C:/models/home.ifc',
      sha256: 'abc123',
      sizeBytes: 2048,
    })

    expect(result.report.status).toBe('draft-ready')
    expect(result.report.minimumStructure.satisfied).toBe(true)
    expect(result.draft).not.toBeNull()
    const nodes = Object.values(result.draft!.nodes)
    expect(nodes.some((node) => node.type === 'zone')).toBe(true)
    expect(nodes.some((node) => node.type === 'ceiling')).toBe(true)
    expect(nodes.some((node) => node.type === 'roof')).toBe(true)
    expect(nodes.some((node) => node.type === 'door')).toBe(true)
    expect(nodes.some((node) => node.type === 'window')).toBe(true)

    const wall = result.draft!.nodes.wall_north!
    expect(wall.metadata).toEqual({
      ifcSource: {
        expressID: 42,
        globalId: 'ifc-global-wall',
        ifcType: 'IFCWALLSTANDARDCASE',
      },
    })
    expect(JSON.stringify(result.draft)).not.toContain('Pset_WallCommon')
  })

  test('keeps invalid or unsupported results out of the editable draft and in review', () => {
    const source = residentialSource()
    source.nodes.wall_invalid = WallNode.parse({
      id: 'wall_invalid',
      type: 'wall',
      parentId: 'level_ifc',
      start: [1, 1],
      end: [1, 1],
    })
    ;(source.nodes.level_ifc as { children: string[] }).children.push('wall_invalid')
    source.nodes.item_ifc = {
      id: 'item_ifc',
      object: 'node',
      type: 'item',
      parentId: 'level_ifc',
      visible: true,
      metadata: { ifcType: 'IFCFURNISHINGELEMENT', expressID: 99 },
    } as never

    const result = reconstructIfcResidential(source, {
      path: 'home.ifc',
      sha256: 'abc123',
      sizeBytes: 2048,
    })

    expect(result.draft?.nodes.wall_invalid).toBeUndefined()
    expect(result.draft?.nodes.item_ifc).toBeUndefined()
    expect(result.report.reviewItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeId: 'wall_invalid', reason: 'invalid-geometry' }),
        expect.objectContaining({ nodeId: 'item_ifc', reason: 'unsupported-kind' }),
      ]),
    )
  })

  test('returns only a report when the minimum residential structure is not closed', () => {
    const source = residentialSource()
    delete source.nodes.wall_west
    ;(source.nodes.level_ifc as { children: string[] }).children = (
      source.nodes.level_ifc as { children: string[] }
    ).children.filter((id) => id !== 'wall_west')

    const result = reconstructIfcResidential(source, {
      path: 'open-shell.ifc',
      sha256: 'def456',
      sizeBytes: 1024,
    })

    expect(result.draft).toBeNull()
    expect(result.report.status).toBe('report-only')
    expect(result.report.minimumStructure.missing).toContain('zone')
    expect(result.report.source).toEqual({
      path: 'open-shell.ifc',
      sha256: 'def456',
      sizeBytes: 1024,
    })
  })

  test('hashes local IFC bytes without uploading them', async () => {
    const hash = await hashIfcSource(new TextEncoder().encode('abc'))
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
