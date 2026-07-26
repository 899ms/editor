import { type NodePort, nodeRegistry } from '@pascal-app/core/registry'
import type {
  GlnHydronicCircuit,
  GlnHydronicPipeNode,
  GlnPipeEndpoint,
} from './hydronic-pipe-schema'

export type GlnScenePort = NodePort & { nodeId: string }
type RegisteredNode = { id: string; type: string }

const circuitSystem = (circuit: GlnHydronicCircuit) => `gln:${circuit}`

export function getGlnHydronicPipePorts(node: GlnHydronicPipeNode): NodePort[] {
  if (node.path.length < 2) return []
  const start = node.path[0]!
  const next = node.path[1]!
  const end = node.path.at(-1)!
  const previous = node.path.at(-2)!
  const unit = (from: readonly number[], toward: readonly number[]) => {
    const x = from[0]! - toward[0]!
    const y = from[1]! - toward[1]!
    const z = from[2]! - toward[2]!
    const length = Math.hypot(x, y, z) || 1
    return [x / length, y / length, z / length] as const
  }
  return [
    {
      id: 'start',
      position: start,
      direction: unit(start, next),
      diameter: node.diameterIn,
      system: circuitSystem(node.circuit),
      shape: 'round',
    },
    {
      id: 'end',
      position: end,
      direction: unit(end, previous),
      diameter: node.diameterIn,
      system: circuitSystem(node.circuit),
      shape: 'round',
    },
  ]
}

export function getGlnPort(node: RegisteredNode, endpoint: GlnPipeEndpoint): GlnScenePort | null {
  const port = nodeRegistry
    .get(node.type)
    ?.ports?.(node as never)
    .find((candidate) => candidate.id === endpoint.portId)
  return port ? { ...port, nodeId: node.id } : null
}

export function isGlnHydronicPortCompatible(
  circuit: GlnHydronicCircuit,
  port: Pick<NodePort, 'system'> | null,
): boolean {
  return port?.system === `gln:source-${circuit}` || port?.system === `gln:load-${circuit}`
}

export function areGlnHydronicEndpointsCompatible(
  circuit: GlnHydronicCircuit,
  first: Pick<NodePort, 'system'> | null,
  second: Pick<NodePort, 'system'> | null,
): boolean {
  return (
    isGlnHydronicPortCompatible(circuit, first) &&
    isGlnHydronicPortCompatible(circuit, second) &&
    first?.system === second?.system
  )
}
