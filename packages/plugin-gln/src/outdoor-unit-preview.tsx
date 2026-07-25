'use client'

import GlnEquipmentPreview from './equipment-preview'
import { buildGlnOutdoorUnitGeometry } from './outdoor-unit-geometry'
import type { GlnOutdoorUnitNode } from './outdoor-unit-schema'

export default function GlnOutdoorUnitPreview({
  node,
  valid = true,
}: {
  node: GlnOutdoorUnitNode
  valid?: boolean
}) {
  return (
    <GlnEquipmentPreview buildGeometry={buildGlnOutdoorUnitGeometry} node={node} valid={valid} />
  )
}
