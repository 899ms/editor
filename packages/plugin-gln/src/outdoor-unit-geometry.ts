import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  Vector3,
} from 'three'
import { localGlnOutdoorUnitPorts } from './outdoor-unit-ports'
import type { GlnOutdoorUnitNode } from './outdoor-unit-schema'

const METERS_PER_INCH = 0.0254
const RADIAL_SEGMENTS = 32
const UP = new Vector3(0, 1, 0)

function material(color: string, metalness = 0.5, roughness = 0.45) {
  return new MeshStandardMaterial({ color, metalness, roughness })
}

/**
 * Parametric outdoor-unit geometry in the node-local frame. The origin is the
 * base center, +Z is the fan/front face, and +X is the hydronic service side.
 */
export function buildGlnOutdoorUnitGeometry(node: GlnOutdoorUnitNode): Group {
  const group = new Group()
  group.name = 'gln-outdoor-unit'

  const bodyColor = node.bodyColor
  const trimColor = node.finish === 'graphite' ? '#2f3438' : '#bcc3c9'
  const bodyMaterial = material(bodyColor, 0.55, 0.42)
  const trimMaterial = material(trimColor, 0.65, 0.35)
  const grilleMaterial = material(node.grilleColor, 0.7, 0.3)

  const body = new Mesh(new BoxGeometry(node.width, node.height, node.depth), bodyMaterial)
  body.name = 'gln-outdoor-body'
  body.position.y = node.height / 2
  group.add(body)

  const capHeight = Math.min(0.045, node.height * 0.06)
  for (const [name, y] of [
    ['gln-outdoor-base', capHeight / 2],
    ['gln-outdoor-top', node.height - capHeight / 2],
  ] as const) {
    const cap = new Mesh(
      new BoxGeometry(node.width * 1.025, capHeight, node.depth * 1.025),
      trimMaterial,
    )
    cap.name = name
    cap.position.y = y
    group.add(cap)
  }

  const fanRadius = Math.min(node.width * 0.34, node.height * 0.38)
  const fanY = node.height * 0.52
  const fanZ = node.depth / 2 + 0.008
  const throat = new Mesh(
    new CylinderGeometry(fanRadius, fanRadius, 0.025, RADIAL_SEGMENTS),
    grilleMaterial,
  )
  throat.name = 'gln-outdoor-fan-throat'
  throat.rotation.x = Math.PI / 2
  throat.position.set(0, fanY, fanZ)
  group.add(throat)

  const hub = new Mesh(
    new CylinderGeometry(fanRadius * 0.14, fanRadius * 0.14, 0.035, 20),
    trimMaterial,
  )
  hub.name = 'gln-outdoor-fan-hub'
  hub.rotation.x = Math.PI / 2
  hub.position.set(0, fanY, fanZ + 0.018)
  group.add(hub)

  for (let index = 0; index < 5; index++) {
    const angle = (index / 5) * Math.PI * 2
    const blade = new Mesh(new BoxGeometry(fanRadius * 0.58, fanRadius * 0.18, 0.012), trimMaterial)
    blade.name = `gln-outdoor-fan-blade-${index}`
    blade.position.set(
      Math.cos(angle) * fanRadius * 0.38,
      fanY + Math.sin(angle) * fanRadius * 0.38,
      fanZ + 0.02,
    )
    blade.rotation.z = angle
    group.add(blade)
  }

  const grille = new Group()
  grille.name = 'gln-outdoor-fan-grille'
  for (let index = 1; index <= 5; index++) {
    const ring = new Mesh(
      new TorusGeometry((fanRadius * index) / 5, 0.004, 6, RADIAL_SEGMENTS),
      grilleMaterial,
    )
    ring.name = `gln-outdoor-fan-ring-${index}`
    ring.position.set(0, fanY, fanZ + 0.042)
    grille.add(ring)
  }
  for (let index = 0; index < 8; index++) {
    const spoke = new Mesh(new BoxGeometry(fanRadius * 2, 0.005, 0.005), grilleMaterial)
    spoke.name = `gln-outdoor-fan-spoke-${index}`
    spoke.position.set(0, fanY, fanZ + 0.042)
    spoke.rotation.z = (index / 8) * Math.PI
    grille.add(spoke)
  }
  group.add(grille)

  const nominalRadius = (node.connectionDiameterIn * METERS_PER_INCH) / 2
  const connectorRadius = Math.max(0.012, nominalRadius)
  const connectorLength = Math.min(0.11, Math.max(0.055, node.depth * 0.18))
  const portMaterials = {
    supply: material('#e35d45', 0.65, 0.3),
    return: material('#178a9a', 0.65, 0.3),
  }
  for (const port of localGlnOutdoorUnitPorts(node)) {
    const connector = new Mesh(
      new CylinderGeometry(connectorRadius, connectorRadius, connectorLength, RADIAL_SEGMENTS),
      portMaterials[port.id],
    )
    connector.name = `gln-outdoor-port-${port.id}`
    connector.quaternion.setFromUnitVectors(UP, port.direction)
    connector.position.copy(port.position).addScaledVector(port.direction, connectorLength / 2)
    group.add(connector)
  }

  return group
}
