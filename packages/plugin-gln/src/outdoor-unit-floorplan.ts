import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import type { GlnOutdoorUnitNode } from './outdoor-unit-schema'

export function buildGlnOutdoorUnitFloorplan(
  node: GlnOutdoorUnitNode,
  ctx?: GeometryContext,
): FloorplanGeometry {
  const [x, , z] = node.position
  const selected = ctx?.viewState?.selected ?? false
  const highlighted = ctx?.viewState?.highlighted ?? false
  const hovered = ctx?.viewState?.hovered ?? false
  const palette = ctx?.viewState?.palette
  const stroke =
    selected || highlighted
      ? (palette?.selectedStroke ?? '#15939d')
      : hovered
        ? (palette?.wallHoverStroke ?? '#15939d')
        : '#30363b'

  const children: FloorplanGeometry[] = [
    {
      kind: 'rect',
      x: -node.width / 2,
      y: -node.depth / 2,
      width: node.width,
      height: node.depth,
      fill: node.bodyColor,
      fillOpacity: 0.82,
      stroke,
      strokeWidth: 0.025,
    },
    {
      kind: 'line',
      x1: -node.width * 0.34,
      y1: node.depth * 0.18,
      x2: node.width * 0.34,
      y2: node.depth * 0.18,
      stroke: node.grilleColor,
      strokeWidth: 0.025,
      opacity: 0.85,
      pointerEvents: 'none',
    },
  ]

  if (selected) {
    children.push({ kind: 'move-handle', point: [0, 0] })
  }

  return {
    kind: 'group',
    transform: {
      translate: [x, z],
      rotate: -node.rotation[1],
    },
    children,
  }
}
