import type { FloorplanGeometry, FloorplanPoint, GeometryContext } from '@pascal-app/core'
import type { GlnHydronicPipeNode } from './hydronic-pipe-schema'

const SUPPLY_COLOR = '#d95f45'
const RETURN_COLOR = '#238aa5'

export function buildGlnHydronicPipeFloorplan(
  node: GlnHydronicPipeNode,
  ctx: GeometryContext,
): FloorplanGeometry | null {
  if (node.path.length < 2) return null

  const points: FloorplanPoint[] = []
  const indexMap: number[] = []
  for (let index = 0; index < node.path.length; index++) {
    const [x, , z] = node.path[index]!
    const previous = points.at(-1)
    if (previous && Math.abs(previous[0] - x) < 1e-6 && Math.abs(previous[1] - z) < 1e-6) {
      continue
    }
    points.push([x, z])
    indexMap.push(index)
  }

  const selected = ctx.viewState?.selected ?? false
  const stroke =
    selected && ctx.viewState?.palette
      ? ctx.viewState.palette.selectedStroke
      : node.circuit === 'supply'
        ? SUPPLY_COLOR
        : RETURN_COLOR
  const diameterM = node.diameterIn * 0.0254 + node.insulationThicknessM * 2

  if (points.length < 2) {
    const point = points[0] ?? [node.path[0]![0], node.path[0]![2]]
    return {
      kind: 'circle',
      cx: point[0],
      cy: point[1],
      r: diameterM / 2 + 0.01,
      fill: 'none',
      stroke,
      strokeWidth: 2,
      vectorEffect: 'non-scaling-stroke',
    }
  }

  const children: FloorplanGeometry[] = [
    {
      kind: 'polyline',
      points,
      stroke,
      strokeWidth: Math.max(diameterM, 0.025),
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      opacity: node.concealed ? 0.68 : 0.95,
      ...(node.concealed ? { strokeDasharray: '5 3', vectorEffect: 'non-scaling-stroke' } : {}),
    },
  ]

  if (selected) {
    for (let index = 1; index < points.length - 1; index++) {
      children.push({
        kind: 'endpoint-handle',
        point: points[index]!,
        state: 'idle',
        affordance: 'move-path-point',
        payload: { pointIndex: indexMap[index]! },
      })
    }
  }

  return { kind: 'group', children }
}
