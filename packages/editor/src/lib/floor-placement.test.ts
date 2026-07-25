import { describe, expect, test } from 'bun:test'
import {
  type AnyNodeDefinition,
  emitter,
  type GridEvent,
  type NodeEvent,
  nodeRegistry,
  registerNode,
  ShelfNode,
} from '@pascal-app/core'
import { Object3D } from 'three'
import {
  getLevelLocalSnappedPosition,
  resolveAlignedFloorPlacement,
  subscribeFloorPlacementClicks,
} from './floor-placement'

const nativeEvent = {} as GridEvent['nativeEvent']

describe('floor placement helpers', () => {
  test('resolveAlignedFloorPlacement snaps to the provided grid step', () => {
    const result = resolveAlignedFloorPlacement({
      node: ShelfNode.parse({ position: [0, 0, 0] }),
      rawX: 0.24,
      rawZ: 0.26,
      gridStep: 0.25,
      candidates: [],
    })

    expect(result.position).toEqual([0.25, 0, 0.25])
    expect(result.guides).toEqual([])
  })

  test('getLevelLocalSnappedPosition falls back to node world position for node events', () => {
    const event = {
      nativeEvent,
      node: ShelfNode.parse({ position: [0, 0, 0] }),
      object: new Object3D(),
      position: [0.24, 0, 0.26],
      stopPropagation() {},
    } as NodeEvent

    expect(getLevelLocalSnappedPosition('missing-level', event, 0.25)).toEqual([0.25, 0, 0.25])
  })

  test('subscribes to click events for node kinds registered by plugins', () => {
    const definitions = [...nodeRegistry.entries()].map(([, definition]) => definition)
    nodeRegistry._reset()
    try {
      registerNode({
        kind: 'test:plugin-equipment',
        schemaVersion: 1,
        schema: ShelfNode as never,
        category: 'utility',
        defaults: () => ShelfNode.parse({ position: [0, 0, 0] }) as never,
        capabilities: {},
      } as AnyNodeDefinition)
      let clicks = 0
      const unsubscribe = subscribeFloorPlacementClicks(() => {
        clicks += 1
      })

      emitter.emit('test:plugin-equipment:click' as never, {} as never)
      expect(clicks).toBe(1)

      unsubscribe()
      emitter.emit('test:plugin-equipment:click' as never, {} as never)
      expect(clicks).toBe(1)
    } finally {
      nodeRegistry._reset()
      for (const definition of definitions) registerNode(definition)
    }
  })
})
