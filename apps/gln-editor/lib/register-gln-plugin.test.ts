import { beforeEach, describe, expect, test } from 'bun:test'
import { nodeRegistry, registerPlugin } from '@pascal-app/core/registry'
import { SceneBridge } from '@pascal-app/mcp'
import { GlnSystemNode, glnPlugin } from '@pascal-app/plugin-gln'
import { ensureGlnPluginRegistered } from './register-gln-plugin'

describe('GLN plugin registration', () => {
  beforeEach(() => {
    nodeRegistry._reset()
  })

  test('registers the real GLN schema for the MCP scene bridge', () => {
    ensureGlnPluginRegistered()
    const system = GlnSystemNode.parse({ name: '一层系统', mode: 'heating' })
    const bridge = new SceneBridge()

    bridge.loadJSON({
      nodes: { [system.id]: system },
      rootNodeIds: [system.id],
      installedPlugins: [],
    })

    expect(bridge.validateScene()).toEqual({ valid: true, errors: [] })
    expect(bridge.exportJSON().nodes[system.id]).toMatchObject({
      type: 'gln:system',
      name: '一层系统',
      mode: 'heating',
    })
    expect(bridge.exportJSON().installedPlugins).toEqual([glnPlugin.id])
  })

  test('includes the mandatory GLN plugin in a new MCP scene', () => {
    ensureGlnPluginRegistered()
    const bridge = new SceneBridge()

    expect(bridge.exportJSON().installedPlugins).toEqual([glnPlugin.id])
  })

  test('rejects a kind registered by a different plugin', () => {
    registerPlugin({
      id: 'conflict:plugin',
      apiVersion: 1,
      nodes: glnPlugin.nodes,
    })

    expect(() => ensureGlnPluginRegistered()).toThrow(/conflict:plugin/)
  })
})
