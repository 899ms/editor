import { beforeEach, describe, expect, test } from 'bun:test'
import { nodeRegistry, registerPlugin } from '@pascal-app/core/registry'
import { SceneBridge } from '@pascal-app/mcp'
import {
  GlnBufferTankNode,
  GlnHydronicPipeNode,
  GlnOutdoorUnitNode,
  GlnSystemNode,
  glnPlugin,
} from '@pascal-app/plugin-gln'
import { ensureGlnPluginRegistered } from './register-gln-plugin'

describe('GLN plugin registration', () => {
  beforeEach(() => {
    nodeRegistry._reset()
  })

  test('registers the real GLN schema for the MCP scene bridge', () => {
    ensureGlnPluginRegistered()
    const system = GlnSystemNode.parse({ name: '一层系统', mode: 'heating' })
    const outdoorUnit = GlnOutdoorUnitNode.parse({
      systemId: system.id,
      position: [2, 0, 3],
      width: 1.1,
      finish: 'graphite',
    })
    const bufferTank = GlnBufferTankNode.parse({
      systemId: system.id,
      position: [4, 0, 3],
      diameter: 0.8,
      finish: 'graphite',
    })
    const pipe = GlnHydronicPipeNode.parse({
      systemId: system.id,
      circuit: 'supply',
      path: [
        [2, 2.5, 3],
        [3, 2.5, 3],
        [4, 2.5, 3],
      ],
      start: { nodeId: outdoorUnit.id, portId: 'supply' },
      end: { nodeId: bufferTank.id, portId: 'source-supply' },
    })
    const bridge = new SceneBridge()

    bridge.loadJSON({
      nodes: {
        [system.id]: system,
        [outdoorUnit.id]: outdoorUnit,
        [bufferTank.id]: bufferTank,
        [pipe.id]: pipe,
      },
      rootNodeIds: [system.id, outdoorUnit.id, bufferTank.id, pipe.id],
      installedPlugins: [],
    })

    expect(bridge.validateScene()).toEqual({ valid: true, errors: [] })
    expect(bridge.exportJSON().nodes[system.id]).toMatchObject({
      type: 'gln:system',
      name: '一层系统',
      mode: 'heating',
    })
    expect(bridge.exportJSON().nodes[outdoorUnit.id]).toMatchObject({
      type: 'gln:outdoor-unit',
      systemId: system.id,
      position: [2, 0, 3],
      width: 1.1,
      finish: 'graphite',
    })
    expect(bridge.exportJSON().nodes[bufferTank.id]).toMatchObject({
      type: 'gln:buffer-tank',
      systemId: system.id,
      position: [4, 0, 3],
      diameter: 0.8,
      finish: 'graphite',
      stratificationView: true,
    })
    expect(bridge.exportJSON().nodes[pipe.id]).toMatchObject({
      type: 'gln:hydronic-pipe',
      systemId: system.id,
      circuit: 'supply',
      path: [
        [2, 2.5, 3],
        [3, 2.5, 3],
        [4, 2.5, 3],
      ],
      start: { nodeId: outdoorUnit.id, portId: 'supply' },
      end: { nodeId: bufferTank.id, portId: 'source-supply' },
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
