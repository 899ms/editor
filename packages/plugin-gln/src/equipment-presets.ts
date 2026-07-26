/**
 * These presets only describe editable envelope dimensions. They intentionally
 * carry no manufacturer, model, capacity, performance, or service-clearance
 * claim. A project must add verified product data in a later workflow.
 */
export const GLN_GENERIC_SPECIFICATION_SOURCE = 'generic-placeholder' as const

export const GLN_OUTDOOR_UNIT_PRESETS = {
  'generic-compact': { width: 0.75, depth: 0.38, height: 0.65 },
  'generic-standard': { width: 0.9, depth: 0.42, height: 0.75 },
  'generic-wide': { width: 1.2, depth: 0.55, height: 0.9 },
} as const

export const GLN_BUFFER_TANK_PRESETS = {
  'generic-compact': { diameter: 0.5, height: 1.2 },
  'generic-standard': { diameter: 0.65, height: 1.5 },
  'generic-tall': { diameter: 0.75, height: 1.9 },
} as const

export const GLN_WALL_PANEL_PRESETS = {
  'generic-narrow': { width: 0.6, height: 2.1, depth: 0.1 },
  'generic-standard': { width: 0.9, height: 2.5, depth: 0.12 },
  'generic-wide': { width: 1.2, height: 2.5, depth: 0.12 },
} as const

export type GlnOutdoorUnitPresetId = keyof typeof GLN_OUTDOOR_UNIT_PRESETS
export type GlnBufferTankPresetId = keyof typeof GLN_BUFFER_TANK_PRESETS
export type GlnWallPanelPresetId = keyof typeof GLN_WALL_PANEL_PRESETS
