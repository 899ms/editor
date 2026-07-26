import { describe, expect, test } from 'bun:test'
import { GlnSystemMode, GlnSystemNode } from './system-schema'

describe('GlnSystemNode', () => {
  test('creates an invisible logical system in standby mode', () => {
    const system = GlnSystemNode.parse({ name: '住宅光冷暖系统' })

    expect(system.type).toBe('gln:system')
    expect(system.id).toStartWith('gln-system_')
    expect(system.visible).toBe(false)
    expect(system.parentId).toBeNull()
    expect(system.mode).toBe('standby')
    expect(system.zoneSettings).toEqual({})
  })

  test('limits runtime mode to cooling, heating, or standby', () => {
    expect(GlnSystemMode.options).toEqual(['cooling', 'heating', 'standby'])
    expect(
      GlnSystemNode.safeParse({
        name: '住宅光冷暖系统',
        mode: 'dehumidifying',
      }).success,
    ).toBe(false)
  })

  test('requires a non-empty editable name', () => {
    expect(GlnSystemNode.safeParse({ name: '  ' }).success).toBe(false)
  })

  test('keeps nullable zone targets and their explicit source on the logical system', () => {
    const system = GlnSystemNode.parse({
      name: '住宅光冷暖系统',
      zoneSettings: {
        zone_living: {
          targetTemperature: 26,
          targetTemperatureSource: 'template',
          targetHumidity: null,
          targetHumiditySource: 'unset',
          enabled: true,
        },
      },
    })

    expect(system.zoneSettings.zone_living).toMatchObject({
      targetTemperature: 26,
      targetTemperatureSource: 'template',
      targetHumidity: null,
      targetHumiditySource: 'unset',
    })
  })
})
