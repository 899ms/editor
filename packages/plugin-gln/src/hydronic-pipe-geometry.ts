import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import type { GlnHydronicPipeNode } from './hydronic-pipe-schema'

function section(from: Vector3, to: Vector3, radius: number, material: MeshStandardMaterial) {
  const length = from.distanceTo(to)
  if (length < 1e-5) return null
  const mesh = new Mesh(new CylinderGeometry(radius, radius, length, 16), material)
  mesh.position.copy(from).add(to).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize())
  return mesh
}

export function buildGlnHydronicPipeGeometry(node: GlnHydronicPipeNode): Group {
  const group = new Group()
  const materialMetalness =
    node.pipeMaterial === 'copper' || node.pipeMaterial === 'stainless-steel' ? 0.65 : 0.15
  const material = new MeshStandardMaterial({
    color: node.circuit === 'supply' ? '#e66a4e' : '#2c9dc0',
    metalness: materialMetalness,
    roughness: 0.42,
    transparent: node.concealed,
    opacity: node.concealed ? 0.7 : 1,
  })
  const radius = (node.diameterIn * 0.0254) / 2
  const insulationMaterial = new MeshStandardMaterial({
    color: '#d8dde0',
    metalness: 0,
    opacity: node.concealed ? 0.22 : 0.38,
    roughness: 0.85,
    transparent: true,
  })
  const points = node.path.map((point) => new Vector3(...point))
  for (let index = 0; index < points.length - 1; index++) {
    const mesh = section(points[index]!, points[index + 1]!, radius, material)
    if (mesh) group.add(mesh)
    if (node.insulationThicknessM > 0) {
      const jacket = section(
        points[index]!,
        points[index + 1]!,
        radius + node.insulationThicknessM,
        insulationMaterial,
      )
      if (jacket) {
        jacket.name = 'gln-hydronic-insulation'
        group.add(jacket)
      }
    }
  }
  for (let index = 1; index < points.length - 1; index++) {
    const joint = new Mesh(new SphereGeometry(radius * 1.15, 16, 12), material)
    joint.position.copy(points[index]!)
    group.add(joint)
    if (node.insulationThicknessM > 0) {
      const jacketJoint = new Mesh(
        new SphereGeometry((radius + node.insulationThicknessM) * 1.08, 16, 12),
        insulationMaterial,
      )
      jacketJoint.name = 'gln-hydronic-insulation-joint'
      jacketJoint.position.copy(points[index]!)
      group.add(jacketJoint)
    }
  }
  return group
}
