import type { NodePort, WallNode } from '@pascal-app/core'
import { Vector3 } from 'three'
import type { GlnWallPanelNode } from './wall-panel-schema'

export function localGlnWallPanelPorts(node: GlnWallPanelNode) {
  return [
    {
      id: 'supply',
      localX: node.width / 2,
      system: 'gln:supply-water' as const,
    },
    {
      id: 'return',
      localX: -node.width / 2,
      system: 'gln:return-water' as const,
    },
  ]
}

export function getGlnWallPanelPorts(node: GlnWallPanelNode, wall?: WallNode): NodePort[] {
  const wallStart = wall?.start ?? node.wallStart
  const wallEnd = wall?.end ?? node.wallEnd
  const dx = wallEnd[0] - wallStart[0]
  const dz = wallEnd[1] - wallStart[1]
  const length = Math.hypot(dx, dz)
  if (length < 1e-6) return []
  const dir = new Vector3(dx / length, 0, dz / length)
  const normal = new Vector3(-dir.z, 0, dir.x).multiplyScalar(node.side === 'front' ? 1 : -1)
  const center = new Vector3(
    wallStart[0] + dir.x * node.position[0] + normal.x * Math.abs(node.position[2]),
    node.position[1],
    wallStart[1] + dir.z * node.position[0] + normal.z * Math.abs(node.position[2]),
  )
  const localLeft = dir.clone().multiplyScalar(node.side === 'front' ? 1 : -1)

  return localGlnWallPanelPorts(node).map((port) => {
    const position = center
      .clone()
      .add(localLeft.clone().multiplyScalar(port.localX))
      .add(new Vector3(0, node.height / 2, 0))
    return {
      id: port.id,
      position: [position.x, position.y, position.z],
      direction: [normal.x, normal.y, normal.z],
      diameter: node.connectionDiameterIn,
      system: port.system,
      shape: 'round' as const,
    }
  })
}
