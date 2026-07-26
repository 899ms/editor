import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import { type GlnSystemNode, GlnZoneSettings } from './system-schema'
import type { GlnWallPanelNode } from './wall-panel-schema'

export type GlnZoneControl = {
  zoneId: string
  zoneName: string
  panelCount: number
  settings: GlnZoneSettings
}

export function getGlnZoneControls(
  system: GlnSystemNode,
  nodes: Readonly<Record<AnyNodeId, AnyNode>>,
): GlnZoneControl[] {
  const panelCounts = new Map<string, number>()
  for (const node of Object.values(nodes)) {
    if ((node as { type?: string }).type !== 'gln:wall-panel') continue
    const panel = node as unknown as GlnWallPanelNode
    if (panel.systemId !== system.id || !panel.zoneId) continue
    panelCounts.set(panel.zoneId, (panelCounts.get(panel.zoneId) ?? 0) + 1)
  }

  return Array.from(new Set([...Object.keys(system.zoneSettings), ...panelCounts.keys()]))
    .map((zoneId) => {
      const zone = nodes[zoneId as AnyNodeId]
      if (zone?.type !== 'zone') return null
      return {
        zoneId,
        zoneName: zone.name,
        panelCount: panelCounts.get(zoneId) ?? 0,
        settings: GlnZoneSettings.parse(system.zoneSettings[zoneId as `zone_${string}`] ?? {}),
      }
    })
    .filter((control): control is GlnZoneControl => control !== null)
    .sort((left, right) => left.zoneName.localeCompare(right.zoneName, 'zh-CN'))
}
