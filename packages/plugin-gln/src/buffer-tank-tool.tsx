'use client'

import GlnBufferTankPreview from './buffer-tank-preview'
import { GlnBufferTankNode } from './buffer-tank-schema'
import GlnFloorEquipmentTool, { type GlnFloorEquipmentSpec } from './equipment-placement-tool'

const bufferTankPlacementSpec: GlnFloorEquipmentSpec<GlnBufferTankNode> = {
  create: (input) => GlnBufferTankNode.parse(input),
  dimensions: (node) => [node.diameter, node.height, node.diameter],
  Preview: GlnBufferTankPreview,
}

export default function GlnBufferTankTool() {
  return <GlnFloorEquipmentTool spec={bufferTankPlacementSpec} />
}
