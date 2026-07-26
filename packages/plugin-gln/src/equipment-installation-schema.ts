import { objectId } from '@pascal-app/core/schema'
import { z } from 'zod'

export const GlnEquipmentInstallationAreaKind = z.enum([
  'unassigned',
  'outdoor-equipment-area',
  'equipment-room',
  'mechanical-room',
  'equipment-area',
])
export type GlnEquipmentInstallationAreaKind = z.infer<typeof GlnEquipmentInstallationAreaKind>

export const GlnGenericSpecificationSource = z.literal('generic-placeholder')

export const GlnEquipmentInstallationFields = {
  specificationSource: GlnGenericSpecificationSource.default('generic-placeholder'),
  installationAreaZoneId: objectId('zone').nullable().default(null),
  installationAreaKind: GlnEquipmentInstallationAreaKind.default('unassigned'),
  // These are intentionally unset by default: the editor must not infer a
  // manufacturer's service distance from a generic placeholder envelope.
  clearanceFront: z.number().min(0).max(10).default(0),
  clearanceBack: z.number().min(0).max(10).default(0),
  clearanceLeft: z.number().min(0).max(10).default(0),
  clearanceRight: z.number().min(0).max(10).default(0),
  clearanceTop: z.number().min(0).max(10).default(0),
} as const

export type GlnEquipmentInstallationFields = {
  specificationSource: 'generic-placeholder'
  installationAreaZoneId: string | null
  installationAreaKind: GlnEquipmentInstallationAreaKind
  clearanceFront: number
  clearanceBack: number
  clearanceLeft: number
  clearanceRight: number
  clearanceTop: number
}
