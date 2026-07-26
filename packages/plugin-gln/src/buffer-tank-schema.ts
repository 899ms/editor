import { BaseNode, nodeType, objectId } from '@pascal-app/core/schema'
import { z } from 'zod'
import { GlnEquipmentInstallationFields } from './equipment-installation-schema'
import { GLN_BUFFER_TANK_PRESETS } from './equipment-presets'

const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Expected a six-digit hex color')

export const GlnBufferTankFinish = z.enum(['light', 'graphite'])
export type GlnBufferTankFinish = z.infer<typeof GlnBufferTankFinish>

/**
 * A floor-placed hydronic buffer tank.
 *
 * The stratification flag controls explanatory geometry only. Thermal
 * calculations deliberately remain outside the v1 node contract.
 */
export const GlnBufferTankNode = BaseNode.extend({
  id: objectId('gln-buffer-tank'),
  type: nodeType('gln:buffer-tank'),
  systemId: objectId('gln-system'),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  diameter: z.number().min(0.35).max(2).default(0.65),
  height: z.number().min(0.6).max(3).default(1.5),
  presetId: z
    .enum(
      Object.keys(GLN_BUFFER_TANK_PRESETS) as [
        keyof typeof GLN_BUFFER_TANK_PRESETS,
        ...Array<keyof typeof GLN_BUFFER_TANK_PRESETS>,
      ],
    )
    .default('generic-standard'),
  ...GlnEquipmentInstallationFields,
  insulationThickness: z.number().min(0.01).max(0.2).default(0.05),
  finish: GlnBufferTankFinish.default('light'),
  jacketColor: HexColor.default('#dfe5e8'),
  stratificationView: z.boolean().default(true),
  connectionDiameterIn: z.number().min(0.25).max(2).default(1),
})

export type GlnBufferTankNode = z.infer<typeof GlnBufferTankNode>
