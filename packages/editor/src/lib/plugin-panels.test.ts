import { afterEach, describe, expect, test } from 'bun:test'
import { nodeRegistry } from '@pascal-app/core'
import { editorHostPanelRegistry, registerEditorHostPanel } from './plugin-panels'

describe('editorHostPanelRegistry', () => {
  afterEach(() => {
    editorHostPanelRegistry.reset()
    nodeRegistry._reset()
  })

  test('maps registered node kinds back to their owning host panel', () => {
    registerEditorHostPanel({
      id: 'pascal:trees:trees',
      label: 'Nature',
      icon: { kind: 'url', src: '/nature.webp' },
      component: async () => ({ default: () => null }),
      kinds: ['trees:tree', 'trees:flower', 'trees:grass'],
    })

    expect(editorHostPanelRegistry.panelForKind('trees:flower')).toBe('pascal:trees:trees')
    expect(editorHostPanelRegistry.panelForKind('wall')).toBeUndefined()
  })

  test('tracks mandatory plugin ids separately from default installs', () => {
    registerEditorHostPanel({
      id: 'gln:systems',
      label: 'GLN Systems',
      icon: { kind: 'iconify', name: 'lucide:thermometer-sun' },
      component: async () => ({ default: () => null }),
      pluginId: 'pascal:gln',
      defaultInstalled: true,
      mandatory: true,
    })

    expect(editorHostPanelRegistry.getMandatoryPluginIds()).toEqual(['pascal:gln'])
  })
})
