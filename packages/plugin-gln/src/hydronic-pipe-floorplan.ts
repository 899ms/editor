import type { FloorplanGeometry, FloorplanPoint, GeometryContext } from '@pascal-app/core'
import type { GlnHydronicPipeNode } from './hydronic-pipe-schema'

const SUPPLY_COLOR = '#d95f45'
const RETURN_COLOR = '#238aa5'
const PIPE_STROKE_WIDTH_PX = 3.5
const FLOW_ARROW_LENGTH_M = 0.24
const FLOW_ARROW_WIDTH_M = 0.16

function buildFlowArrow(points: readonly FloorplanPoint[], fill: string): FloorplanGeometry | null {
  let longestSegment: { start: FloorplanPoint; end: FloorplanPoint; length: number } | undefined

  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1]!
    const end = points[index]!
    const length = Math.hypot(end[0] - start[0], end[1] - start[1])
    if (!longestSegment || length > longestSegment.length) {
      longestSegment = { start, end, length }
    }
  }

  if (!longestSegment || longestSegment.length < 1e-6) return null

  const directionX = (longestSegment.end[0] - longestSegment.start[0]) / longestSegment.length
  const directionY = (longestSegment.end[1] - longestSegment.start[1]) / longestSegment.length
  const centerX = (longestSegment.start[0] + longestSegment.end[0]) / 2
  const centerY = (longestSegment.start[1] + longestSegment.end[1]) / 2
  const arrowLength = Math.min(FLOW_ARROW_LENGTH_M, longestSegment.length * 0.45)
  const arrowWidth = Math.min(FLOW_ARROW_WIDTH_M, longestSegment.length * 0.3)
  const tip: FloorplanPoint = [
    centerX + (directionX * arrowLength) / 2,
    centerY + (directionY * arrowLength) / 2,
  ]
  const baseX = centerX - (directionX * arrowLength) / 2
  const baseY = centerY - (directionY * arrowLength) / 2
  const perpendicularX = -directionY
  const perpendicularY = directionX

  return {
    kind: 'polygon',
    points: [
      tip,
      [baseX + (perpendicularX * arrowWidth) / 2, baseY + (perpendicularY * arrowWidth) / 2],
      [baseX - (perpendicularX * arrowWidth) / 2, baseY - (perpendicularY * arrowWidth) / 2],
    ],
    fill,
    stroke: '#ffffff',
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
    pointerEvents: 'none',
  }
}

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
      strokeWidth: PIPE_STROKE_WIDTH_PX,
      vectorEffect: 'non-scaling-stroke',
    }
  }

  const children: FloorplanGeometry[] = [
    {
      kind: 'polyline',
      points,
      stroke,
      strokeWidth: PIPE_STROKE_WIDTH_PX,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      opacity: node.concealed ? 0.68 : 0.95,
      vectorEffect: 'non-scaling-stroke',
      ...(node.concealed ? { strokeDasharray: '8 5' } : {}),
    },
  ]

  const flowArrow = buildFlowArrow(points, stroke)
  if (flowArrow) children.push(flowArrow)

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
