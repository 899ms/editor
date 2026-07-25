import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import type { GlnBufferTankNode } from './buffer-tank-schema'

export function buildGlnBufferTankFloorplan(
  node: GlnBufferTankNode,
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
      kind: 'circle',
      cx: 0,
      cy: 0,
      r: node.diameter / 2,
      fill: node.jacketColor,
      fillOpacity: 0.82,
      stroke,
      strokeWidth: 0.025,
    },
    {
      kind: 'line',
      x1: 0,
      y1: 0,
      x2: node.diameter * 0.38,
      y2: 0,
      stroke,
      strokeWidth: 0.025,
      pointerEvents: 'none',
    },
  ]

  if (selected) children.push({ kind: 'move-handle', point: [0, 0] })

  return {
    kind: 'group',
    transform: {
      translate: [x, z],
      rotate: -node.rotation[1],
    },
    children,
  }
}
