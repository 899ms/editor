import { describe, expect, test } from 'bun:test'
import { glnHostPanels, glnPlugin } from './index'

describe('GLN outdoor-unit plugin contribution', () => {
  test('registers the outdoor unit beside the logical system', () => {
    expect(glnPlugin.nodes?.map((definition) => definition.kind)).toEqual([
      'gln:system',
      'gln:outdoor-unit',
    ])
  })

  test('contributes separate system and equipment panels to the GLN app', () => {
    expect(glnHostPanels.map((panel) => panel.id)).toEqual(['gln:systems', 'gln:equipment'])
    expect(glnHostPanels.find((panel) => panel.id === 'gln:equipment')).toMatchObject({
      label: '光冷暖设备',
      kinds: ['gln:outdoor-unit'],
      pluginId: 'pascal:gln',
      mandatory: true,
    })
  })
})
