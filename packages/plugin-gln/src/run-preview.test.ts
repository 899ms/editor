import { describe, expect, test } from 'bun:test'
import { deriveGlnRunPreview } from './run-preview'

const systemId = 'gln-system_preview'
const zoneId = 'zone_living'

const system = (mode: 'cooling' | 'heating' | 'standby') => ({
  id: systemId,
  type: 'gln:system',
  mode,
  zoneSettings: {
    [zoneId]: {
      targetTemperature: 24,
      targetTemperatureSource: 'user',
      targetHumidity: 50,
      targetHumiditySource: 'user',
      enabled: true,
    },
  },
})

const equipment = {
  outdoor: { id: 'outdoor', type: 'gln:outdoor-unit', systemId },
  tank: { id: 'tank', type: 'gln:buffer-tank', systemId },
  panel: { id: 'panel', type: 'gln:wall-panel', systemId, zoneId },
}

const pipe = (
  id: string,
  circuit: 'supply' | 'return',
  start: { nodeId: string; portId: string },
  end: { nodeId: string; portId: string },
) => ({
  id,
  type: 'gln:hydronic-pipe',
  systemId,
  circuit,
  start,
  end,
})

const connectedLoop = {
  sourceSupplyReversed: pipe(
    'source-supply',
    'supply',
    { nodeId: 'tank', portId: 'source-supply' },
    { nodeId: 'outdoor', portId: 'supply' },
  ),
  sourceReturn: pipe(
    'source-return',
    'return',
    { nodeId: 'tank', portId: 'source-return' },
    { nodeId: 'outdoor', portId: 'return' },
  ),
  loadSupply: pipe(
    'load-supply',
    'supply',
    { nodeId: 'tank', portId: 'load-supply' },
    { nodeId: 'panel', portId: 'supply' },
  ),
  loadReturnReversed: pipe(
    'load-return',
    'return',
    { nodeId: 'tank', portId: 'load-return' },
    { nodeId: 'panel', portId: 'return' },
  ),
}

describe('GLN run preview model', () => {
  test('derives pipe animation direction from typed endpoint topology', () => {
    const preview = deriveGlnRunPreview({
      ...equipment,
      ...connectedLoop,
      system: system('cooling'),
    })

    expect(preview.pipes).toEqual([
      { pipeId: 'load-return', pathDirection: 'reverse' },
      { pipeId: 'load-supply', pathDirection: 'forward' },
      { pipeId: 'source-return', pathDirection: 'forward' },
      { pipeId: 'source-supply', pathDirection: 'reverse' },
    ])
  })

  test('shows only target settings and mode-specific panel energy direction', () => {
    const cooling = deriveGlnRunPreview({
      ...equipment,
      ...connectedLoop,
      system: system('cooling'),
    })
    expect(cooling.panels).toEqual([
      {
        panelId: 'panel',
        energyDirection: 'space-to-panel',
        targetHumidity: 50,
        targetTemperature: 24,
        zoneId,
      },
    ])
    expect(cooling).not.toHaveProperty('flowRate')
    expect(cooling).not.toHaveProperty('actualTemperature')

    const heating = deriveGlnRunPreview({
      ...equipment,
      ...connectedLoop,
      system: system('heating'),
    })
    expect(heating.panels[0]?.energyDirection).toBe('panel-to-space')

    const standby = deriveGlnRunPreview({
      ...equipment,
      ...connectedLoop,
      system: system('standby'),
    })
    expect(standby.panels).toEqual([])
    expect(standby.pipes).toEqual([])
  })

  test('does not animate incomplete or incompatible endpoint pairs', () => {
    const preview = deriveGlnRunPreview({
      ...equipment,
      system: system('cooling'),
      incomplete: {
        id: 'incomplete',
        type: 'gln:hydronic-pipe',
        systemId,
        circuit: 'supply',
        start: { nodeId: 'outdoor', portId: 'supply' },
        end: null,
      },
      incompatible: pipe(
        'incompatible',
        'supply',
        { nodeId: 'outdoor', portId: 'supply' },
        { nodeId: 'panel', portId: 'supply' },
      ),
    })

    expect(preview).toEqual({ panels: [], pipes: [] })
  })

  test('does not animate pipes without one matching persisted system', () => {
    const missingSystem = deriveGlnRunPreview({
      ...equipment,
      ...connectedLoop,
    })
    expect(missingSystem).toEqual({ panels: [], pipes: [] })

    const crossSystem = deriveGlnRunPreview({
      ...equipment,
      system: system('cooling'),
      foreignPanel: {
        ...equipment.panel,
        id: 'foreign-panel',
        systemId: 'gln-system_foreign',
      },
      crossSystemPipe: pipe(
        'cross-system-pipe',
        'supply',
        { nodeId: 'tank', portId: 'load-supply' },
        { nodeId: 'foreign-panel', portId: 'supply' },
      ),
    })
    expect(crossSystem).toEqual({ panels: [], pipes: [] })
  })
})
