import { describe, expect, test } from 'bun:test'
import {
  extendAuthorizedNodeDrop,
  isSuspiciousNodeDrop,
  shouldBlockAutosaveNodeDrop,
  shouldFlushAutosaveOnCleanup,
} from './use-auto-save'

describe('isSuspiciousNodeDrop', () => {
  test('blocks populated scenes from being flushed as empty skeletons', () => {
    expect(isSuspiciousNodeDrop(12, 0)).toBe(true)
    expect(isSuspiciousNodeDrop(12, 4)).toBe(true)
  })

  test('allows ordinary edits and intentionally empty starting scenes', () => {
    expect(isSuspiciousNodeDrop(12, 11)).toBe(false)
    expect(isSuspiciousNodeDrop(4, 0)).toBe(false)
  })

  test('blocks every unproven collapse to the structural shell', () => {
    expect(isSuspiciousNodeDrop(5, 4)).toBe(true)
    expect(isSuspiciousNodeDrop(6, 4)).toBe(true)
    expect(isSuspiciousNodeDrop(7, 4)).toBe(true)
  })
})

describe('authorized node drops', () => {
  test('allows an exact explicit deletion transition', () => {
    expect(shouldBlockAutosaveNodeDrop(7, 4, { from: 7, to: 4 })).toBe(false)
  })

  test('chains multiple explicit deletions before the debounce fires', () => {
    let authorization = extendAuthorizedNodeDrop(null, {
      previousNodeCount: 7,
      currentNodeCount: 6,
    })
    authorization = extendAuthorizedNodeDrop(authorization, {
      previousNodeCount: 6,
      currentNodeCount: 5,
    })
    authorization = extendAuthorizedNodeDrop(authorization, {
      previousNodeCount: 5,
      currentNodeCount: 4,
    })

    expect(authorization).toEqual({ from: 7, to: 4 })
    expect(shouldBlockAutosaveNodeDrop(7, 4, authorization)).toBe(false)
  })

  test('does not let unrelated delete intent authorize a graph collapse', () => {
    expect(shouldBlockAutosaveNodeDrop(7, 4, { from: 6, to: 4 })).toBe(true)
    expect(shouldBlockAutosaveNodeDrop(7, 4, null)).toBe(true)
  })
})

describe('shouldFlushAutosaveOnCleanup', () => {
  test('does not flush a transient empty graph while a scene is loading', () => {
    expect(
      shouldFlushAutosaveOnCleanup({
        hasDirtyChanges: true,
        isLoadingScene: true,
      }),
    ).toBe(false)
  })

  test('flushes real dirty changes after loading has completed', () => {
    expect(
      shouldFlushAutosaveOnCleanup({
        hasDirtyChanges: true,
        isLoadingScene: false,
      }),
    ).toBe(true)
  })
})
