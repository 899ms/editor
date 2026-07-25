import { afterEach, describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { nodeRegistry, registerNode } from '../registry'
import { validateBuildJson } from './validate-build-json'

describe('validateBuildJson registered nodes', () => {
  afterEach(() => nodeRegistry._reset())

  test('accepts a node kind registered by an external plugin', () => {
    registerNode({
      kind: 'test:system',
      schemaVersion: 1,
      schema: z.object({
        object: z.literal('node'),
        id: z.string(),
        type: z.literal('test:system'),
        parentId: z.null(),
        visible: z.boolean(),
        metadata: z.record(z.string(), z.unknown()),
        name: z.string(),
        mode: z.enum(['cooling', 'heating', 'standby']),
      }),
      category: 'utility',
      defaults: () => ({
        object: 'node',
        parentId: null,
        visible: false,
        metadata: {},
        name: 'System',
        mode: 'standby',
      }),
      capabilities: {},
    } as never)

    const result = validateBuildJson({
      nodes: {
        test_system: {
          object: 'node',
          id: 'test_system',
          type: 'test:system',
          parentId: null,
          visible: false,
          metadata: {},
          name: 'System',
          mode: 'cooling',
        },
      },
      rootNodeIds: ['test_system'],
    })

    expect(result.ok).toBe(true)
    expect(result.stats.unknownTypes).toEqual({})
    expect(result.schemaIssueCount).toBe(0)
  })
})
