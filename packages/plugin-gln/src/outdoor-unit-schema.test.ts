import { describe, expect, test } from 'bun:test'
import { GlnOutdoorUnitFinish, GlnOutdoorUnitNode } from './outdoor-unit-schema'

describe('GlnOutdoorUnitNode', () => {
  test('creates one editable physical unit owned by a logical GLN system', () => {
    const unit = GlnOutdoorUnitNode.parse({
      systemId: 'gln-system_test',
    })

    expect(unit.type).toBe('gln:outdoor-unit')
    expect(unit.id).toStartWith('gln-outdoor-unit_')
    expect(unit.systemId).toBe('gln-system_test')
    expect(unit.position).toEqual([0, 0, 0])
    expect(unit.rotation).toEqual([0, 0, 0])
    expect(unit.width).toBe(0.9)
    expect(unit.depth).toBe(0.42)
    expect(unit.height).toBe(0.75)
    expect(unit.finish).toBe('light')
    expect(unit.bodyColor).toBe('#e8ecef')
    expect(unit).not.toHaveProperty('mode')
  })

  test('requires a non-empty system owner', () => {
    expect(GlnOutdoorUnitNode.safeParse({ systemId: '' }).success).toBe(false)
    expect(GlnOutdoorUnitNode.safeParse({ systemId: '   ' }).success).toBe(false)
  })

  test('bounds editable physical dimensions and connection size', () => {
    expect(
      GlnOutdoorUnitNode.safeParse({
        systemId: 'gln-system_test',
        width: 0.44,
      }).success,
    ).toBe(false)
    expect(
      GlnOutdoorUnitNode.safeParse({
        systemId: 'gln-system_test',
        height: 2.21,
      }).success,
    ).toBe(false)
    expect(
      GlnOutdoorUnitNode.safeParse({
        systemId: 'gln-system_test',
        connectionDiameterIn: 0,
      }).success,
    ).toBe(false)
  })

  test('offers only the supported visual finishes', () => {
    expect(GlnOutdoorUnitFinish.options).toEqual(['light', 'graphite'])
    expect(
      GlnOutdoorUnitNode.safeParse({
        systemId: 'gln-system_test',
        finish: 'wood',
      }).success,
    ).toBe(false)
  })
})
