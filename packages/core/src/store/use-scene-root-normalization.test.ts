import { afterEach, describe, expect, test } from 'bun:test'
import type { AnyNode, AnyNodeId } from '../schema'
import useScene from './use-scene'

const siteId = 'site_root' as AnyNodeId
const logicalId = 'plugin-system_root' as AnyNodeId

describe('scene root normalization', () => {
  afterEach(() => {
    useScene.getState().unloadScene()
  })

  test('preserves an explicit plugin document root alongside the site root', () => {
    const nodes = {
      [siteId]: {
        object: 'node',
        id: siteId,
        type: 'site',
        parentId: null,
        visible: true,
        metadata: {},
        children: [],
      },
      [logicalId]: {
        object: 'node',
        id: logicalId,
        type: 'test:logical-system',
        parentId: null,
        visible: false,
        metadata: {},
      },
    } as unknown as Record<AnyNodeId, AnyNode>

    useScene.getState().setScene(nodes, [siteId, logicalId])

    expect(useScene.getState().rootNodeIds).toEqual([siteId, logicalId])
    expect(useScene.getState().nodes[logicalId]).toBeDefined()
  })
})
