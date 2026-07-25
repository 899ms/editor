import { BuildingNode, LevelNode, SiteNode } from '@pascal-app/core'
import type { SceneGraph } from '@pascal-app/editor'

export function createResidentialGraph(): SceneGraph {
  const site = SiteNode.parse({
    children: [],
  })
  const building = BuildingNode.parse({
    children: [],
    parentId: site.id,
  })
  const level = LevelNode.parse({
    children: [],
    level: 0,
    parentId: building.id,
  })
  const linkedBuilding = BuildingNode.parse({
    ...building,
    children: [level.id],
  })
  const linkedSite = SiteNode.parse({
    ...site,
    children: [building.id],
  })

  return {
    nodes: {
      [linkedSite.id]: linkedSite,
      [linkedBuilding.id]: linkedBuilding,
      [level.id]: level,
    },
    rootNodeIds: [linkedSite.id],
  }
}
