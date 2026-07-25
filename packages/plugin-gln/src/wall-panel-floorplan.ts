import type { FloorplanGeometry, GeometryContext, WallNode } from '@pascal-app/core'
import type { GlnWallPanelNode } from './wall-panel-schema'

export function buildGlnWallPanelFloorplan(
  node: GlnWallPanelNode,
  ctx: GeometryContext,
): FloorplanGeometry | null {
  const wall = ctx.resolve(node.wallId) as WallNode | undefined
  if (!wall) return null
  const dx = wall.end[0] - wall.start[0]
  const dz = wall.end[1] - wall.start[1]
  const length = Math.hypot(dx, dz)
  if (length < 1e-6) return null
  const dirX = dx / length
  const dirZ = dz / length
  const normalX = -dirZ
  const normalZ = dirX
  const x = wall.start[0] + dirX * node.position[0] + normalX * node.position[2]
  const z = wall.start[1] + dirZ * node.position[0] + normalZ * node.position[2]
  const rotation = -Math.atan2(dz, dx) - node.rotation[1]
  const selected = ctx.viewState?.selected ?? false
  const stroke = selected ? (ctx.viewState?.palette?.selectedStroke ?? '#15939d') : '#30363b'

  const children: FloorplanGeometry[] = [
    {
      kind: 'rect',
      x: -node.width / 2,
      y: -node.depth / 2,
      width: node.width,
      height: node.depth,
      fill: node.finishColor,
      fillOpacity: 0.9,
      stroke,
      strokeWidth: 0.025,
    },
  ]
  return { kind: 'group', transform: { translate: [x, z], rotate: rotation }, children }
}
