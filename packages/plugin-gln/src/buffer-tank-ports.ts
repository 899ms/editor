import type { NodePort } from '@pascal-app/core'
import { Vector3 } from 'three'
import type { GlnBufferTankNode } from './buffer-tank-schema'

type BufferTankPortId = 'source-supply' | 'source-return' | 'load-supply' | 'load-return'

type LocalBufferTankPort = {
  id: BufferTankPortId
  position: Vector3
  direction: Vector3
  system: 'gln:source-supply' | 'gln:source-return' | 'gln:load-supply' | 'gln:load-return'
}

const UP = new Vector3(0, 1, 0)

export function localGlnBufferTankPorts(node: GlnBufferTankNode): LocalBufferTankPort[] {
  const radius = node.diameter / 2
  const upper = node.height * 0.72
  const lower = node.height * 0.28

  return [
    {
      id: 'source-supply',
      position: new Vector3(-radius, upper, 0),
      direction: new Vector3(-1, 0, 0),
      system: 'gln:source-supply',
    },
    {
      id: 'source-return',
      position: new Vector3(-radius, lower, 0),
      direction: new Vector3(-1, 0, 0),
      system: 'gln:source-return',
    },
    {
      id: 'load-supply',
      position: new Vector3(radius, upper, 0),
      direction: new Vector3(1, 0, 0),
      system: 'gln:load-supply',
    },
    {
      id: 'load-return',
      position: new Vector3(radius, lower, 0),
      direction: new Vector3(1, 0, 0),
      system: 'gln:load-return',
    },
  ]
}

export function getGlnBufferTankPorts(node: GlnBufferTankNode): NodePort[] {
  const offset = new Vector3(...node.position)
  const yaw = node.rotation[1]

  return localGlnBufferTankPorts(node).map((port) => {
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
