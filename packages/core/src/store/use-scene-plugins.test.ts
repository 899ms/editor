import { beforeEach, describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { loadPlugin, nodeRegistry, registerPlugin } from '../registry'
import type { AnyNodeDefinition } from '../registry/types'
import type { AnyNode, AnyNodeId } from '../schema'
import useScene from './use-scene'

describe('scene plugin installation state', () => {
  beforeEach(() => {
    nodeRegistry._reset()
    useScene.getState().setReadOnly(false)
    useScene.getState().unloadScene()
  })

  test('loads an explicit installed plugin list with the scene', () => {
    useScene.getState().setScene({}, [], {
      installedPlugins: ['pascal:trees'],
      hasExplicitPluginInstallState: true,
    })

    expect(useScene.getState().installedPlugins).toEqual(['pascal:trees'])
    expect(useScene.getState().hasExplicitPluginInstallState).toBe(true)
  })

  test('install changes are de-duplicated and become explicit', () => {
    useScene.getState().setInstalledPlugins(['pascal:trees', 'pascal:trees'], { explicit: true })

    expect(useScene.getState().installedPlugins).toEqual(['pascal:trees'])
    expect(useScene.getState().hasExplicitPluginInstallState).toBe(true)
  })

  test('mandatory plugins cannot be removed through the scene store', () => {
    registerPlugin(
      {
        id: 'test:required',
        apiVersion: 1,
        nodes: [],
      },
      { mandatory: true },
    )

    useScene.getState().setInstalledPlugins([], { explicit: true })

    expect(useScene.getState().installedPlugins).toEqual(['test:required'])
    expect(useScene.getState().hasExplicitPluginInstallState).toBe(true)
  })

  test('scene loading restores mandatory plugins omitted by persisted data', () => {
    registerPlugin(
      {
        id: 'test:required',
        apiVersion: 1,
        nodes: [],
      },
      { mandatory: true },
    )

    useScene.getState().setScene({}, [], {
      installedPlugins: [],
      hasExplicitPluginInstallState: true,
    })

    expect(useScene.getState().installedPlugins).toEqual(['test:required'])
  })

  test('default and already-loaded scenes acquire plugins required after startup', () => {
    useScene.getState().loadScene()

    registerPlugin(
      {
        id: 'test:required',
        apiVersion: 1,
        nodes: [],
      },
      { mandatory: true },
    )

    useScene.getState().loadScene()

    expect(useScene.getState().installedPlugins).toEqual(['test:required'])
  })

  test('clearing geometry preserves project plugin installs', () => {
    useScene.getState().setInstalledPlugins(['pascal:trees'], { explicit: true })
    useScene.getState().clearScene()

    expect(useScene.getState().installedPlugins).toEqual(['pascal:trees'])
    expect(useScene.getState().hasExplicitPluginInstallState).toBe(true)
  })

  test('clearing a scene cannot restore plugin state without a mandatory plugin', () => {
    registerPlugin(
      {
        id: 'test:required',
        apiVersion: 1,
        nodes: [],
      },
      { mandatory: true },
    )

    useScene.getState().clearScene()

    expect(useScene.getState().installedPlugins).toEqual(['test:required'])
  })

  test('uninstall clears plugin build work and reinstall schedules it again', async () => {
    const kind = 'test:plugin-node'
    const definition = {
      kind,
      schemaVersion: 1,
      schema: z.object({ id: z.string(), type: z.literal(kind) }),
      category: 'utility',
      defaults: () => ({}),
      capabilities: {},
    } as unknown as AnyNodeDefinition
    await loadPlugin({ id: 'test:plugin', apiVersion: 1, nodes: [definition] })
    const nodeId = 'plugin_node' as AnyNodeId
    useScene.getState().setScene(
      {
        [nodeId]: { id: nodeId, type: kind } as unknown as AnyNode,
      },
      [nodeId],
      { installedPlugins: ['test:plugin'], hasExplicitPluginInstallState: true },
    )

    expect(useScene.getState().dirtyNodes.has(nodeId)).toBe(true)

    useScene.getState().setInstalledPlugins([], { explicit: true })
    expect(useScene.getState().dirtyNodes.has(nodeId)).toBe(false)

    useScene.getState().setInstalledPlugins(['test:plugin'], { explicit: true })
    expect(useScene.getState().dirtyNodes.has(nodeId)).toBe(true)
  })
})
