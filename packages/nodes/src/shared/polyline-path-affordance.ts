import type { FloorplanAffordance, FloorplanAffordanceSession } from '@pascal-app/core/registry'
import type { AnyNodeId } from '@pascal-app/core/schema'
import useScene from '@pascal-app/core/store'

export type PolylinePathPointPayload = { pointIndex: number }

type PolylinePathNode = {
  id: string
  path: ReadonlyArray<readonly [number, number, number]>
}

/**
 * Lightweight path-point editing shared by plugin-owned polyline nodes.
 * It intentionally edits one point only: equipment endpoints and domain
 * connectivity remain owned by the plugin.
 */
export function createPolylinePathPointMoveAffordance<N extends PolylinePathNode>(
  kind: string,
): FloorplanAffordance<N> {
  const inert: FloorplanAffordanceSession = {
    affectedIds: [],
    apply() {},
    canCommit: () => false,
  }

  return {
    start({ node, payload, gridSnapStep }): FloorplanAffordanceSession {
      const { pointIndex } = payload as PolylinePathPointPayload
      const initialPath = node.path.map((point) => [...point] as [number, number, number])
      const target = initialPath[pointIndex]
      const nodeId = node.id as AnyNodeId
      if (!target) return { ...inert, affectedIds: [nodeId] }
      const elevation = target[1]

      return {
        affectedIds: [nodeId],
        apply({ planPoint, modifiers }) {
          const [x, z] =
            modifiers.shiftKey || gridSnapStep <= 0
              ? planPoint
              : [
                  Math.round(planPoint[0] / gridSnapStep) * gridSnapStep,
                  Math.round(planPoint[1] / gridSnapStep) * gridSnapStep,
                ]
          const path = initialPath.map((point, index) =>
            index === pointIndex ? ([x, elevation, z] as [number, number, number]) : point,
          )
          useScene.getState().updateNode(nodeId, { path } as never)
        },
        canCommit() {
          const current = useScene.getState().nodes[nodeId] as N | undefined
          return (
            !!current &&
            (current as unknown as { type?: string }).type === kind &&
            current.path.length >= 2
          )
        },
      }
    },
  }
}
