import { BaseNode, nodeType, objectId } from '@pascal-app/core/schema'
import { z } from 'zod'
import { GlnEquipmentInstallationFields } from './equipment-installation-schema'
import { GLN_WALL_PANEL_PRESETS } from './equipment-presets'

const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Expected a six-digit hex color')

export const GlnWallPanelSide = z.enum(['front', 'back'])
export type GlnWallPanelSide = z.infer<typeof GlnWallPanelSide>
export const GlnWallPanelZoneAssignment = z.enum(['auto', 'manual'])

export const GlnWallPanelNode = BaseNode.extend({
  id: objectId('gln-wall-panel'),
  type: nodeType('gln:wall-panel'),
  systemId: objectId('gln-system'),
  wallId: objectId('wall'),
  wallStart: z.tuple([z.number(), z.number()]).default([0, 0]),
  wallEnd: z.tuple([z.number(), z.number()]).default([1, 0]),
  zoneId: objectId('zone').nullable().default(null),
  zoneCandidateIds: z.array(objectId('zone')).default([]),
  zoneAssignment: GlnWallPanelZoneAssignment.default('auto'),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0.45, 1.25, 0.16]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  side: GlnWallPanelSide.default('front'),
  width: z.number().min(0.3).max(3).default(0.9),
  height: z.number().min(0.6).max(4).default(2.5),
  depth: z.number().min(0.05).max(0.4).default(0.12),
  presetId: z
    .enum(
      Object.keys(GLN_WALL_PANEL_PRESETS) as [
        keyof typeof GLN_WALL_PANEL_PRESETS,
        ...Array<keyof typeof GLN_WALL_PANEL_PRESETS>,
      ],
    )
    .default('generic-standard'),
  ...GlnEquipmentInstallationFields,
  finishColor: HexColor.default('#e8ddd0'),
  connectionDiameterIn: z.number().min(0.25).max(1.5).default(0.5),
})

export type GlnWallPanelNode = z.infer<typeof GlnWallPanelNode>
