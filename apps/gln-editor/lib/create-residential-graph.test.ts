import { expect, test } from 'bun:test'
import { createResidentialGraph } from './create-residential-graph'

test('creates a consistent site, building, and level hierarchy', () => {
  const graph = createResidentialGraph()
  const [siteId] = graph.rootNodeIds
  const site = graph.nodes[siteId] as { children: string[]; parentId: string | null; type: string }
  const [buildingId] = site.children
  const building = graph.nodes[buildingId] as {
    children: string[]
    parentId: string | null
    type: string
  }
  const [levelId] = building.children
  const level = graph.nodes[levelId] as { parentId: string | null; type: string }

  expect(Object.keys(graph.nodes)).toHaveLength(3)
  expect(site.type).toBe('site')
  expect(site.parentId).toBeNull()
  expect(building.type).toBe('building')
  expect(building.parentId).toBe(siteId)
  expect(level.type).toBe('level')
  expect(level.parentId).toBe(buildingId)
})
