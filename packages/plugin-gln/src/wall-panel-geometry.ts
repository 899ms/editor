import type { GeometryContext } from '@pascal-app/core'
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import type { GlnWallPanelNode } from './wall-panel-schema'

export function buildGlnWallPanelGeometry(node: GlnWallPanelNode, _ctx?: GeometryContext) {
  const group = new Group()
  const panel = new Mesh(
    new BoxGeometry(node.width, node.height, node.depth),
    new MeshStandardMaterial({ color: node.finishColor, roughness: 0.72 }),
  )
  panel.name = 'gln-wall-panel-body'
  group.add(panel)

  const connectorGeometry = new CylinderGeometry(0.035, 0.035, 0.1, 16)
  connectorGeometry.rotateX(Math.PI / 2)
  for (const [x, color] of [
    [node.width / 2 - 0.08, '#15939d'],
    [-node.width / 2 + 0.08, '#ef6b50'],
  ] as const) {
    const connector = new Mesh(
      connectorGeometry.clone(),
      new MeshStandardMaterial({ color, roughness: 0.45 }),
    )
    connector.name = color === '#15939d' ? 'gln-wall-panel-supply' : 'gln-wall-panel-return'
    connector.position.set(x, node.height / 2, node.depth / 2 + 0.04)
    group.add(connector)
  }
  return group
}
