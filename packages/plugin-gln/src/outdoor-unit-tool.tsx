'use client'

import GlnFloorEquipmentTool, { type GlnFloorEquipmentSpec } from './equipment-placement-tool'
import GlnOutdoorUnitPreview from './outdoor-unit-preview'
import { GlnOutdoorUnitNode } from './outdoor-unit-schema'

const outdoorUnitPlacementSpec: GlnFloorEquipmentSpec<GlnOutdoorUnitNode> = {
  create: (input) => GlnOutdoorUnitNode.parse(input),
  dimensions: (node) => [node.width, node.height, node.depth],
  Preview: GlnOutdoorUnitPreview,
}

export default function GlnOutdoorUnitTool() {
  return <GlnFloorEquipmentTool spec={outdoorUnitPlacementSpec} />
}
