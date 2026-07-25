import type { NodePort } from '@pascal-app/core'
import { Vector3 } from 'three'
import type { GlnOutdoorUnitNode } from './outdoor-unit-schema'

type LocalHydronicPort = {
  id: 'supply' | 'return'
  position: Vector3
  direction: Vector3
  system: 'gln:source-supply' | 'gln:source-return'
}

const UP = new Vector3(0, 1, 0)

/**
 * Connection centers in the unit-local frame. Both leave the right service
 * face; separating them vertically and fore/aft keeps the two connections
 * visually and mechanically distinguishable without embedding any pipe run.
 */
export function localGlnOutdoorUnitPorts(node: GlnOutdoorUnitNode): LocalHydronicPort[] {
  return [
    {
      id: 'supply',
      position: new Vector3(node.width / 2, node.height * 0.58, node.depth * 0.18),
      direction: new Vector3(1, 0, 0),
      system: 'gln:source-supply',
    },
    {
      id: 'return',
      position: new Vector3(node.width / 2, node.height * 0.32, -node.depth * 0.18),
      direction: new Vector3(1, 0, 0),
      system: 'gln:source-return',
    },
  ]
}

export function getGlnOutdoorUnitPorts(node: GlnOutdoorUnitNode): NodePort[] {
  const offset = new Vector3(...node.position)
  const yaw = node.rotation[1]

  return localGlnOutdoorUnitPorts(node).map((port) => {
    const position = port.position.clone().applyAxisAngle(UP, yaw).add(offset)
    const direction = port.direction.clone().applyAxisAngle(UP, yaw).normalize()
    return {
      id: port.id,
      position: [position.x, position.y, position.z] as const,
      direction: [direction.x, direction.y, direction.z] as const,
      diameter: node.connectionDiameterIn,
      system: port.system,
      shape: 'round' as const,
    }
  })
}
