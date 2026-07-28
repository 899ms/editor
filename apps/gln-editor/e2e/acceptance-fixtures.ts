import { writeFileSync } from 'node:fs'
import { WallNode } from '@pascal-app/core/schema'
import { createGlnConfigurationTestGraph } from '../lib/codex-tasks/gln-configuration-test-fixtures'

export type AcceptanceNode = Record<string, unknown> & {
  children?: string[]
  id: string
  metadata?: Record<string, unknown>
  parentId?: string | null
  systemId?: string
  type: string
}

export type AcceptanceGraph = {
  installedPlugins: string[]
  nodes: Record<string, AcceptanceNode>
  rootNodeIds: string[]
}

function cloneNodes(graph: { nodes: Record<string, unknown> }) {
  return structuredClone(graph.nodes) as Record<string, AcceptanceNode>
}

export function createTwoLevelTwoSystemGraph() {
  const lower = createGlnConfigurationTestGraph('acceptance_lower')
  const upper = createGlnConfigurationTestGraph('acceptance_upper')
  const nodes = cloneNodes(lower.graph)
  const upperNodes = cloneNodes(upper.graph)

  delete upperNodes[upper.ids.site]
  delete upperNodes[upper.ids.building]
  Object.assign(nodes, upperNodes)

  const site = nodes[lower.ids.site]!
  const building = nodes[lower.ids.building]!
  const lowerLevel = nodes[lower.ids.level]!
  const upperLevel = nodes[upper.ids.level]!
  site.children = [building.id]
  building.children = [lowerLevel.id, upperLevel.id]
  lowerLevel.name = '首层'
  lowerLevel.level = 0
  upperLevel.name = '二层'
  upperLevel.level = 1
  upperLevel.parentId = building.id

  const lowerSystem = nodes[lower.ids.system]!
  lowerSystem.name = '首层制冷系统'
  lowerSystem.mode = 'cooling'
  const upperSystem = nodes[upper.ids.system]!
  upperSystem.name = '二层制热系统'
  upperSystem.mode = 'heating'

  return {
    graph: {
      installedPlugins: ['pascal:gln'],
      nodes,
      rootNodeIds: [site.id, lowerSystem.id, upperSystem.id],
    } satisfies AcceptanceGraph,
    lower,
    upper,
  }
}

export function createLargeAcceptanceGraph() {
  const fixture = createTwoLevelTwoSystemGraph()
  const graph = structuredClone(fixture.graph)
  const levelIds = [fixture.lower.ids.level, fixture.upper.ids.level]
  let wallCount = 0

  for (const [levelIndex, levelId] of levelIds.entries()) {
    const level = graph.nodes[levelId]!
    const extraWallIds: string[] = []
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 16; column++) {
        const horizontal = WallNode.parse({
          id: `wall_perf_${levelIndex}_${row}_${column}_h`,
          name: `性能住宅墙体 ${wallCount + 1}`,
          parentId: levelId,
          start: [column * 0.7, 8 + row * 0.7],
          end: [column * 0.7 + 0.62, 8 + row * 0.7],
          height: 2.8,
          thickness: 0.12,
        })
        const vertical = WallNode.parse({
          id: `wall_perf_${levelIndex}_${row}_${column}_v`,
          name: `性能住宅墙体 ${wallCount + 2}`,
          parentId: levelId,
          start: [column * 0.7, 8 + row * 0.7],
          end: [column * 0.7, 8 + row * 0.7 + 0.62],
          height: 2.8,
          thickness: 0.12,
        })
        graph.nodes[horizontal.id] = horizontal as AcceptanceNode
        graph.nodes[vertical.id] = vertical as AcceptanceNode
        extraWallIds.push(horizontal.id, vertical.id)
        wallCount += 2
      }
    }
    level.children = [...(level.children ?? []), ...extraWallIds]
  }

  return {
    ...fixture,
    graph,
    measuredNodeId: fixture.lower.ids.outdoor,
    wallCount,
  }
}

function padToFour(bytes: Uint8Array, fill: number) {
  const paddedLength = Math.ceil(bytes.byteLength / 4) * 4
  const padded = new Uint8Array(paddedLength)
  padded.fill(fill)
  padded.set(bytes)
  return padded
}

export function writeSemanticResidenceGlb(filePath: string) {
  const positions = new Float32Array([
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
    0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  ])
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 4, 0,
    3, 4, 3, 7,
  ])
  const binary = new Uint8Array(positions.byteLength + indices.byteLength)
  binary.set(new Uint8Array(positions.buffer), 0)
  binary.set(new Uint8Array(indices.buffer), positions.byteLength)

  const nodes = [
    { name: 'Wall North', scale: [6, 2.8, 0.12], translation: [3, 1.4, 0.06] },
    { name: 'Wall East', scale: [0.12, 2.8, 4], translation: [5.94, 1.4, 2] },
    { name: 'Wall South', scale: [6, 2.8, 0.12], translation: [3, 1.4, 3.94] },
    { name: 'Wall West', scale: [0.12, 2.8, 4], translation: [0.06, 1.4, 2] },
  ].map((node) => ({ ...node, mesh: 0 }))
  const json = {
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 8,
        max: [0.5, 0.5, 0.5],
        min: [-0.5, -0.5, -0.5],
        type: 'VEC3',
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: 36,
        max: [7],
        min: [0],
        type: 'SCALAR',
      },
    ],
    asset: { generator: 'Pascal GLN acceptance fixture', version: '2.0' },
    bufferViews: [
      { buffer: 0, byteLength: positions.byteLength, byteOffset: 0, target: 34962 },
      {
        buffer: 0,
        byteLength: indices.byteLength,
        byteOffset: positions.byteLength,
        target: 34963,
      },
    ],
    buffers: [{ byteLength: binary.byteLength }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    nodes,
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
  }
  const jsonChunk = padToFour(new TextEncoder().encode(JSON.stringify(json)), 0x20)
  const binaryChunk = padToFour(binary, 0)
  const totalLength = 12 + 8 + jsonChunk.byteLength + 8 + binaryChunk.byteLength
  const glb = new Uint8Array(totalLength)
  const view = new DataView(glb.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, totalLength, true)
  view.setUint32(12, jsonChunk.byteLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  glb.set(jsonChunk, 20)
  const binaryHeader = 20 + jsonChunk.byteLength
  view.setUint32(binaryHeader, binaryChunk.byteLength, true)
  view.setUint32(binaryHeader + 4, 0x004e4942, true)
  glb.set(binaryChunk, binaryHeader + 8)
  writeFileSync(filePath, glb)
}
