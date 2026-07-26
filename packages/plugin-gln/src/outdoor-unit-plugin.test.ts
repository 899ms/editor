import { describe, expect, test } from 'bun:test'
import { glnHostPanels, glnPlugin } from './index'

describe('GLN equipment plugin contribution', () => {
  test('registers exactly four physical equipment kinds beside logical system records', () => {
    expect(glnPlugin.nodes?.map((definition) => definition.kind)).toEqual([
      'gln:system',
      'gln:outdoor-unit',
      'gln:buffer-tank',
      'gln:wall-panel',
      'gln:hydronic-pipe',
      'gln:ifc-import',
    ])
    expect(
      glnPlugin.nodes
        ?.map((definition) => definition.kind)
        .filter((kind) =>
          ['gln:outdoor-unit', 'gln:buffer-tank', 'gln:wall-panel', 'gln:hydronic-pipe'].includes(
            kind,
          ),
        ),
    ).toHaveLength(4)
  })

  test('contributes separate system, equipment and residential import panels to the GLN app', () => {
    expect(glnHostPanels.map((panel) => panel.id)).toEqual([
      'gln:systems',
      'gln:equipment',
      'gln:ifc-imports',
    ])
    expect(glnHostPanels.find((panel) => panel.id === 'gln:equipment')).toMatchObject({
      label: '光冷暖设备',
      kinds: ['gln:outdoor-unit', 'gln:buffer-tank', 'gln:wall-panel', 'gln:hydronic-pipe'],
      pluginId: 'pascal:gln',
      mandatory: true,
    })
    expect(glnHostPanels.find((panel) => panel.id === 'gln:ifc-imports')).toMatchObject({
      label: '住宅导入',
      kinds: ['gln:ifc-import'],
      pluginId: 'pascal:gln',
      mandatory: true,
    })
  })
})
