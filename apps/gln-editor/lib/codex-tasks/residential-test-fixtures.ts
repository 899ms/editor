import { BuildingNode, LevelNode, SiteNode, WallNode, ZoneNode } from '@pascal-app/core/schema'
import type { SceneGraph } from '@pascal-app/editor'

export function createResidentialTestGraph(prefix: string): {
  graph: SceneGraph
  levelId: string
  wallId: string
} {
  const site = SiteNode.parse({
    id: `site_${prefix}`,
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
    [`wall_${prefix}_north`, [0, 0], [4, 0]],
    [`wall_${prefix}_east`, [4, 0], [4, 3]],
    [`wall_${prefix}_south`, [4, 3], [0, 3]],
    [`wall_${prefix}_west`, [0, 3], [0, 0]],
  ] as const
  const walls = wallSpecs.map(([id, start, end]) =>
    WallNode.parse({
      id,
      parentId: level.id,
      start,
      end,
      height: 2.8,
      thickness: 0.2,
      frontSide: 'interior',
      backSide: 'exterior',
      metadata: { source: 'codex-residential', confidence: 'high' },
    }),
  )
  const zone = ZoneNode.parse({
    id: `zone_${prefix}`,
    name: '测试空间',
    parentId: level.id,
    polygon: [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ],
    autoFromWalls: true,
    boundaryWallIds: walls.map((wall) => wall.id),
    metadata: { source: 'codex-residential', confidence: 'high' },
  })
  level.children = [...walls.map((wall) => wall.id), zone.id] as typeof level.children
  const nodes = Object.fromEntries(
    [site, building, level, ...walls, zone].map((node) => [node.id, node]),
  )

  return {
    graph: { nodes, rootNodeIds: [site.id] },
    levelId: level.id,
    wallId: walls[0]!.id,
  }
}
