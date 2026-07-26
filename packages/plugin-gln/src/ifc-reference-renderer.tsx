'use client'

import type { IfcResidentialSourceGraph } from '@pascal-app/ifc-converter'
import { useEffect, useMemo } from 'react'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, Vector2 } from 'three'
import type { GlnIfcImportNode } from './ifc-import-schema'
import { useGlnIfcReferenceStore } from './ifc-reference-store'

function material() {
  return new MeshBasicMaterial({
    color: '#38bdf8',
    depthWrite: false,
    opacity: 0.18,
    transparent: true,
    wireframe: true,
  })
}

function polygonMesh(
  polygon: Array<[number, number]>,
  y: number,
  surfaceMaterial: MeshBasicMaterial,
) {
  const [first, ...rest] = polygon
  if (!first) return null
  const shape = new Shape([new Vector2(first[0], first[1]), ...rest.map((p) => new Vector2(...p))])
  const mesh = new Mesh(new ShapeGeometry(shape), surfaceMaterial)
  mesh.rotation.x = Math.PI / 2
  mesh.position.y = y
  return mesh
}

function buildReferenceGroup(graph: IfcResidentialSourceGraph) {
  const group = new Group()
  group.name = 'gln-ifc-reference-layer'
  const referenceMaterial = material()

  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'wall') {
      const length = Math.hypot(node.end[0] - node.start[0], node.end[1] - node.start[1])
      if (length < 0.1) continue
      const mesh = new Mesh(
        new BoxGeometry(length, node.height ?? 2.5, node.thickness ?? 0.1),
        referenceMaterial,
      )
      mesh.position.set(
        (node.start[0] + node.end[0]) / 2,
        (node.height ?? 2.5) / 2,
        (node.start[1] + node.end[1]) / 2,
      )
      mesh.rotation.y = -Math.atan2(node.end[1] - node.start[1], node.end[0] - node.start[0])
      group.add(mesh)
      continue
    }
    if (node.type === 'slab') {
      const mesh = polygonMesh(node.polygon, node.elevation, referenceMaterial)
      if (mesh) group.add(mesh)
      continue
    }
    if (node.type === 'ceiling') {
      const mesh = polygonMesh(node.polygon, node.height, referenceMaterial)
      if (mesh) group.add(mesh)
    }
  }
  return group
}

function disposeReferenceGroup(group: Group) {
  const materials = new Set<MeshBasicMaterial>()
  group.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const values = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const value of values) {
      if (value instanceof MeshBasicMaterial) materials.add(value)
    }
  })
  for (const value of materials) value.dispose()
}

export default function GlnIfcReferenceRenderer({ node }: { node: GlnIfcImportNode }) {
  const graph = useGlnIfcReferenceStore((state) => state.references[node.id])
  const group = useMemo(() => (graph ? buildReferenceGroup(graph) : null), [graph])
  useEffect(
    () => () => {
      if (group) disposeReferenceGroup(group)
    },
    [group],
  )

  if (!group) return null
  return <primitive object={group} visible={node.referenceVisible && node.visible !== false} />
}
