import { BaseNode, nodeType, objectId } from '@pascal-app/core/schema'
import { z } from 'zod'

export const GlnSystemMode = z.enum(['cooling', 'heating', 'standby'])
export type GlnSystemMode = z.infer<typeof GlnSystemMode>

export const GlnZoneSettingSource = z.enum(['unset', 'user', 'template'])
export type GlnZoneSettingSource = z.infer<typeof GlnZoneSettingSource>

export const GlnZoneSettings = z.object({
  targetTemperature: z.number().min(5).max(40).nullable().default(null),
  targetTemperatureSource: GlnZoneSettingSource.default('unset'),
  targetHumidity: z.number().min(10).max(90).nullable().default(null),
  targetHumiditySource: GlnZoneSettingSource.default('unset'),
  enabled: z.boolean().default(true),
})
export type GlnZoneSettings = z.infer<typeof GlnZoneSettings>

/**
 * Logical owner of a hydronic GLN installation. It is deliberately invisible:
 * physical devices reference this node through `systemId`, while runtime mode
 * has one source of truth here.
 */
export const GlnSystemNode = BaseNode.extend({
  id: objectId('gln-system'),
  type: nodeType('gln:system'),
  name: z.string().trim().min(1).max(120),
  mode: GlnSystemMode.default('standby'),
  visible: z.literal(false).default(false),
  parentId: z.null().default(null),
  zoneSettings: z.record(objectId('zone'), GlnZoneSettings).default({}),
})

export type GlnSystemNode = z.infer<typeof GlnSystemNode>
