import { BaseNode, nodeType, objectId } from '@pascal-app/core/schema'
import { z } from 'zod'

const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Expected a six-digit hex color')

export const GlnOutdoorUnitFinish = z.enum(['light', 'graphite'])
export type GlnOutdoorUnitFinish = z.infer<typeof GlnOutdoorUnitFinish>

/**
 * A floor-placed hydronic heat-pump outdoor unit.
 *
 * Runtime mode deliberately lives on the owning `gln:system`; this node only
 * stores editable geometry, appearance and connection data.
 */
export const GlnOutdoorUnitNode = BaseNode.extend({
  id: objectId('gln-outdoor-unit'),
  type: nodeType('gln:outdoor-unit'),
  systemId: objectId('gln-system'),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  width: z.number().min(0.45).max(2.5).default(0.9),
  depth: z.number().min(0.25).max(0.9).default(0.42),
  height: z.number().min(0.45).max(2.2).default(0.75),
  finish: GlnOutdoorUnitFinish.default('light'),
  bodyColor: HexColor.default('#e8ecef'),
  grilleColor: HexColor.default('#333a40'),
  connectionDiameterIn: z.number().min(0.25).max(2).default(1),
})

export type GlnOutdoorUnitNode = z.infer<typeof GlnOutdoorUnitNode>
