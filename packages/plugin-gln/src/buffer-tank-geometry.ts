import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import { localGlnBufferTankPorts } from './buffer-tank-ports'
import type { GlnBufferTankNode } from './buffer-tank-schema'
import { addGlnEquipmentClearance } from './equipment-clearance-geometry'

const METERS_PER_INCH = 0.0254
const RADIAL_SEGMENTS = 40
const UP = new Vector3(0, 1, 0)

function material(
  color: string,
  options: { metalness?: number; opacity?: number; roughness?: number } = {},
) {
  const opacity = options.opacity ?? 1
  return new MeshStandardMaterial({
    color,
    metalness: options.metalness ?? 0.4,
    opacity,
    roughness: options.roughness ?? 0.45,
    transparent: opacity < 1,
  })
}

export function buildGlnBufferTankGeometry(node: GlnBufferTankNode): Group {
  const group = new Group()
  group.name = 'gln-buffer-tank'

  const radius = node.diameter / 2
  const jacket = new Mesh(
    new CylinderGeometry(radius, radius, node.height, RADIAL_SEGMENTS),
    material(node.jacketColor, {
      metalness: node.finish === 'graphite' ? 0.65 : 0.45,
      opacity: node.stratificationView ? 0.72 : 1,
      roughness: node.finish === 'graphite' ? 0.34 : 0.46,
    }),
  )
  jacket.name = 'gln-buffer-tank-jacket'
  jacket.position.y = node.height / 2
  group.add(jacket)

  if (node.stratificationView) {
    const layerHeight = node.height * 0.44
    const layerRadius = Math.max(0.01, radius - node.insulationThickness)
    const warm = new Mesh(
      new CylinderGeometry(layerRadius, layerRadius, layerHeight, RADIAL_SEGMENTS),
      material('#e85f45', { opacity: 0.72, roughness: 0.55 }),
    )
    warm.name = 'gln-buffer-tank-stratification-warm'
    warm.position.y = node.height * 0.74
    group.add(warm)

    const cool = new Mesh(
      new CylinderGeometry(layerRadius, layerRadius, layerHeight, RADIAL_SEGMENTS),
      material('#2398b4', { opacity: 0.72, roughness: 0.55 }),
    )
    cool.name = 'gln-buffer-tank-stratification-cool'
    cool.position.y = node.height * 0.26
    group.add(cool)
  }

  const trimColor = node.finish === 'graphite' ? '#2f3438' : '#9ca7ad'
  const trimMaterial = material(trimColor, { metalness: 0.7, roughness: 0.3 })
  for (const [name, y] of [
    ['gln-buffer-tank-base', 0.025],
    ['gln-buffer-tank-top', node.height - 0.025],
  ] as const) {
    const cap = new Mesh(
      new CylinderGeometry(radius * 1.025, radius * 1.025, 0.05, RADIAL_SEGMENTS),
      trimMaterial,
    )
    cap.name = name
    cap.position.y = y
    group.add(cap)
  }

  const connectorRadius = Math.max(0.012, (node.connectionDiameterIn * METERS_PER_INCH) / 2)
  const connectorLength = Math.min(0.12, Math.max(0.055, node.diameter * 0.16))
  for (const port of localGlnBufferTankPorts(node)) {
    const connector = new Mesh(
      new CylinderGeometry(connectorRadius, connectorRadius, connectorLength, 24),
      material(port.id.includes('supply') ? '#e35d45' : '#178a9a', {
        metalness: 0.65,
        roughness: 0.3,
      }),
    )
    connector.name = `gln-buffer-tank-port-${port.id}`
    connector.quaternion.setFromUnitVectors(UP, port.direction)
    connector.position.copy(port.position).addScaledVector(port.direction, connectorLength / 2)
    group.add(connector)
  }

  const vent = new Mesh(new SphereGeometry(radius * 0.055, 16, 10), trimMaterial)
  vent.name = 'gln-buffer-tank-vent'
  vent.position.y = node.height - radius * 0.055
  group.add(vent)

  addGlnEquipmentClearance(group, {
    width: node.diameter,
    height: node.height,
    depth: node.diameter,
    clearanceFront: node.clearanceFront,
    clearanceBack: node.clearanceBack,
    clearanceLeft: node.clearanceLeft,
    clearanceRight: node.clearanceRight,
    clearanceTop: node.clearanceTop,
  })

  return group
}
