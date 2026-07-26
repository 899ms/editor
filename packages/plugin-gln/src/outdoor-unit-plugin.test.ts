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
      'gln:glb-import',
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

  test('contributes GLN system, equipment, AI, plan and residential import panels', () => {
    expect(glnHostPanels.map((panel) => panel.id)).toEqual([
      'gln:systems',
      'gln:equipment',
      'gln:codex-tasks',
      'gln:scene-plans',
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
      kinds: ['gln:ifc-import', 'gln:glb-import'],
      pluginId: 'pascal:gln',
      mandatory: true,
    })
  })
})
