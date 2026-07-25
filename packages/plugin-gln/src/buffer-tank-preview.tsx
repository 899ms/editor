'use client'

import { buildGlnBufferTankGeometry } from './buffer-tank-geometry'
import type { GlnBufferTankNode } from './buffer-tank-schema'
import GlnEquipmentPreview from './equipment-preview'

export default function GlnBufferTankPreview({
  node,
  valid = true,
}: {
  node: GlnBufferTankNode
  valid?: boolean
}) {
  return (
    <GlnEquipmentPreview buildGeometry={buildGlnBufferTankGeometry} node={node} valid={valid} />
  )
}
