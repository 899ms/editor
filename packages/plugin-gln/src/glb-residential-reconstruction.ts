import {
  type AnyNode,
  type AnyNodeId,
  BuildingNode,
  CeilingNode,
  detectSpacesForLevel,
  LevelNode,
  SiteNode,
  WallNode,
  ZoneNode,
} from '@pascal-app/core'

export type GlbSourceIdentity = {
  path: string
  sha256: string
  sizeBytes: number
}

export type GlbBounds = {
  min: [number, number, number]
  max: [number, number, number]
}

export type GlbAnalyzedMesh = {
  id: string
  name: string
  bounds: GlbBounds
  triangleCount: number
  worldAxisAligned: boolean
}

export type GlbResidentialReviewReason =
  | 'ambiguous-geometry'
  | 'degenerate-geometry'
  | 'unsupported-semantic'

export type GlbResidentialReviewItem = {
  meshId: string
  name: string
  reason: GlbResidentialReviewReason
}

export type GlbResidentialConversionReport = {
  version: 1
  source: GlbSourceIdentity
  status: 'draft-ready' | 'report-only'
  minimumStructure: {
    satisfied: boolean
    missing: Array<'wall' | 'zone'>
  }
  geometry: {
    bounds: GlbBounds
    meshCount: number
    triangleCount: number
  }
  nodeCounts: {
    source: number
    highConfidence: number
    review: number
    draft: number
  }
  generated: {
    zones: number
    ceilings: number
  }
  reviewItems: GlbResidentialReviewItem[]
}

export type GlbResidentialSourceGraph = {
  nodes: Record<string, AnyNode>
  rootNodeIds: AnyNodeId[]
}

export type GlbResidentialReconstruction = {
  draft: GlbResidentialSourceGraph | null
  report: GlbResidentialConversionReport
}

const WALL_NAME = /(?:^|[\s_.-])wall(?:$|[\s_.-])/i
const MIN_WALL_LENGTH = 0.3
const MIN_WALL_HEIGHT = 1.8
const MAX_WALL_THICKNESS = 0.6
const AXIS_RATIO = 3
const JUNCTION_TOLERANCE = 0.16

function finiteBounds(bounds: GlbBounds) {
  return [...bounds.min, ...bounds.max].every(Number.isFinite)
}

function dimensions(bounds: GlbBounds): [number, number, number] {
  return [
    Math.abs(bounds.max[0] - bounds.min[0]),
    Math.abs(bounds.max[1] - bounds.min[1]),
    Math.abs(bounds.max[2] - bounds.min[2]),
  ]
}

function unionBounds(meshes: readonly GlbAnalyzedMesh[]): GlbBounds {
  if (meshes.length === 0) return { min: [0, 0, 0], max: [0, 0, 0] }
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const mesh of meshes) {
    for (const axis of [0, 1, 2] as const) {
      min[axis] = Math.min(min[axis], mesh.bounds.min[axis])
      max[axis] = Math.max(max[axis], mesh.bounds.max[axis])
    }
  }
  return { min, max }
}

function safeIdPart(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized.slice(0, 32) || 'mesh'
}

type WallCandidate = {
  mesh: GlbAnalyzedMesh
  start: [number, number]
  end: [number, number]
  height: number
  thickness: number
}

function wallCandidate(mesh: GlbAnalyzedMesh): WallCandidate | null {
  if (!mesh.worldAxisAligned || !finiteBounds(mesh.bounds)) return null
  const [width, height, depth] = dimensions(mesh.bounds)
  if (height < MIN_WALL_HEIGHT) return null
  const longAxis = Math.max(width, depth)
  const shortAxis = Math.min(width, depth)
  if (
    longAxis < MIN_WALL_LENGTH ||
    shortAxis <= 0.01 ||
    shortAxis > MAX_WALL_THICKNESS ||
    longAxis / shortAxis < AXIS_RATIO
  ) {
    return null
  }

  if (width >= depth) {
    const z = (mesh.bounds.min[2] + mesh.bounds.max[2]) / 2
    return {
      mesh,
      start: [mesh.bounds.min[0], z],
      end: [mesh.bounds.max[0], z],
      height,
      thickness: depth,
    }
  }
  const x = (mesh.bounds.min[0] + mesh.bounds.max[0]) / 2
  return {
    mesh,
    start: [x, mesh.bounds.min[2]],
    end: [x, mesh.bounds.max[2]],
    height,
    thickness: width,
  }
}

function snapWallJunctions(candidates: WallCandidate[]) {
  const points = candidates.flatMap((candidate) => [candidate.start, candidate.end])
  for (const point of points) {
    const close = points.filter(
      (candidate) =>
        Math.hypot(candidate[0] - point[0], candidate[1] - point[1]) <= JUNCTION_TOLERANCE,
    )
    if (close.length < 2) continue
    const center: [number, number] = [
      close.reduce((sum, candidate) => sum + candidate[0], 0) / close.length,
      close.reduce((sum, candidate) => sum + candidate[1], 0) / close.length,
    ]
    for (const candidate of close) {
      candidate[0] = center[0]
      candidate[1] = center[1]
    }
  }
}

function buildEditableGraph(candidates: WallCandidate[], source: GlbSourceIdentity) {
  const suffix = source.sha256.slice(0, 12)
  const site = SiteNode.parse({
    id: `site_glb_${suffix}`,
    name: 'GLB 重建场地',
    children: [],
    metadata: { source: 'glb-reconstruction', confidence: 'high' },
  })
  const building = BuildingNode.parse({
    id: `building_glb_${suffix}`,
    name: 'GLB 重建住宅',
    parentId: site.id,
    children: [],
    metadata: { source: 'glb-reconstruction', confidence: 'high' },
  })
  const level = LevelNode.parse({
    id: `level_glb_${suffix}`,
    name: '首层',
    level: 0,
    parentId: building.id,
    children: [],
    metadata: { source: 'glb-reconstruction', confidence: 'high' },
  })
  site.children = [building.id]
  building.children = [level.id]

  snapWallJunctions(candidates)
  const nodes: Record<string, AnyNode> = {
    [site.id]: site,
    [building.id]: building,
    [level.id]: level,
  }
  const wallIds: string[] = []
  for (const [index, candidate] of candidates.entries()) {
    const wall = WallNode.parse({
      id: `wall_glb_${safeIdPart(candidate.mesh.id)}_${index}`,
      name: candidate.mesh.name,
      parentId: level.id,
      start: candidate.start,
      end: candidate.end,
      height: candidate.height,
      thickness: candidate.thickness,
      metadata: {
        source: 'glb-reconstruction',
        confidence: 'high',
        glbSource: { meshId: candidate.mesh.id },
      },
    })
    nodes[wall.id] = wall
    wallIds.push(wall.id)
  }
  level.children = wallIds as typeof level.children

  let ceilings = 0
  let zones = 0
  const walls = wallIds.map((id) => nodes[id] as WallNode)
  const { spaces } = detectSpacesForLevel(level.id, walls)
  for (const [index, space] of spaces.entries()) {
    const zone = ZoneNode.parse({
      id: `zone_glb_${suffix}_${index}`,
      name: `可编辑空间 ${index + 1}`,
      parentId: level.id,
      polygon: space.polygon,
      autoFromWalls: true,
      boundaryWallIds: space.wallIds,
      metadata: { source: 'glb-reconstruction', confidence: 'high' },
    })
    const ceiling = CeilingNode.parse({
      id: `ceiling_glb_${suffix}_${index}`,
      name: `可编辑顶面 ${index + 1}`,
      parentId: level.id,
      polygon: space.polygon,
      height: Math.max(...walls.map((wall) => wall.height ?? 2.5)),
      autoFromWalls: true,
      metadata: { source: 'glb-reconstruction', confidence: 'high' },
    })
    nodes[zone.id] = zone
    nodes[ceiling.id] = ceiling
    level.children.push(zone.id, ceiling.id)
    zones += 1
    ceilings += 1
  }

  return {
    graph: {
      nodes,
      rootNodeIds: [site.id] as AnyNodeId[],
    },
    generated: { zones, ceilings },
  }
}

export function reconstructGlbResidential(
  meshes: readonly GlbAnalyzedMesh[],
  source: GlbSourceIdentity,
): GlbResidentialReconstruction {
  const candidates: WallCandidate[] = []
  const reviewItems: GlbResidentialReviewItem[] = []

  for (const mesh of meshes) {
    if (!finiteBounds(mesh.bounds) || mesh.triangleCount <= 0) {
      reviewItems.push({
        meshId: mesh.id,
        name: mesh.name || mesh.id,
        reason: 'degenerate-geometry',
      })
      continue
    }
    if (!WALL_NAME.test(mesh.name)) {
      reviewItems.push({
        meshId: mesh.id,
        name: mesh.name || mesh.id,
        reason: 'unsupported-semantic',
      })
      continue
    }
    const candidate = wallCandidate(mesh)
    if (!candidate) {
      reviewItems.push({
        meshId: mesh.id,
        name: mesh.name || mesh.id,
        reason: 'ambiguous-geometry',
      })
      continue
    }
    candidates.push(candidate)
  }

  const editable = buildEditableGraph(candidates, source)
  const missing: GlbResidentialConversionReport['minimumStructure']['missing'] = []
  if (candidates.length === 0) missing.push('wall')
  if (editable.generated.zones === 0) missing.push('zone')
  const minimumStructure = { satisfied: missing.length === 0, missing }
  const geometryBounds = unionBounds(meshes)
  const report: GlbResidentialConversionReport = {
    version: 1,
    source,
    status: minimumStructure.satisfied ? 'draft-ready' : 'report-only',
    minimumStructure,
    geometry: {
      bounds: geometryBounds,
      meshCount: meshes.length,
      triangleCount: meshes.reduce((sum, mesh) => sum + mesh.triangleCount, 0),
    },
    nodeCounts: {
      source: meshes.length,
      highConfidence: candidates.length,
      review: reviewItems.length,
      draft: minimumStructure.satisfied ? Object.keys(editable.graph.nodes).length : 0,
    },
    generated: editable.generated,
    reviewItems,
  }

  return {
    draft: minimumStructure.satisfied ? editable.graph : null,
    report,
  }
}

export async function hashGlbSource(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
