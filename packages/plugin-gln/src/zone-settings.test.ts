import { describe, expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeId, ZoneNode } from '@pascal-app/core'
import { GlnSystemNode } from './system-schema'
import { GlnWallPanelNode } from './wall-panel-schema'
import { getGlnZoneControls } from './zone-settings'

const system = GlnSystemNode.parse({
  id: 'gln-system_controls',
  name: '一层系统',
  zoneSettings: {
    zone_living: { targetTemperature: 26, targetTemperatureSource: 'template' },
  },
})

const living = ZoneNode.parse({
  id: 'zone_living',
  name: '客厅',
  polygon: [
    [0, 0],
    [4, 0],
    [4, 3],
  ],
})

const panel = (id: string) =>
  GlnWallPanelNode.parse({
    id,
    parentId: 'wall_living',
    wallId: 'wall_living',
    systemId: system.id,
    zoneId: living.id,
  })

describe('GLN zone target controls', () => {
  test('shares one control across multiple panels in the same zone', () => {
    const nodes = {
      [living.id]: living,
      [panel('gln-wall-panel_living-a').id]: panel('gln-wall-panel_living-a'),
      [panel('gln-wall-panel_living-b').id]: panel('gln-wall-panel_living-b'),
    } as unknown as Record<AnyNodeId, AnyNode>

    expect(getGlnZoneControls(system, nodes)).toEqual([
      expect.objectContaining({
        zoneId: living.id,
        zoneName: '客厅',
        panelCount: 2,
        settings: expect.objectContaining({
          targetTemperature: 26,
          targetTemperatureSource: 'template',
          targetHumidity: null,
        }),
      }),
    ])
  })

  test('retains a saved control but disables it after the last panel is removed', () => {
    const nodes = { [living.id]: living } as unknown as Record<AnyNodeId, AnyNode>
    expect(getGlnZoneControls(system, nodes)).toEqual([
      expect.objectContaining({ zoneId: living.id, panelCount: 0 }),
    ])
  })
})
