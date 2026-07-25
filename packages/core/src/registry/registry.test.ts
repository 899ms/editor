import { beforeEach, describe, expect, test } from 'bun:test'
import { z } from 'zod'
import {
  getHostRefFields,
  getMandatoryPluginIds,
  getNodePluginId,
  isDrawnViaTool,
  isDrawnViaToolKind,
  isNodeKindEnabled,
  isPresettable,
  isPresettableKind,
  loadPlugin,
  nodeRegistry,
  registerNode,
  registerPlugin,
  resolveInstalledPluginIds,
  safeParseRegisteredNode,
} from './registry'
import type { AnyNodeDefinition, Plugin } from './types'

// Re-registering a kind warns + replaces in dev (HMR) but throws in
// production — see `registry._register`. `bun test` runs with
// NODE_ENV=test (dev path), so the throw-path tests pin NODE_ENV to
// 'production' for the duration of the call.
async function inProduction<T>(fn: () => T | Promise<T>): Promise<T> {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    return await fn()
  } finally {
    process.env.NODE_ENV = prev
  }
}

function makeDefinition(
  kind: string,
  overrides: Partial<AnyNodeDefinition> = {},
): AnyNodeDefinition {
  return {
    kind,
    schemaVersion: 1,
    schema: z.object({ type: z.literal(kind) }) as any,
    category: 'utility',
    defaults: () => ({}) as any,
    capabilities: {},
    renderer: { kind: 'parametric', module: async () => ({ default: () => null }) },
    ...overrides,
  }
}

describe('nodeRegistry', () => {
  beforeEach(() => {
    nodeRegistry._reset()
  })

  test('starts empty', () => {
    expect(nodeRegistry.size).toBe(0)
    expect(nodeRegistry.has('anything')).toBe(false)
    expect(nodeRegistry.get('anything')).toBeUndefined()
  })

  test('registerNode adds a definition', () => {
    const def = makeDefinition('column')
    registerNode(def)
    expect(nodeRegistry.size).toBe(1)
    expect(nodeRegistry.has('column')).toBe(true)
    expect(nodeRegistry.get('column')).toBe(def)
  })

  test('registerNode throws on duplicate kind in production', async () => {
    await inProduction(() => {
      registerNode(makeDefinition('column'))
      expect(() => registerNode(makeDefinition('column'))).toThrow(/duplicate node kind/)
    })
  })

  test('registerNode replaces on duplicate kind in dev (HMR)', () => {
    const first = makeDefinition('column')
    const second = makeDefinition('column')
    registerNode(first)
    registerNode(second)
    expect(nodeRegistry.size).toBe(1)
    expect(nodeRegistry.get('column')).toBe(second)
  })

  test('registerNode rejects empty kind', () => {
    expect(() => registerNode(makeDefinition(''))).toThrow(/non-empty string/)
  })

  test('registerNode rejects invalid schemaVersion', () => {
    expect(() => registerNode(makeDefinition('bad', { schemaVersion: 0 }))).toThrow(/schemaVersion/)
    expect(() => registerNode(makeDefinition('bad', { schemaVersion: -1 }))).toThrow(
      /schemaVersion/,
    )
  })

  test('entries() iterates registered definitions', () => {
    registerNode(makeDefinition('a'))
    registerNode(makeDefinition('b'))
    const kinds = Array.from(nodeRegistry.entries(), ([k]) => k)
    expect(kinds).toEqual(['a', 'b'])
  })

  test('schemas() returns all registered schemas', () => {
    const a = makeDefinition('a')
    const b = makeDefinition('b')
    registerNode(a)
    registerNode(b)
    expect(nodeRegistry.schemas()).toEqual([a.schema, b.schema])
  })
})

describe('isPresettable', () => {
  beforeEach(() => {
    nodeRegistry._reset()
  })

  test('explicit true wins', () => {
    const def = makeDefinition('explicit-true', { capabilities: { presettable: true } })
    expect(isPresettable(def)).toBe(true)
  })

  test('explicit false wins even with parametrics', () => {
    const def = makeDefinition('explicit-false', {
      capabilities: { presettable: false },
      parametrics: { groups: [] } as any,
    })
    expect(isPresettable(def)).toBe(false)
  })

  test('defaults to true when parametrics exists', () => {
    const def = makeDefinition('param', { parametrics: { groups: [] } as any })
    expect(isPresettable(def)).toBe(true)
  })

  test('defaults to false without parametrics', () => {
    const def = makeDefinition('no-param')
    expect(isPresettable(def)).toBe(false)
  })

  test('isPresettableKind looks up the registry', () => {
    registerNode(makeDefinition('shelfy', { parametrics: { groups: [] } as any }))
    expect(isPresettableKind('shelfy')).toBe(true)
    expect(isPresettableKind('unknown')).toBe(false)
  })
})

describe('getHostRefFields', () => {
  test('returns the declared hostRefFields verbatim', () => {
    const def = makeDefinition('door', { capabilities: { hostRefFields: ['wallId'] } })
    expect(getHostRefFields(def)).toEqual(['wallId'])
  })

  test('defaults to an empty array when none declared', () => {
    const def = makeDefinition('shelf')
    expect(getHostRefFields(def)).toEqual([])
  })
})

describe('isDrawnViaTool', () => {
  beforeEach(() => {
    nodeRegistry._reset()
  })

  test('true when capability set', () => {
    const def = makeDefinition('fence', { capabilities: { drawTool: true } })
    expect(isDrawnViaTool(def)).toBe(true)
  })

  test('false when unset or not exactly true', () => {
    expect(isDrawnViaTool(makeDefinition('column'))).toBe(false)
    expect(isDrawnViaTool(makeDefinition('off', { capabilities: { drawTool: false } }))).toBe(false)
  })

  test('isDrawnViaToolKind looks up the registry', () => {
    registerNode(makeDefinition('fence', { capabilities: { drawTool: true } }))
    expect(isDrawnViaToolKind('fence')).toBe(true)
    expect(isDrawnViaToolKind('unknown')).toBe(false)
  })
})

describe('loadPlugin', () => {
  beforeEach(() => {
    nodeRegistry._reset()
  })

  test('registers all nodes from a plugin', async () => {
    const plugin: Plugin = {
      id: 'test:plugin',
      apiVersion: 1,
      nodes: [makeDefinition('a'), makeDefinition('b')],
    }
    await loadPlugin(plugin)
    expect(nodeRegistry.size).toBe(2)
    expect(nodeRegistry.has('a')).toBe(true)
    expect(nodeRegistry.has('b')).toBe(true)
    expect(getNodePluginId('a')).toBe('test:plugin')
    expect(getNodePluginId('b')).toBe('test:plugin')
  })

  test('tracks plugin installation policy separately from the plugin manifest', () => {
    registerPlugin(
      {
        id: 'test:required',
        apiVersion: 1,
        nodes: [makeDefinition('test:required-node')],
      },
      { mandatory: true },
    )

    expect(getMandatoryPluginIds()).toEqual(['test:required'])
  })

  test('merges mandatory plugins into explicit and legacy installation state', () => {
    registerPlugin(
      {
        id: 'test:required',
        apiVersion: 1,
        nodes: [],
      },
      { mandatory: true },
    )

    expect(resolveInstalledPluginIds()).toEqual(['test:required'])
    expect(resolveInstalledPluginIds([])).toEqual(['test:required'])
    expect(resolveInstalledPluginIds(['test:optional', 'test:required'])).toEqual([
      'test:optional',
      'test:required',
    ])
  })

  test('enables plugin kinds only when the project has the plugin installed', async () => {
    await loadPlugin({ id: 'test:plugin', apiVersion: 1, nodes: [makeDefinition('plugin:node')] })

    expect(isNodeKindEnabled('plugin:node', [])).toBe(false)
    expect(isNodeKindEnabled('plugin:node', ['test:plugin'])).toBe(true)
    expect(isNodeKindEnabled('plugin:node')).toBe(true)
    expect(isNodeKindEnabled('host:node', [])).toBe(true)
  })

  test('keeps built-in plugin kinds enabled independently of project installs', async () => {
    await loadPlugin({ id: 'pascal:core', apiVersion: 1, nodes: [makeDefinition('wall')] })

    expect(isNodeKindEnabled('wall', [])).toBe(true)
  })

  test('handles plugin with no nodes', async () => {
    await loadPlugin({ id: 'empty', apiVersion: 1 })
    expect(nodeRegistry.size).toBe(0)
  })

  test('handles plugin with empty nodes array', async () => {
    await loadPlugin({ id: 'empty', apiVersion: 1, nodes: [] })
    expect(nodeRegistry.size).toBe(0)
  })

  test('throws on apiVersion mismatch', async () => {
    const plugin = {
      id: 'old-plugin',
      apiVersion: 99 as unknown as 1,
      nodes: [],
    }
    await expect(loadPlugin(plugin)).rejects.toThrow(/apiVersion/)
  })

  test('propagates duplicate-kind error from a single plugin in production', async () => {
    const plugin: Plugin = {
      id: 'broken',
      apiVersion: 1,
      nodes: [makeDefinition('dup'), makeDefinition('dup')],
    }
    await inProduction(() => expect(loadPlugin(plugin)).rejects.toThrow(/duplicate node kind/))
  })

  test('propagates duplicate-kind error across plugins in production', async () => {
    await inProduction(async () => {
      await loadPlugin({ id: 'a', apiVersion: 1, nodes: [makeDefinition('shared')] })
      await expect(
        loadPlugin({ id: 'b', apiVersion: 1, nodes: [makeDefinition('shared')] }),
      ).rejects.toThrow(/duplicate node kind/)
    })
  })
})

describe('safeParseRegisteredNode', () => {
  beforeEach(() => {
    nodeRegistry._reset()
  })

  test('validates an external node through its registered schema', () => {
    registerNode(
      makeDefinition('test:registered', {
        schema: z.object({
          id: z.string(),
          type: z.literal('test:registered'),
          mode: z.enum(['cooling', 'heating', 'standby']),
        }) as any,
      }),
    )

    expect(
      safeParseRegisteredNode({
        id: 'test_registered',
        type: 'test:registered',
        mode: 'cooling',
      }).success,
    ).toBe(true)
    expect(
      safeParseRegisteredNode({
        id: 'test_registered',
        type: 'test:registered',
        mode: 'invalid',
      }).success,
    ).toBe(false)
  })

  test('falls back to the built-in node union for an unregistered built-in kind', () => {
    expect(
      safeParseRegisteredNode({
        id: 'site_registered_fallback',
        type: 'site',
        children: [],
      }).success,
    ).toBe(true)
  })

  test('accepts a registered plugin child in a built-in parent when the graph relationship agrees', () => {
    registerNode(
      makeDefinition('test:level-child', {
        capabilities: { hostable: { parents: ['level'] } },
        schema: z.object({
          object: z.literal('node'),
          id: z.string(),
          type: z.literal('test:level-child'),
          parentId: z.string(),
          value: z.number(),
        }) as any,
      }),
    )

    const nodes = {
      level_1: {
        object: 'node',
        id: 'level_1',
        type: 'level',
        parentId: null,
        children: ['test_child_1'],
        level: 0,
      },
      test_child_1: {
        object: 'node',
        id: 'test_child_1',
        type: 'test:level-child',
        parentId: 'level_1',
        value: 1,
      },
    }

    const result = safeParseRegisteredNode(nodes.level_1, { nodes })
    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data as { children: string[] }).children).toEqual(['test_child_1'])
    }
  })

  test('rejects a registered child reference when its parentId points elsewhere', () => {
    registerNode(
      makeDefinition('test:level-child', {
        capabilities: { hostable: { parents: ['level'] } },
        schema: z.object({
          object: z.literal('node'),
          id: z.string(),
          type: z.literal('test:level-child'),
          parentId: z.string(),
        }) as any,
      }),
    )

    const nodes = {
      level_1: {
        object: 'node',
        id: 'level_1',
        type: 'level',
        parentId: null,
        children: ['test_child_1'],
        level: 0,
      },
      test_child_1: {
        object: 'node',
        id: 'test_child_1',
        type: 'test:level-child',
        parentId: 'level_2',
      },
    }

    expect(safeParseRegisteredNode(nodes.level_1, { nodes }).success).toBe(false)
  })

  test('rejects a registered plugin child without an explicit host contract', () => {
    registerNode(
      makeDefinition('test:unhosted-child', {
        schema: z.object({
          object: z.literal('node'),
          id: z.string(),
          type: z.literal('test:unhosted-child'),
          parentId: z.string(),
        }) as any,
      }),
    )
    const nodes = {
      level_1: {
        object: 'node',
        id: 'level_1',
        type: 'level',
        parentId: null,
        children: ['test_child_1'],
        level: 0,
      },
      test_child_1: {
        object: 'node',
        id: 'test_child_1',
        type: 'test:unhosted-child',
        parentId: 'level_1',
      },
    }

    expect(safeParseRegisteredNode(nodes.level_1, { nodes }).success).toBe(false)
  })

  test('validates registered node references against the full graph', () => {
    registerNode(
      makeDefinition('test:system', {
        schema: z.object({ id: z.string(), type: z.literal('test:system') }) as any,
      }),
    )
    registerNode(
      makeDefinition('test:device', {
        relations: { references: { systemId: ['test:system'] } },
        schema: z.object({
          id: z.string(),
          type: z.literal('test:device'),
          systemId: z.string(),
        }) as any,
      }),
    )
    const validNodes = {
      system_1: { id: 'system_1', type: 'test:system' },
      device_1: { id: 'device_1', type: 'test:device', systemId: 'system_1' },
    }
    expect(safeParseRegisteredNode(validNodes.device_1, { nodes: validNodes }).success).toBe(true)
    expect(
      safeParseRegisteredNode(validNodes.device_1, {
        nodes: { device_1: validNodes.device_1 },
      }).success,
    ).toBe(false)
    expect(
      safeParseRegisteredNode(validNodes.device_1, {
        nodes: {
          ...validNodes,
          system_1: { id: 'system_1', type: 'test:device', systemId: 'system_1' },
        },
      }).success,
    ).toBe(false)
  })

  test('allows an empty registered reference when the node schema explicitly allows null', () => {
    registerNode(
      makeDefinition('test:optional-reference', {
        relations: { references: { zoneId: ['zone'] } },
        schema: z.object({
          id: z.string(),
          type: z.literal('test:optional-reference'),
          zoneId: z.string().nullable(),
        }) as any,
      }),
    )
    const node = {
      id: 'test_optional_reference',
      type: 'test:optional-reference',
      zoneId: null,
    }

    expect(
      safeParseRegisteredNode(node, {
        nodes: { [node.id]: node },
      }).success,
    ).toBe(true)
  })

  test('rejects an unknown child reference even when graph context is provided', () => {
    const nodes = {
      level_1: {
        object: 'node',
        id: 'level_1',
        type: 'level',
        parentId: null,
        children: ['unknown_child_1'],
        level: 0,
      },
    }

    expect(safeParseRegisteredNode(nodes.level_1, { nodes }).success).toBe(false)
  })
})
