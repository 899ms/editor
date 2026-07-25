import { describe, expect, test } from 'bun:test'
import {
  type AnyNode,
  type AnyNodeId,
  DoorNode,
  WallNode,
  WindowNode,
  ZoneNode,
} from '@pascal-app/core'
import { buildWallPanelHostPatch, resolveWallPanelTarget } from './wall-panel-installation'
import { getGlnWallPanelPorts, localGlnWallPanelPorts } from './wall-panel-ports'
import { GlnWallPanelNode } from './wall-panel-schema'
import { resolveWallPanelZone } from './wall-panel-zone'
import { preservesManualWallPanelZone } from './wall-panel-zone-system'

const wall = WallNode.parse({
  id: 'wall_test',
  parentId: 'level_test',
  start: [0, 0],
  end: [4, 0],
  height: 2.8,
  thickness: 0.2,
  children: [],
})

const panel = (patch: Partial<GlnWallPanelNode> = {}) =>
  GlnWallPanelNode.parse({
    systemId: 'gln-system_test',
    wallId: wall.id,
    parentId: wall.id,
    wallStart: wall.start,
    wallEnd: wall.end,
    ...patch,
  })

describe('GLN wall-panel installation', () => {
  test('uses editable 0.9 x 2.5 x 0.12 metre defaults', () => {
    expect(panel()).toMatchObject({ width: 0.9, height: 2.5, depth: 0.12 })
  })

  test('clamps inside a straight wall and rejects door or window overlap', () => {
    const door = DoorNode.parse({
      id: 'door_test',
      parentId: wall.id,
      wallId: wall.id,
      position: [2, 1, 0],
      width: 0.9,
      height: 2,
    })
    const window = WindowNode.parse({
      id: 'window_test',
      parentId: wall.id,
      wallId: wall.id,
      position: [3, 1.5, 0],
      width: 0.8,
      height: 1.2,
    })
    const nodes = {
      [wall.id]: { ...wall, children: [door.id, window.id] },
      [door.id]: door,
      [window.id]: window,
    } as unknown as Record<AnyNodeId, AnyNode>

    expect(
      resolveWallPanelTarget({
        wall: nodes[wall.id] as typeof wall,
        nodes,
        localX: 0,
        side: 'front',
        width: 0.9,
        height: 2.5,
        depth: 0.12,
      }),
    ).toMatchObject({ position: [0.45, 1.25, 0.16], valid: true, reason: 'ok' })

    expect(
      resolveWallPanelTarget({
        wall: nodes[wall.id] as typeof wall,
        nodes,
        localX: 2,
        side: 'front',
        width: 0.9,
        height: 2.5,
        depth: 0.12,
      }),
    ).toMatchObject({ valid: false, reason: 'opening-overlap' })

    expect(
      resolveWallPanelTarget({
        wall: nodes[wall.id] as typeof wall,
        nodes,
        localX: 3,
        side: 'front',
        width: 0.9,
        height: 2.5,
        depth: 0.12,
      }),
    ).toMatchObject({ valid: false, reason: 'opening-overlap' })
  })

  test('rejects a wall that cannot contain the default panel', () => {
    const shortWall = WallNode.parse({
      ...wall,
      id: 'wall_short',
      end: [0.8, 0],
    })
    expect(
      resolveWallPanelTarget({
        wall: shortWall,
        nodes: { [shortWall.id]: shortWall } as unknown as Record<AnyNodeId, AnyNode>,
        localX: 0.4,
        side: 'front',
        width: 0.9,
        height: 2.5,
        depth: 0.12,
      }),
    ).toMatchObject({ valid: false, reason: 'too-small' })
  })
})

describe('GLN wall-panel local ports', () => {
  test('keeps supply on local left and return on local right after a side flip', () => {
    const front = panel({ side: 'front', position: [2, 1.25, 0.16] })
    const back = panel({
      side: 'back',
      position: [2, 1.25, -0.16],
      rotation: [0, Math.PI, 0],
    })

    expect(localGlnWallPanelPorts(front).map(({ id, localX }) => [id, localX])).toEqual([
      ['supply', 0.45],
      ['return', -0.45],
    ])
    expect(getGlnWallPanelPorts(front, wall).map((port) => port.position[0])).toEqual([2.45, 1.55])
    expect(getGlnWallPanelPorts(back, wall).map((port) => port.position[0])).toEqual([1.55, 2.45])
  })
})

describe('GLN wall-panel zone ownership', () => {
  const frontZone = ZoneNode.parse({
    id: 'zone_front',
    parentId: 'level_test',
    name: '南侧房间',
    polygon: [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ],
  })
  const backZone = ZoneNode.parse({
    id: 'zone_back',
    parentId: 'level_test',
    name: '北侧房间',
    polygon: [
      [0, 0],
      [0, -3],
      [4, -3],
      [4, 0],
    ],
  })

  test('recomputes the served zone from the wall face', () => {
    const nodes = {
      [wall.id]: wall,
      [frontZone.id]: frontZone,
      [backZone.id]: backZone,
    } as unknown as Record<AnyNodeId, AnyNode>
    expect(resolveWallPanelZone({ wall, side: 'front', localX: 2, nodes })).toMatchObject({
      status: 'resolved',
      zoneId: frontZone.id,
    })
    expect(resolveWallPanelZone({ wall, side: 'back', localX: 2, nodes })).toMatchObject({
      status: 'resolved',
      zoneId: backZone.id,
    })
  })

  test('rehosts onto another wall, recomputes Zone, and preserves local left/right ports', () => {
    const nextWall = WallNode.parse({
      id: 'wall_rehost',
      parentId: 'level_test',
      start: [6, 0],
      end: [6, 4],
      height: 2.8,
      thickness: 0.2,
      children: [],
    })
    const nextZone = ZoneNode.parse({
      id: 'zone_rehost',
      parentId: 'level_test',
      name: '书房',
      polygon: [
        [3, 0],
        [6, 0],
        [6, 4],
        [3, 4],
      ],
    })
    const nodes = {
      [nextWall.id]: nextWall,
      [nextZone.id]: nextZone,
    } as unknown as Record<AnyNodeId, AnyNode>
    const target = resolveWallPanelTarget({
      wall: nextWall,
      nodes,
      localX: 2,
      side: 'front',
      width: 0.9,
      height: 2.5,
      depth: 0.12,
    })

    expect(target.valid).toBe(true)
    const patch = buildWallPanelHostPatch(target, nodes)
    expect(patch).toMatchObject({
      parentId: nextWall.id,
      wallId: nextWall.id,
      wallStart: nextWall.start,
      wallEnd: nextWall.end,
      zoneAssignment: 'auto',
      zoneId: nextZone.id,
    })

    const ports = getGlnWallPanelPorts(panel(patch), nextWall)
    expect(ports.map((port) => port.id)).toEqual(['supply', 'return'])
    expect(ports[0]?.position[2]).toBeGreaterThan(ports[1]?.position[2] ?? Number.POSITIVE_INFINITY)
  })

  test('returns every candidate instead of silently choosing an ambiguous zone', () => {
    const overlapping = ZoneNode.parse({
      id: 'zone_overlap',
      parentId: 'level_test',
      name: '重叠房间',
      polygon: frontZone.polygon,
    })
    const nodes = {
      [wall.id]: wall,
      [frontZone.id]: frontZone,
      [overlapping.id]: overlapping,
    } as unknown as Record<AnyNodeId, AnyNode>
    expect(resolveWallPanelZone({ wall, side: 'front', localX: 2, nodes })).toEqual({
      status: 'ambiguous',
      zoneId: null,
      candidateIds: [frontZone.id, overlapping.id],
    })
  })

  test('preserves an explicit candidate choice until the panel changes host or side', () => {
    expect(
      preservesManualWallPanelZone(panel({ zoneAssignment: 'manual', zoneId: frontZone.id }), [
        frontZone.id,
        'zone_other',
      ]),
    ).toBe(true)
    expect(
      preservesManualWallPanelZone(panel({ zoneAssignment: 'manual', zoneId: frontZone.id }), [
        backZone.id,
      ]),
    ).toBe(false)
  })
})
