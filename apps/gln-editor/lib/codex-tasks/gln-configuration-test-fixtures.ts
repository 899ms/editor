import { BuildingNode, LevelNode, SiteNode, WallNode, ZoneNode } from '@pascal-app/core/schema'
import type { SceneGraph } from '@pascal-app/editor'
import {
  collectGlnRoutingObstacles,
  GlnBufferTankNode,
  GlnHydronicPipeNode,
  GlnOutdoorUnitNode,
  GlnSystemNode,
  GlnWallPanelNode,
  getGlnBufferTankPorts,
  getGlnOutdoorUnitPorts,
  getGlnWallPanelPorts,
  planGlnConcealedRoute,
} from '@pascal-app/plugin-gln'

export function createGlnConfigurationTestGraph(prefix = 'config') {
  const site = SiteNode.parse({
    id: `site_${prefix}`,
    name: '住宅',
    children: [`building_${prefix}`],
  })
  const building = BuildingNode.parse({
    id: `building_${prefix}`,
    parentId: site.id,
    children: [`level_${prefix}`],
  })
  const level = LevelNode.parse({
    id: `level_${prefix}`,
    parentId: building.id,
    children: [],
  })
  const wallSpecs = [
    [`wall_${prefix}_north`, [0, 0], [12, 0]],
    [`wall_${prefix}_east`, [12, 0], [12, 6]],
    [`wall_${prefix}_south`, [12, 6], [0, 6]],
    [`wall_${prefix}_west`, [0, 6], [0, 0]],
  ] as const
  const walls = wallSpecs.map(([id, start, end]) =>
    WallNode.parse({
      id,
      parentId: level.id,
      children: [],
      start,
      end,
      height: 2.8,
      thickness: 0.2,
      frontSide: 'interior',
      backSide: 'exterior',
    }),
  )
  const boundaryWallIds = walls.map((wall) => wall.id)
  const zones = [
    ZoneNode.parse({
      id: `zone_${prefix}_outdoor`,
      name: '室外设备区',
      parentId: level.id,
      polygon: [
        [0.3, 0.3],
        [3.7, 0.3],
        [3.7, 3.7],
        [0.3, 3.7],
      ],
      boundaryWallIds,
    }),
    ZoneNode.parse({
      id: `zone_${prefix}_equipment`,
      name: '设备间',
      parentId: level.id,
      polygon: [
        [4.1, 0.3],
        [7.5, 0.3],
        [7.5, 3.7],
        [4.1, 3.7],
      ],
      boundaryWallIds,
    }),
    ZoneNode.parse({
      id: `zone_${prefix}_living`,
      name: '客厅',
      parentId: level.id,
      polygon: [
        [7.8, 0.1],
        [11.7, 0.1],
        [11.7, 5.7],
        [7.8, 5.7],
      ],
      boundaryWallIds,
    }),
  ]
  const [outdoorZone, equipmentZone, livingZone] = zones
  if (!(outdoorZone && equipmentZone && livingZone)) throw new Error('missing fixture zones')

  const system = GlnSystemNode.parse({
    id: `gln-system_${prefix}`,
    name: '住宅主系统',
    zoneSettings: {
      [livingZone.id]: {
        targetTemperature: 24,
        targetTemperatureSource: 'template',
        targetHumidity: 50,
        targetHumiditySource: 'template',
        enabled: true,
      },
    },
  })
  const outdoor = GlnOutdoorUnitNode.parse({
    id: `gln-outdoor-unit_${prefix}`,
    parentId: level.id,
    systemId: system.id,
    position: [1.5, 0, 1.5],
    installationAreaZoneId: outdoorZone.id,
    installationAreaKind: 'outdoor-equipment-area',
  })
  const tank = GlnBufferTankNode.parse({
    id: `gln-buffer-tank_${prefix}`,
    parentId: level.id,
    systemId: system.id,
    position: [5.5, 0, 1.5],
    installationAreaZoneId: equipmentZone.id,
    installationAreaKind: 'equipment-room',
  })
  const hostWall = walls[0]!
  const panel = GlnWallPanelNode.parse({
    id: `gln-wall-panel_${prefix}`,
    parentId: hostWall.id,
    systemId: system.id,
    wallId: hostWall.id,
    wallStart: hostWall.start,
    wallEnd: hostWall.end,
    position: [9.5, 1.25, 0.16],
    zoneId: livingZone.id,
  })
  const links = [
    [
      `gln-hydronic-pipe_${prefix}_source-supply`,
      'supply',
      outdoor.id,
      'supply',
      tank.id,
      'source-supply',
    ],
    [
      `gln-hydronic-pipe_${prefix}_source-return`,
      'return',
      tank.id,
      'source-return',
      outdoor.id,
      'return',
    ],
    [
      `gln-hydronic-pipe_${prefix}_load-supply`,
      'supply',
      tank.id,
      'load-supply',
      panel.id,
      'supply',
    ],
    [
      `gln-hydronic-pipe_${prefix}_load-return`,
      'return',
      panel.id,
      'return',
      tank.id,
      'load-return',
    ],
  ] as const
  const equipmentById = Object.fromEntries([outdoor, tank, panel].map((node) => [node.id, node]))
  const portPosition = (nodeId: string, portId: string) => {
    const owner = equipmentById[nodeId]
    if (!owner) throw new Error(`missing fixture equipment ${nodeId}`)
    const ports =
      owner.type === 'gln:outdoor-unit'
        ? getGlnOutdoorUnitPorts(owner)
        : owner.type === 'gln:buffer-tank'
          ? getGlnBufferTankPorts(owner)
          : getGlnWallPanelPorts(owner)
    const port = ports.find((candidate) => candidate.id === portId)
    if (!port) throw new Error(`missing fixture port ${nodeId}:${portId}`)
    return [...port.position] as [number, number, number]
  }
  const routingObstacles = collectGlnRoutingObstacles({
    [outdoor.id]: outdoor,
    [tank.id]: tank,
    [panel.id]: panel,
  } as never)
  const pipes = links.map(([id, circuit, startNodeId, startPortId, endNodeId, endPortId]) => {
    const route = planGlnConcealedRoute({
      start: portPosition(startNodeId, startPortId),
      end: portPosition(endNodeId, endPortId),
      startNodeId,
      endNodeId,
      startLevelId: level.id,
      endLevelId: level.id,
      obstacles: routingObstacles,
    })
    return GlnHydronicPipeNode.parse({
      id,
      parentId: level.id,
      systemId: system.id,
      circuit,
      path: route.path,
      start: { nodeId: startNodeId, portId: startPortId },
      end: { nodeId: endNodeId, portId: endPortId },
      routing: route.routing,
    })
  })

  hostWall.children = [panel.id] as unknown as typeof hostWall.children
  level.children = [
    ...walls.map((wall) => wall.id),
    ...zones.map((zone) => zone.id),
    outdoor.id,
    tank.id,
    ...pipes.map((pipe) => pipe.id),
  ] as typeof level.children
  const residentialNodes = [site, building, level, ...walls, ...zones]
  const residentialOnlyNodes = residentialNodes.map((node) => {
    const clone = structuredClone(node) as typeof node & { children?: string[] }
    if (Array.isArray(clone.children)) {
      clone.children = clone.children.filter((id) => !id.startsWith('gln-'))
    }
    return clone
  })
  const glnNodes = [system, outdoor, tank, panel, ...pipes]
  const graph = {
    nodes: Object.fromEntries([...residentialNodes, ...glnNodes].map((node) => [node.id, node])),
    rootNodeIds: [site.id, system.id],
  } as unknown as SceneGraph

  return {
    graph,
    residentialGraph: {
      nodes: Object.fromEntries(residentialOnlyNodes.map((node) => [node.id, node])),
      rootNodeIds: [site.id],
    } as unknown as SceneGraph,
    ids: {
      site: site.id,
      building: building.id,
      level: level.id,
      walls: walls.map((wall) => wall.id),
      outdoorZone: outdoorZone.id,
      equipmentZone: equipmentZone.id,
      livingZone: livingZone.id,
      system: system.id,
      outdoor: outdoor.id,
      tank: tank.id,
      panel: panel.id,
      pipes: pipes.map((pipe) => pipe.id),
    },
    glnNodes,
  }
}
