import { describe, expect, test } from 'bun:test'
import { GlnBufferTankFinish, GlnBufferTankNode } from './buffer-tank-schema'

describe('GlnBufferTankNode', () => {
  test('creates an editable tank owned by one logical GLN system', () => {
    const tank = GlnBufferTankNode.parse({ systemId: 'gln-system_test' })

    expect(tank.type).toBe('gln:buffer-tank')
    expect(tank.id).toStartWith('gln-buffer-tank_')
    expect(tank.systemId).toBe('gln-system_test')
    expect(tank.position).toEqual([0, 0, 0])
    expect(tank.rotation).toEqual([0, 0, 0])
    expect(tank.diameter).toBe(0.65)
    expect(tank.height).toBe(1.5)
    expect(tank.insulationThickness).toBe(0.05)
    expect(tank.finish).toBe('light')
    expect(tank.jacketColor).toBe('#dfe5e8')
    expect(tank.stratificationView).toBe(true)
    expect(tank).not.toHaveProperty('temperature')
    expect(tank).not.toHaveProperty('topTemperature')
    expect(tank).not.toHaveProperty('bottomTemperature')
  })

  test('requires a system owner and bounds editable physical dimensions', () => {
    expect(GlnBufferTankNode.safeParse({ systemId: '' }).success).toBe(false)
    expect(
      GlnBufferTankNode.safeParse({ systemId: 'gln-system_test', diameter: 0.34 }).success,
    ).toBe(false)
    expect(GlnBufferTankNode.safeParse({ systemId: 'gln-system_test', height: 3.01 }).success).toBe(
      false,
    )
    expect(
      GlnBufferTankNode.safeParse({
        systemId: 'gln-system_test',
        insulationThickness: 0.21,
      }).success,
    ).toBe(false)
  })

  test('offers only supported visual finishes', () => {
    expect(GlnBufferTankFinish.options).toEqual(['light', 'graphite'])
    expect(
      GlnBufferTankNode.safeParse({
        systemId: 'gln-system_test',
        finish: 'wood',
      }).success,
    ).toBe(false)
  })
})
